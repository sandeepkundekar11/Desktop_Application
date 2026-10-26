import { DatabaseSync } from 'node:sqlite';
import { Migration } from '../types.js';

export const migration004: Migration = {
  version: 4,
  name: 'job_sources_and_preferences',
  up: (db: DatabaseSync): void => {
    // 1. Job Sources table
    db.exec(`
      CREATE TABLE IF NOT EXISTS job_sources (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        source_type TEXT NOT NULL,
        base_url TEXT,
        is_enabled INTEGER NOT NULL DEFAULT 0 CHECK (is_enabled IN (0, 1)),
        configuration_json TEXT NOT NULL DEFAULT '{}',
        last_sync_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // 2. Job Preferences table
    db.exec(`
      CREATE TABLE IF NOT EXISTS job_preferences (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        name TEXT NOT NULL,
        minimum_experience_months INTEGER CHECK (minimum_experience_months IS NULL OR minimum_experience_months >= 0),
        maximum_experience_months INTEGER CHECK (maximum_experience_months IS NULL OR maximum_experience_months >= 0),
        minimum_salary_minor INTEGER CHECK (minimum_salary_minor IS NULL OR minimum_salary_minor >= 0),
        maximum_salary_minor INTEGER CHECK (maximum_salary_minor IS NULL OR maximum_salary_minor >= 0),
        salary_currency TEXT,
        work_mode TEXT,
        employment_type TEXT,
        match_threshold INTEGER NOT NULL DEFAULT 80 CHECK (match_threshold >= 0 AND match_threshold <= 100),
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (profile_id) REFERENCES candidate_profiles(id) ON DELETE RESTRICT,
        CHECK (minimum_experience_months IS NULL OR maximum_experience_months IS NULL OR maximum_experience_months >= minimum_experience_months),
        CHECK (minimum_salary_minor IS NULL OR maximum_salary_minor IS NULL OR maximum_salary_minor >= minimum_salary_minor)
      );
    `);

    // 3. Job Preference Titles table
    db.exec(`
      CREATE TABLE IF NOT EXISTS job_preference_titles (
        id TEXT PRIMARY KEY,
        preference_id TEXT NOT NULL,
        title TEXT NOT NULL,
        normalized_title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (preference_id) REFERENCES job_preferences(id) ON DELETE CASCADE,
        UNIQUE (preference_id, normalized_title)
      );
    `);

    // 4. Job Preference Locations table
    db.exec(`
      CREATE TABLE IF NOT EXISTS job_preference_locations (
        id TEXT PRIMARY KEY,
        preference_id TEXT NOT NULL,
        location TEXT NOT NULL,
        normalized_location TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (preference_id) REFERENCES job_preferences(id) ON DELETE CASCADE,
        UNIQUE (preference_id, normalized_location)
      );
    `);
  },
};
