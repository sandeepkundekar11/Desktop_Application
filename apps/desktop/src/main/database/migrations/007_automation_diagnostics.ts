import { DatabaseSync } from 'node:sqlite';
import { Migration } from '../types.js';

export const migration007: Migration = {
  version: 7,
  name: 'browser_automation_and_diagnostics',
  up: (db: DatabaseSync): void => {
    // 1. Automation Sessions table
    db.exec(`
      CREATE TABLE IF NOT EXISTS automation_sessions (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        error_code TEXT,
        summary TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE RESTRICT,
        FOREIGN KEY (source_id) REFERENCES job_sources(id) ON DELETE RESTRICT
      );
    `);

    // 2. Automation Events table
    db.exec(`
      CREATE TABLE IF NOT EXISTS automation_events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        message TEXT,
        details_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES automation_sessions(id) ON DELETE RESTRICT
      );
    `);

    // 3. Site Capabilities table
    db.exec(`
      CREATE TABLE IF NOT EXISTS site_capabilities (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        capability_key TEXT NOT NULL,
        supported INTEGER NOT NULL DEFAULT 0 CHECK (supported IN (0, 1)),
        verification_status TEXT NOT NULL DEFAULT 'unknown',
        notes TEXT,
        last_verified_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (source_id) REFERENCES job_sources(id) ON DELETE RESTRICT,
        UNIQUE (source_id, capability_key)
      );
    `);

    // 4. Data Transfers table
    db.exec(`
      CREATE TABLE IF NOT EXISTS data_transfers (
        id TEXT PRIMARY KEY,
        transfer_type TEXT NOT NULL,
        status TEXT NOT NULL,
        file_path TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        error_code TEXT,
        summary_json TEXT NOT NULL DEFAULT '{}'
      );
    `);

    // 5. Diagnostic Events table
    db.exec(`
      CREATE TABLE IF NOT EXISTS diagnostic_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        error_code TEXT,
        message TEXT,
        context_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );
    `);
  },
};
