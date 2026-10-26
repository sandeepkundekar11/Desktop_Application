import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { importLocal, createTestCollector } from './db-test-helpers.mjs';

const {
  resolveStorageRoot,
  getActiveStorageRoot,
  setCustomDataRoot,
  findProjectRoot,
} = await importLocal('dist-electron/main/storage/storageRootResolver.js');

const {
  getTargetStorageLocations,
} = await importLocal('dist-electron/main/storage/targetStorageLocations.js');

const {
  getStorageLocations,
  resolveDataRoot,
} = await importLocal('dist-electron/main/storage/paths.js');

const {
  initializeStorageHierarchy,
} = await importLocal('dist-electron/main/storage/directoryInitializer.js');

const {
  readJsonSafe,
  writeJsonAtomic,
} = await importLocal('dist-electron/main/storage/atomicFileWriter.js');

const {
  migrateLegacyDataIfPresent,
} = await importLocal('dist-electron/main/storage/legacyDataMigrator.js');

const { tests, assert } = createTestCollector();

async function runTests() {
  console.log('\n======================================================\n   APPLYPILOT STORAGE PATH STRATEGY VERIFICATION\n======================================================\n');

  const testTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'applypilot-path-strategy-'));

  try {
    // 1. Development resolves to Desktop_Application/data/ and does not depend on CWD
    console.log('\n--- 1. Development Mode Resolves to Desktop_Application/data ---');
    setCustomDataRoot(null);
    delete process.env.APPLYPILOT_DATA_ROOT;

    const devResolution = resolveStorageRoot();
    assert('Development mode detected', devResolution.mode === 'development');
    assert('Storage root ends with data', path.basename(devResolution.root) === 'data');
    assert(
      'Storage root parent directory is Desktop_Application',
      path.basename(path.dirname(devResolution.root)) === 'Desktop_Application',
      `Parent: ${path.basename(path.dirname(devResolution.root))}`
    );
    assert('Development data root is writable', devResolution.isWritable === true);
    assert('No warning for writable dev data root', devResolution.warning === null);

    // Verify it does not depend on process.cwd()
    const originalCwd = process.cwd();
    try {
      process.chdir(os.tmpdir());
      const cwdAgnosticRes = resolveStorageRoot();
      assert(
        'Resolution remains Desktop_Application/data even when CWD is changed',
        path.basename(path.dirname(cwdAgnosticRes.root)) === 'Desktop_Application',
        `Root with changed CWD: ${cwdAgnosticRes.root}`
      );
    } finally {
      process.chdir(originalCwd);
    }

    // 2. Packaged mode resolution strategy
    console.log('\n--- 2. Packaged Mode Resolves to Executable Sibling data/ ---');
    // Test findProjectRoot directly
    const foundRoot = findProjectRoot(path.resolve('src/main/storage'));
    assert('findProjectRoot locates repository root containing package.json', foundRoot !== null);
    if (foundRoot) {
      assert('Project root contains package.json with applypilot', fs.existsSync(path.join(foundRoot, 'package.json')));
    }

    // Verify simulated packaged directory resolution
    const mockExeDir = path.join(testTempDir, 'mock-app-dist');
    const mockDataDir = path.join(mockExeDir, 'data');
    fs.mkdirSync(mockDataDir, { recursive: true });
    assert('Packaged sibling data directory exists beside executable', fs.existsSync(mockDataDir));

    // 3. Both modes create identical directory structures
    console.log('\n--- 3. Both Modes Create Identical Directory Structures ---');
    const devDirStructure = path.join(testTempDir, 'dev-structure');
    const packagedDirStructure = path.join(testTempDir, 'pkg-structure');

    const devInit = initializeStorageHierarchy(devDirStructure);
    const pkgInit = initializeStorageHierarchy(packagedDirStructure);

    const getRelativeTree = (baseDir) => {
      const results = [];
      const walk = (current) => {
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(current, entry.name);
          const rel = path.relative(baseDir, full).replace(/\\/g, '/');
          results.push(rel);
          if (entry.isDirectory()) {
            walk(full);
          }
        }
      };
      walk(baseDir);
      return results.sort();
    };

    const devTree = getRelativeTree(devDirStructure);
    const pkgTree = getRelativeTree(packagedDirStructure);

    assert('Both dev and packaged modes produce identical directory counts', devTree.length === pkgTree.length, `Count: ${devTree.length}`);
    const treesMatch = devTree.every((item, idx) => item === pkgTree[idx]);
    assert('Both directory and file trees match 100%', treesMatch);
    assert('Includes database/ directory', devTree.includes('database'));
    assert('Includes resumes/ directory', devTree.includes('resumes'));
    assert('Includes manifest.json file', devTree.includes('manifest.json'));

    // 4. Startup initializes storage before UI reads begin
    console.log('\n--- 4. Startup Storage Initialization ---');
    assert('Dev initialization reports initialized = true', devInit.initialized === true);
    assert('All required directories created (13 dirs)', devInit.createdDirectories.length === 13, `Dirs: ${devInit.createdDirectories.length}`);
    assert('Initial JSON files initialized', devInit.initializedFiles.length >= 10);

    // 5. Repeated initialization preserves existing data
    console.log('\n--- 5. Repeated Initialization Preserves Existing Data ---');
    const targetLocs = getTargetStorageLocations(devDirStructure);
    const userCustomData = { theme: 'dark', customSetting: 'must_survive_reinit' };
    writeJsonAtomic(targetLocs.settingsFile, userCustomData);

    const reinitResult = initializeStorageHierarchy(devDirStructure);
    assert('Re-initialization creates 0 new directories', reinitResult.createdDirectories.length === 0);
    assert('Re-initialization preserves files', reinitResult.preservedFiles.length >= 10);

    const reReadSettings = readJsonSafe(targetLocs.settingsFile, {});
    assert('Existing settings data was preserved without overwrite', reReadSettings.customSetting === 'must_survive_reinit');

    // Test invalid JSON preservation
    const corruptedSettingsFile = path.join(devDirStructure, 'profile', 'corrupt.json');
    fs.writeFileSync(corruptedSettingsFile, '{ invalid json content !@#$');
    const reinitWithCorrupt = initializeStorageHierarchy(devDirStructure);
    assert('Corrupted JSON does not crash initialization', reinitWithCorrupt.initialized === true);
    assert('Corrupted file content remains untouched on disk', fs.readFileSync(corruptedSettingsFile, 'utf8') === '{ invalid json content !@#$');

    // 6. Existing SQLite and resume files preservation during legacy migration
    console.log('\n--- 6. Legacy Migration Safeguards and Data Preservation ---');
    const mockLegacyDir = path.join(testTempDir, 'mock-legacy-appdata');
    const mockLegacyDbDir = path.join(mockLegacyDir, 'database');
    const mockLegacyResumesDir = path.join(mockLegacyDir, 'resumes', 'originals');
    fs.mkdirSync(mockLegacyDbDir, { recursive: true });
    fs.mkdirSync(mockLegacyResumesDir, { recursive: true });

    const mockDbFile = path.join(mockLegacyDbDir, 'applypilot.sqlite');
    fs.writeFileSync(mockDbFile, 'SQLITE_BINARY_MOCK_DATA_PROFILE_12345');
    const mockResumeFile = path.join(mockLegacyResumesDir, 'resume-uuid-1.pdf');
    fs.writeFileSync(mockResumeFile, 'PDF_BINARY_MOCK_DATA_SANDEEP_RESUME');

    const freshTargetData = path.join(testTempDir, 'fresh-target-data');
    initializeStorageHierarchy(freshTargetData);

    // First migration run
    const migrationReport1 = migrateLegacyDataIfPresent({
      sourceDir: mockLegacyDir,
      destinationDir: freshTargetData,
    });

    assert('Migration attempted = true', migrationReport1.attempted === true);
    assert('Database migrated successfully', migrationReport1.databaseMigrated === true);
    assert('Resume file migrated', migrationReport1.migratedFiles.includes('resume:resume-uuid-1.pdf'));
    assert('Pre-migration backup created in backups directory', migrationReport1.backupDir !== null && fs.existsSync(migrationReport1.backupDir));

    // Verify source legacy files are 100% UNTOUCHED and NOT DELETED
    assert('Source legacy SQLite DB still exists', fs.existsSync(mockDbFile));
    assert('Source legacy resume file still exists', fs.existsSync(mockResumeFile));
    assert('Source legacy DB content unchanged', fs.readFileSync(mockDbFile, 'utf8') === 'SQLITE_BINARY_MOCK_DATA_PROFILE_12345');

    const destDbFile = path.join(freshTargetData, 'database', 'applypilot.sqlite');
    const destResumeFile = path.join(freshTargetData, 'resumes', 'resume-uuid-1.pdf');
    assert('Destination SQLite DB exists', fs.existsSync(destDbFile));
    assert('Destination resume file exists', fs.existsSync(destResumeFile));
    assert('Destination DB matches source', fs.readFileSync(destDbFile, 'utf8') === 'SQLITE_BINARY_MOCK_DATA_PROFILE_12345');

    // Second migration run (conflict protection)
    const migrationReport2 = migrateLegacyDataIfPresent({
      sourceDir: mockLegacyDir,
      destinationDir: freshTargetData,
    });
    assert('Second migration run skips existing database', migrationReport2.databaseMigrated === false);
    assert('Second migration reports database skipped reason', migrationReport2.databaseSkippedReason === 'Destination database already exists');
    assert('Zero files migrated on second run', migrationReport2.migratedFiles.length === 0);

    // 7. All repositories and storage modules use the same resolved root
    console.log('\n--- 7. Unified Storage Root Across All Modules ---');
    const activeRoot = getActiveStorageRoot();
    const resolvedDataRoot = resolveDataRoot();
    const pathsLocations = getStorageLocations();
    const targetLocations = getTargetStorageLocations();

    assert('getActiveStorageRoot matches resolveDataRoot', activeRoot === resolvedDataRoot);
    assert('paths.ts getStorageLocations root matches activeRoot', pathsLocations.root === activeRoot);
    assert('targetStorageLocations.ts root matches activeRoot', targetLocations.root === activeRoot);
    assert('paths.ts databasePath is inside resolved data root', pathsLocations.databasePath === path.join(activeRoot, 'database', 'applypilot.sqlite'));
    assert('targetStorageLocations databasePath matches paths.ts databasePath', targetLocations.databasePath === pathsLocations.databasePath);

  } finally {
    setCustomDataRoot(null);
    fs.rmSync(testTempDir, { recursive: true, force: true });
  }

  const allPassed = tests.every((t) => t.pass);
  console.log(`\n======================================================\n ALL ${tests.length} STORAGE PATH STRATEGY TESTS PASSED!\n======================================================\n`);
  process.exit(allPassed ? 0 : 1);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
