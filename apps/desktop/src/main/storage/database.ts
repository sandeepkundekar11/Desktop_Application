import { DatabaseSync } from 'node:sqlite';
import { getStorageLocations, ensureDirectoryExists } from './paths.js';
import { AllowlistedSettingKey, StorageStatus } from './types.js';

let dbInstance: DatabaseSync | null = null;
const CURRENT_SCHEMA_VERSION = 1;

export const initDatabase = (): DatabaseSync => {
  if (dbInstance) {
    return dbInstance;
  }

  const locations = getStorageLocations();
  ensureDirectoryExists(locations.databaseDir);

  const db = new DatabaseSync(locations.databasePath);

  // Enable foreign keys and WAL mode for reliability
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');

  // Run initialization migrations
  runMigrations(db);

  dbInstance = db;
  return db;
};

const runMigrations = (db: DatabaseSync): void => {
  // Metadata table for migrations and schema tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS storage_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Application settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Verify / initialize schema version record
  const versionQuery = db.prepare('SELECT value FROM storage_metadata WHERE key = ?');
  const existingVersion = versionQuery.get('schema_version') as { value: string } | undefined;

  if (!existingVersion) {
    const insertVersion = db.prepare('INSERT INTO storage_metadata (key, value) VALUES (?, ?)');
    insertVersion.run('schema_version', String(CURRENT_SCHEMA_VERSION));
    insertVersion.run('initialized_at', new Date().toISOString());
  }
};

export const getAppSetting = (key: AllowlistedSettingKey): string | null => {
  const db = initDatabase();
  const query = db.prepare('SELECT value FROM app_settings WHERE key = ?');
  const row = query.get(key) as { value: string } | undefined;
  return row ? row.value : null;
};

export const setAppSetting = (key: AllowlistedSettingKey, value: string): void => {
  const db = initDatabase();
  const now = new Date().toISOString();
  const upsert = db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at;
  `);
  upsert.run(key, value, now);
};

export const getStorageStatus = (): StorageStatus => {
  const locations = getStorageLocations();
  const db = initDatabase();

  const versionQuery = db.prepare('SELECT value FROM storage_metadata WHERE key = ?');
  const versionRow = versionQuery.get('schema_version') as { value: string } | undefined;

  return {
    isInitialized: true,
    databasePath: locations.databasePath,
    schemaVersion: versionRow ? Number(versionRow.value) : CURRENT_SCHEMA_VERSION,
  };
};

export const closeDatabase = (): void => {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // Ignore error during cleanup
    }
    dbInstance = null;
  }
};
