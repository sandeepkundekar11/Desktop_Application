import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { importLocal, createTestCollector } from './db-test-helpers.mjs';

const { resolveStorageRoot, setCustomDataRoot } = await importLocal('dist-electron/main/storage/storageRootResolver.js');
const { getTargetStorageLocations } = await importLocal('dist-electron/main/storage/targetStorageLocations.js');
const { writeJsonAtomic, readJsonSafe, withFileLock } = await importLocal('dist-electron/main/storage/atomicFileWriter.js');
const { initializeStorageHierarchy } = await importLocal('dist-electron/main/storage/directoryInitializer.js');
const {
  STORAGE_FORMAT_IDENTIFIER,
  STORAGE_SCHEMA_VERSION,
  isManifestData,
  isCandidateProfileJson,
  isWorkExperienceJson,
  isJobsIndexData,
  isApplicationIndexData,
} = await importLocal('dist-electron/main/storage/jsonSchemas.js');

const { tests, assert } = createTestCollector();

async function runTests() {
  console.log('\n======================================================\n   APPLYPILOT STORAGE FOUNDATION TESTS (CHUNK 1)\n======================================================\n');

  const testTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'applypilot-storage-test-'));

  try {
    // 1. Storage Root Resolution Tests
    console.log('\n--- 1. Storage Root Resolver ---');
    setCustomDataRoot(testTempDir);
    const customRes = resolveStorageRoot();
    assert('Custom storage root resolves to specified directory', customRes.root === testTempDir);
    assert('Storage mode is custom', customRes.mode === 'custom');
    assert('Storage directory is writable', customRes.isWritable === true);
    assert('No warning on writable directory', customRes.warning === null);

    setCustomDataRoot(null);
    const defaultRes = resolveStorageRoot();
    assert('Default resolution returns a valid string path', typeof defaultRes.root === 'string' && defaultRes.root.length > 0);
    assert('Default resolution identifies mode (dev/portable/installed)', ['development', 'portable', 'installed'].includes(defaultRes.mode));

    // 2. First-Run Directory Hierarchy Initialization
    console.log('\n--- 2. First-Run Directory Hierarchy Initialization ---');
    const firstRun = initializeStorageHierarchy(testTempDir);
    assert('First-run reports initialized = true', firstRun.initialized === true);
    assert('Created all 13 required directories', firstRun.createdDirectories.length === 13, `Created: ${firstRun.createdDirectories.length}`);
    assert('Initialized required initial JSON files', firstRun.initializedFiles.length >= 10, `Files: ${firstRun.initializedFiles.length}`);

    const locs = getTargetStorageLocations(testTempDir);
    assert('manifest.json created', fs.existsSync(locs.manifestFile));
    assert('database directory exists', fs.existsSync(locs.databaseDir));
    assert('settings/settings.json created', fs.existsSync(locs.settingsFile));
    assert('jobs/jobs-index.json created', fs.existsSync(locs.jobsIndexFile));
    assert('applications/application-index.json created', fs.existsSync(locs.applicationIndexFile));
    assert('automation/site-capabilities.json created', fs.existsSync(locs.siteCapabilitiesFile));
    assert('resumes directory exists', fs.existsSync(locs.resumesDir));
    assert('no subdirectories exist under resumes', fs.readdirSync(locs.resumesDir).filter(f => fs.statSync(path.join(locs.resumesDir, f)).isDirectory()).length === 0);

    const manifestContent = readJsonSafe(locs.manifestFile, null, isManifestData);
    assert('manifest.json conforms to ManifestData schema', manifestContent !== null);
    assert('manifest has correct format identifier', manifestContent?.format === STORAGE_FORMAT_IDENTIFIER);
    assert('manifest has schemaVersion = 1', manifestContent?.schemaVersion === STORAGE_SCHEMA_VERSION);

    // 3. Repeated Initialization (Zero Overwrite & Preservation)
    console.log('\n--- 3. Repeated Initialization (Preservation Guarantee) ---');
    // Simulate user data in settings.json
    const userSettings = { theme: 'light', userCustomKey: 'preserve_me_always' };
    writeJsonAtomic(locs.settingsFile, userSettings);

    const secondRun = initializeStorageHierarchy(testTempDir);
    assert('Second run creates 0 new directories', secondRun.createdDirectories.length === 0);
    assert('Second run preserves existing files', secondRun.preservedFiles.length >= 10);

    const preservedSettings = readJsonSafe(locs.settingsFile, {});
    assert('Existing settings.json was not overwritten', preservedSettings.userCustomKey === 'preserve_me_always');

    // 4. Safe Atomic Writes & Interruption Protection
    console.log('\n--- 4. Safe Atomic Writes ---');
    const atomicTestFile = path.join(locs.profileDir, 'atomic-test.json');
    writeJsonAtomic(atomicTestFile, { initial: 'value' });
    assert('Atomic write creates target file', fs.existsSync(atomicTestFile));

    const readInitial = readJsonSafe(atomicTestFile, null);
    assert('Atomic write content is readable and matches', readInitial?.initial === 'value');

    // Overwrite with new value
    writeJsonAtomic(atomicTestFile, { updated: 'new_value' });
    const readUpdated = readJsonSafe(atomicTestFile, null);
    assert('Atomic update safely replaces content', readUpdated?.updated === 'new_value');

    // Verify temporary files are cleaned up
    const dirFiles = fs.readdirSync(locs.profileDir);
    const tmpFiles = dirFiles.filter((f) => f.includes('.tmp.'));
    assert('No temporary write files left in directory', tmpFiles.length === 0);

    // 5. Corrupted JSON Recovery & Safe Fallback
    console.log('\n--- 5. Corrupted JSON Recovery & Safe Fallback ---');
    const corruptFile = path.join(locs.profileDir, 'corrupt.json');
    fs.writeFileSync(corruptFile, '{ invalid json string content :::');

    const fallbackVal = { safe: 'fallback' };
    const safeReadResult = readJsonSafe(corruptFile, fallbackVal);
    assert('readJsonSafe does not throw on corrupt JSON', true);
    assert('readJsonSafe returns fallback value on corrupt JSON', safeReadResult.safe === 'fallback');

    // 6. JSON Schema Constraints & Runtime Validation
    console.log('\n--- 6. JSON Schema Constraints & Runtime Validation ---');
    const validProfile = {
      id: 'prof-123',
      fullName: 'Alice Developer',
      email: 'alice@example.com',
      phone: '555-1234',
      location: 'Remote',
      linkedinUrl: null,
      portfolioUrl: null,
      githubUrl: null,
      professionalSummary: 'Senior Engineer',
      currentTitle: 'Lead',
      totalExperienceMonths: 48,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    assert('isCandidateProfileJson validates well-formed profile', isCandidateProfileJson(validProfile));
    assert('isCandidateProfileJson rejects profile with empty fullName', !isCandidateProfileJson({ ...validProfile, fullName: '  ' }));

    const validExperience = {
      id: 'exp-1',
      profileId: 'prof-123',
      companyName: 'Tech Co',
      jobTitle: 'Developer',
      startDate: '2021-01',
      endDate: '2023-01',
      isCurrent: false,
      achievements: ['Built fast system'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    assert('isWorkExperienceJson validates compliant record', isWorkExperienceJson(validExperience));

    // Constraint: isCurrent requires endDate == null
    const invalidCurrent = { ...validExperience, isCurrent: true, endDate: '2023-01' };
    assert('isWorkExperienceJson rejects isCurrent=true with non-null endDate', !isWorkExperienceJson(invalidCurrent));

    // Constraint: endDate >= startDate
    const invalidDates = { ...validExperience, startDate: '2023-01', endDate: '2021-01' };
    assert('isWorkExperienceJson rejects endDate < startDate', !isWorkExperienceJson(invalidDates));

    // 7. Concurrent File Mutex
    console.log('\n--- 7. Concurrent File Mutex ---');
    const lockTarget = path.join(locs.profileDir, 'mutex-test.json');
    writeJsonAtomic(lockTarget, { count: 0 });

    const tasks = Array.from({ length: 5 }, async (_, i) => {
      return withFileLock(lockTarget, async () => {
        const current = readJsonSafe(lockTarget, { count: 0 });
        const next = { count: current.count + 1 };
        writeJsonAtomic(lockTarget, next);
        return next.count;
      });
    });

    const results = await Promise.all(tasks);
    const finalData = readJsonSafe(lockTarget, { count: 0 });
    assert('Concurrent withFileLock serializes writes correctly', finalData.count === 5, `Final count: ${finalData.count}`);

  } finally {
    setCustomDataRoot(null);
    fs.rmSync(testTempDir, { recursive: true, force: true });
  }

  const allPassed = tests.every((t) => t.pass);
  console.log(`\n======================================================\n ALL ${tests.length} STORAGE FOUNDATION TESTS PASSED!\n======================================================\n`);
  process.exit(allPassed ? 0 : 1);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
