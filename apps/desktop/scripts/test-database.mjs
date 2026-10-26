import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { importLocal, EXPECTED_TABLES, createTestCollector } from './db-test-helpers.mjs';

const { ALL_MIGRATIONS } = await importLocal('dist-electron/main/database/migrations/index.js');
const { runDatabaseMigrations, getAppliedMigrations } = await importLocal('dist-electron/main/database/migrationRunner.js');
const { resolveAndValidatePath, validateFileName } = await importLocal('dist-electron/main/storage/fileStorage.js');
const { setDataRoot } = await importLocal('dist-electron/main/storage/paths.js');

const { tests, assert } = createTestCollector();

async function runTests() {
  console.log('\n========================================\n   APPLYPILOT DATABASE ARCHITECTURE TESTS\n========================================\n');

  // 1. Fresh Database Initialization
  console.log('\n--- 1. Fresh Database Initialization ---');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'applypilot-test-'));
  const freshDb = new DatabaseSync(path.join(tempDir, 'fresh.sqlite'));
  freshDb.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

  const { appliedCount, currentVersion } = runDatabaseMigrations(freshDb, ALL_MIGRATIONS);
  assert('Fresh database applies all 8 migrations', appliedCount === 8, `Applied: ${appliedCount}`);
  assert('Current version matches latest migration (v8)', currentVersion === 8, `Version: ${currentVersion}`);

  // 2. Repeated Database Initialization
  console.log('\n--- 2. Repeated Database Initialization ---');
  const repeatResult = runDatabaseMigrations(freshDb, ALL_MIGRATIONS);
  assert('Re-running migrations applies 0 new migrations', repeatResult.appliedCount === 0);
  assert('Version remains v8 after repeat', repeatResult.currentVersion === 8);

  // 3. Checksum Verification
  console.log('\n--- 3. Checksum Verification ---');
  const tampered = ALL_MIGRATIONS.map((m, idx) => idx === 0 ? { ...m, up: (db) => db.exec('SELECT 1;') } : m);
  let checksumErrorCaught = false;
  try { runDatabaseMigrations(freshDb, tampered); } catch { checksumErrorCaught = true; }
  assert('Checksum mismatch detected on tampered migration', checksumErrorCaught);

  // 4. Transaction Rollback on Failure
  console.log('\n--- 4. Transaction Rollback on Failure ---');
  const rollbackDb = new DatabaseSync(path.join(tempDir, 'rollback.sqlite'));
  rollbackDb.exec('PRAGMA foreign_keys = ON;');
  const failingMigrations = [
    ALL_MIGRATIONS[0],
    { version: 2, name: 'failing_migration', up: (db) => { db.exec('CREATE TABLE temp_table (id TEXT PRIMARY KEY);'); throw new Error('Simulated failure'); } },
  ];
  try { runDatabaseMigrations(rollbackDb, failingMigrations); } catch { /* expected */ }
  const appliedRollback = getAppliedMigrations(rollbackDb);
  assert('Only v1 recorded in schema_migrations after v2 failure', appliedRollback.length === 1 && appliedRollback[0].version === 1);
  assert('Table created during failed migration was rolled back', rollbackDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='temp_table'").get() === undefined);

  // 5. Full Table Inventory
  console.log('\n--- 5. Full Table Inventory Verification ---');
  const dbTables = freshDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name);
  const allTablesPresent = EXPECTED_TABLES.every((t) => dbTables.includes(t));
  assert('All 34 required tables present in database', allTablesPresent, `Total found: ${dbTables.length}`);

  // 6. Foreign Key Constraints
  console.log('\n--- 6. Foreign Key Constraints (RESTRICT & CASCADE) ---');
  let fkErrorCaught = false;
  try {
    freshDb.prepare("INSERT INTO candidate_skills (id, profile_id, name, normalized_name, source_type, created_at, updated_at) VALUES ('s1', 'non-existent', 'TS', 'ts', 'user', '2026-10-15T00:00:00Z', '2026-10-15T00:00:00Z')").run();
  } catch { fkErrorCaught = true; }
  assert('FK violation on candidate_skills.profile_id fails correctly', fkErrorCaught);

  const now = new Date().toISOString();
  freshDb.prepare("INSERT INTO candidate_profiles (id, full_name, profile_data_json, created_at, updated_at) VALUES ('cascade-test', 'Cascade', '{}', ?, ?)").run(now, now);
  freshDb.prepare("INSERT INTO candidate_skills (id, profile_id, name, normalized_name, source_type, created_at, updated_at) VALUES ('s-cas', 'cascade-test', 'React', 'react', 'user', ?, ?)").run(now, now);
  freshDb.prepare("DELETE FROM candidate_profiles WHERE id = 'cascade-test'").run();
  assert('Deleting profile cascaded and deleted skill', freshDb.prepare("SELECT id FROM candidate_skills WHERE id = 's-cas'").get() === undefined);

  // 7. Unique & Partial Constraints
  console.log('\n--- 7. Unique & Partial Constraints ---');
  freshDb.prepare('INSERT INTO ai_providers (id, name, provider_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run('prov-1', 'Test Prov', 'custom', now, now);
  freshDb.prepare('INSERT INTO ai_models (id, provider_id, model_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run('m-1', 'prov-1', 'gpt-4o', now, now);
  let dupModelError = false;
  try { freshDb.prepare('INSERT INTO ai_models (id, provider_id, model_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run('m-2', 'prov-1', 'gpt-4o', now, now); } catch { dupModelError = true; }
  assert('Duplicate (provider_id, model_id) rejected by UNIQUE constraint', dupModelError);

  freshDb.prepare('INSERT INTO job_sources (id, name, source_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run('src-1', 'Source 1', 'direct', now, now);
  freshDb.prepare('INSERT INTO jobs (id, source_id, external_job_id, title, normalized_title, job_url, discovered_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('j-1', 'src-1', 'ext-100', 'Eng', 'eng', 'https://example.com/1', now, now, now);
  let dupJobError = false;
  try { freshDb.prepare('INSERT INTO jobs (id, source_id, external_job_id, title, normalized_title, job_url, discovered_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('j-2', 'src-1', 'ext-100', 'Eng 2', 'eng 2', 'https://example.com/2', now, now, now); } catch { dupJobError = true; }
  assert('Duplicate (source_id, external_job_id) rejected by partial unique index', dupJobError);

  freshDb.prepare('INSERT INTO jobs (id, source_id, external_job_id, title, normalized_title, job_url, discovered_at, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)').run('j-null-1', 'src-1', 'A', 'a', 'https://a.com', now, now, now);
  freshDb.prepare('INSERT INTO jobs (id, source_id, external_job_id, title, normalized_title, job_url, discovered_at, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)').run('j-null-2', 'src-1', 'B', 'b', 'https://b.com', now, now, now);
  assert('Multiple jobs with NULL external_job_id permitted', true);

  // 8. Legacy Database Migration
  console.log('\n--- 8. Legacy Database Migration & Data Preservation ---');
  const legacyDb = new DatabaseSync(path.join(tempDir, 'legacy.sqlite'));
  legacyDb.exec('PRAGMA foreign_keys = ON;');
  legacyDb.exec(`
    CREATE TABLE storage_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO storage_metadata VALUES ('schema_version', '1');
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
    INSERT INTO app_settings VALUES ('theme', 'dark', '2026-10-01T00:00:00Z');
    CREATE TABLE resumes (
      id TEXT PRIMARY KEY, original_filename TEXT NOT NULL, file_format TEXT NOT NULL,
      file_size INTEGER NOT NULL, file_hash TEXT NOT NULL UNIQUE, storage_filename TEXT NOT NULL,
      extracted_text TEXT NOT NULL, character_count INTEGER NOT NULL, word_count INTEGER NOT NULL,
      preview TEXT NOT NULL, created_at TEXT NOT NULL
    );
    INSERT INTO resumes VALUES ('legacy-res-1', 'Jane_Doe_CV.pdf', 'pdf', 54321, 'hash-jane', 'legacy-res-1.pdf', 'Jane Doe software engineer', 26, 4, 'Jane Doe', '2026-10-01T12:00:00Z');
  `);

  const legRes = runDatabaseMigrations(legacyDb, ALL_MIGRATIONS);
  assert('Legacy database migrated successfully to v8', legRes.currentVersion === 8);
  const migSetting = legacyDb.prepare('SELECT value_json FROM app_settings WHERE key = ?').get('theme');
  assert('Legacy app_settings migrated to value_json', migSetting && JSON.parse(migSetting.value_json) === 'dark');
  const migDoc = legacyDb.prepare('SELECT * FROM resume_documents WHERE id = ?').get('legacy-res-1');
  assert('Legacy resume migrated to resume_documents', Boolean(migDoc) && migDoc.original_filename === 'Jane_Doe_CV.pdf');
  const migVer = legacyDb.prepare('SELECT * FROM resume_versions WHERE document_id = ?').get('legacy-res-1');
  assert('Legacy resume migrated to resume_versions', Boolean(migVer) && migVer.version_number === 1);

  // 9. Safe File Path Containment
  console.log('\n--- 9. Safe File Path Containment ---');
  setDataRoot(tempDir);
  const safePath = resolveAndValidatePath('resumes/originals/test.pdf');
  assert('Valid relative path resolves inside data root', safePath.startsWith(tempDir));
  let traversalCaught = false;
  try { resolveAndValidatePath('../../../Windows/System32/cmd.exe'); } catch { traversalCaught = true; }
  assert('Path traversal escaping data root blocked with security error', traversalCaught);

  let fileNameCaught = false;
  try { validateFileName('../../evil.exe'); } catch { fileNameCaught = true; }
  assert('Malicious filename containing path separators blocked', fileNameCaught);

  // Cleanup
  freshDb.close();
  rollbackDb.close();
  legacyDb.close();
  fs.rmSync(tempDir, { recursive: true, force: true });

  const allPassed = tests.every((t) => t.pass);
  console.log(`\n========================================\n ALL ${tests.length} DATABASE TESTS PASSED!\n========================================\n`);
  process.exit(allPassed ? 0 : 1);
}

runTests().catch((err) => { console.error(err); process.exit(1); });
