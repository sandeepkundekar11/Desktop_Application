import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { Migration, AppliedMigrationRecord } from './types.js';
import { ALL_MIGRATIONS } from './migrations/index.js';

export const computeMigrationChecksum = (migration: Migration): string => {
  const content = `${migration.version}:${migration.name}:${migration.up.toString()}`;
  return crypto.createHash('sha256').update(content).digest('hex');
};

const ensureMigrationsTable = (db: DatabaseSync): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      migration_name TEXT NOT NULL,
      checksum TEXT,
      applied_at TEXT NOT NULL
    );
  `);
};

export const getAppliedMigrations = (db: DatabaseSync): readonly AppliedMigrationRecord[] => {
  ensureMigrationsTable(db);
  const rows = db.prepare('SELECT * FROM schema_migrations ORDER BY version ASC').all() as unknown as AppliedMigrationRecord[];
  return rows;
};

export const runDatabaseMigrations = (
  db: DatabaseSync,
  migrations: readonly Migration[] = ALL_MIGRATIONS
): { appliedCount: number; currentVersion: number } => {
  ensureMigrationsTable(db);

  // 1. Validate migrations are strictly ordered and distinct
  for (let i = 0; i < migrations.length; i++) {
    const cur = migrations[i];
    if (!cur) continue;
    if (cur.version !== i + 1) {
      throw new Error(`Migration versions must be strictly ordered 1..N. Found version ${cur.version} at index ${i}`);
    }
  }

  // 2. Fetch already applied migrations
  const applied = getAppliedMigrations(db);
  const appliedMap = new Map<number, AppliedMigrationRecord>();
  for (const m of applied) {
    appliedMap.set(m.version, m);
  }

  let appliedCount = 0;

  // 3. Process each migration in strict sequence
  for (const migration of migrations) {
    const checksum = computeMigrationChecksum(migration);
    const existing = appliedMap.get(migration.version);

    if (existing) {
      // Checksum validation
      if (existing.checksum && existing.checksum !== checksum) {
        throw new Error(
          `Checksum mismatch for applied migration v${migration.version} (${migration.name}). Expected: ${existing.checksum}, Actual: ${checksum}`
        );
      }
      continue;
    }

    // Apply migration inside an isolated transaction
    db.exec('BEGIN IMMEDIATE TRANSACTION;');
    try {
      migration.up(db);

      const now = new Date().toISOString();
      const insertRecord = db.prepare(`
        INSERT INTO schema_migrations (version, migration_name, checksum, applied_at)
        VALUES (?, ?, ?, ?)
      `);
      insertRecord.run(migration.version, migration.name, checksum, now);

      db.exec('COMMIT;');
      appliedCount++;
    } catch (err) {
      try {
        db.exec('ROLLBACK;');
      } catch {
        // Ignore rollback failure if transaction already terminated
      }
      throw new Error(`Migration v${migration.version} (${migration.name}) failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const latest = getAppliedMigrations(db);
  const currentVersion = latest.length > 0 ? latest[latest.length - 1]!.version : 0;

  return { appliedCount, currentVersion };
};
