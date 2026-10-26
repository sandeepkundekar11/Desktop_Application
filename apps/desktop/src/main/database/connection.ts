import { DatabaseSync } from 'node:sqlite';
import { getStorageLocations, ensureDirectoryExists } from '../storage/paths.js';
import { runDatabaseMigrations } from './migrationRunner.js';

let dbInstance: DatabaseSync | null = null;

export const openDatabaseConnection = (customDbPath?: string): DatabaseSync => {
  if (dbInstance && !customDbPath) {
    return dbInstance;
  }

  const locations = getStorageLocations();
  const dbPath = customDbPath || locations.databasePath;
  ensureDirectoryExists(locations.databaseDir);

  const db = new DatabaseSync(dbPath);

  // Enforce schema-wide conventions: foreign keys enabled and WAL journal mode
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');

  // Run all migrations safely
  runDatabaseMigrations(db);

  if (!customDbPath) {
    dbInstance = db;
  }

  return db;
};

export const getDatabaseInstance = (): DatabaseSync => {
  if (!dbInstance) {
    return openDatabaseConnection();
  }
  return dbInstance;
};

export const closeDatabaseConnection = (): void => {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // Ignore error during cleanup
    }
    dbInstance = null;
  }
};
