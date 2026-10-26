import { DatabaseSync } from 'node:sqlite';
import { Migration } from '../types.js';

export const migration006: Migration = {
  version: 6,
  name: 'applications_and_submission_history',
  up: (db: DatabaseSync): void => {
    // 1. Applications table
    db.exec(`
      CREATE TABLE IF NOT EXISTS applications (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        candidate_profile_id TEXT NOT NULL,
        resume_version_id TEXT,
        status TEXT NOT NULL,
        application_url TEXT,
        started_at TEXT,
        submitted_at TEXT,
        submission_verified_at TEXT,
        external_application_id TEXT,
        failure_code TEXT,
        failure_message TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE RESTRICT,
        FOREIGN KEY (candidate_profile_id) REFERENCES candidate_profiles(id) ON DELETE RESTRICT,
        FOREIGN KEY (resume_version_id) REFERENCES resume_versions(id) ON DELETE RESTRICT
      );
    `);

    // 2. Application Events append-only table
    db.exec(`
      CREATE TABLE IF NOT EXISTS application_events (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        message TEXT,
        details_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE RESTRICT
      );
    `);

    // 3. Application Answers table
    db.exec(`
      CREATE TABLE IF NOT EXISTS application_answers (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL,
        question_text TEXT NOT NULL,
        question_key TEXT,
        answer_text TEXT,
        answer_source TEXT NOT NULL,
        confidence REAL CHECK (confidence IS NULL OR (confidence >= 0.0 AND confidence <= 1.0)),
        review_status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE RESTRICT
      );
    `);

    // 4. Application Artifacts table
    db.exec(`
      CREATE TABLE IF NOT EXISTS application_artifacts (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL,
        artifact_type TEXT NOT NULL,
        relative_file_path TEXT NOT NULL,
        file_hash TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE RESTRICT
      );
    `);
  },
};
