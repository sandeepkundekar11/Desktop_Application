import { DatabaseSync } from 'node:sqlite';
import { Migration } from '../types.js';

export const migration001: Migration = {
  version: 1,
  name: 'core_metadata_and_ai_configuration',
  up: (db: DatabaseSync): void => {
    // 1. Schema Migrations table
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        migration_name TEXT NOT NULL,
        checksum TEXT,
        applied_at TEXT NOT NULL
      );
    `);

    // 2. Application Metadata table
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Migrate legacy storage_metadata if present
    try {
      const legacyMeta = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='storage_metadata'").get();
      if (legacyMeta) {
        const rows = db.prepare('SELECT key, value FROM storage_metadata').all() as unknown as { key: string; value: string }[];
        const insertMeta = db.prepare(`
          INSERT INTO app_metadata (key, value, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        `);
        const now = new Date().toISOString();
        for (const row of rows) {
          insertMeta.run(row.key, row.value, now);
        }
      }
    } catch {
      // Ignore if legacy table not accessible
    }

    // 3. Application Settings table
    // Check if legacy app_settings exists with column 'value' instead of 'value_json'
    const tableInfo = db.prepare("PRAGMA table_info('app_settings')").all() as unknown as { name: string }[];
    const hasValueColumn = tableInfo.some((col) => col.name === 'value');
    const hasValueJsonColumn = tableInfo.some((col) => col.name === 'value_json');

    if (tableInfo.length > 0 && hasValueColumn && !hasValueJsonColumn) {
      // Rename legacy table and migrate data
      db.exec('ALTER TABLE app_settings RENAME TO legacy_app_settings;');
      db.exec(`
        CREATE TABLE app_settings (
          key TEXT PRIMARY KEY,
          value_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      const legacyRows = db.prepare('SELECT key, value, updated_at FROM legacy_app_settings').all() as unknown as { key: string; value: string; updated_at: string }[];
      const insertSetting = db.prepare('INSERT INTO app_settings (key, value_json, updated_at) VALUES (?, ?, ?)');
      for (const row of legacyRows) {
        let valueJson: string;
        try {
          JSON.parse(row.value);
          valueJson = row.value;
        } catch {
          valueJson = JSON.stringify(row.value);
        }
        insertSetting.run(row.key, valueJson, row.updated_at);
      }
      db.exec('DROP TABLE legacy_app_settings;');
    } else {
      db.exec(`
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
    }

    // 4. AI Providers table
    db.exec(`
      CREATE TABLE IF NOT EXISTS ai_providers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        provider_type TEXT NOT NULL,
        base_url TEXT,
        auth_type TEXT NOT NULL DEFAULT 'api_key',
        credential_reference TEXT,
        is_enabled INTEGER NOT NULL DEFAULT 0 CHECK (is_enabled IN (0, 1)),
        configuration_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // 5. AI Models table
    db.exec(`
      CREATE TABLE IF NOT EXISTS ai_models (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        model_id TEXT NOT NULL,
        display_name TEXT,
        capabilities_json TEXT NOT NULL DEFAULT '[]',
        model_configuration_json TEXT NOT NULL DEFAULT '{}',
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (provider_id) REFERENCES ai_providers(id) ON DELETE RESTRICT,
        UNIQUE (provider_id, model_id)
      );
    `);

    // 6. AI Feature Settings table
    db.exec(`
      CREATE TABLE IF NOT EXISTS ai_feature_settings (
        id TEXT PRIMARY KEY,
        feature_key TEXT NOT NULL UNIQUE,
        model_id TEXT,
        is_enabled INTEGER NOT NULL DEFAULT 0 CHECK (is_enabled IN (0, 1)),
        configuration_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (model_id) REFERENCES ai_models(id) ON DELETE RESTRICT
      );
    `);
  },
};
