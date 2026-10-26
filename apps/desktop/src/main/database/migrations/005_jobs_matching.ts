import { DatabaseSync } from 'node:sqlite';
import { Migration } from '../types.js';

export const migration005: Migration = {
  version: 5,
  name: 'jobs_and_matching_records',
  up: (db: DatabaseSync): void => {
    // 1. Jobs table
    db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        external_job_id TEXT,
        title TEXT NOT NULL,
        normalized_title TEXT NOT NULL,
        company_name TEXT,
        location TEXT,
        work_mode TEXT,
        employment_type TEXT,
        job_url TEXT NOT NULL,
        description TEXT,
        description_hash TEXT,
        minimum_salary_minor INTEGER CHECK (minimum_salary_minor IS NULL OR minimum_salary_minor >= 0),
        maximum_salary_minor INTEGER CHECK (maximum_salary_minor IS NULL OR maximum_salary_minor >= 0),
        salary_currency TEXT,
        experience_min_months INTEGER CHECK (experience_min_months IS NULL OR experience_min_months >= 0),
        experience_max_months INTEGER CHECK (experience_max_months IS NULL OR experience_max_months >= 0),
        posted_at TEXT,
        discovered_at TEXT NOT NULL,
        last_seen_at TEXT,
        job_status TEXT NOT NULL DEFAULT 'active',
        source_metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (source_id) REFERENCES job_sources(id) ON DELETE RESTRICT,
        CHECK (minimum_salary_minor IS NULL OR maximum_salary_minor IS NULL OR maximum_salary_minor >= minimum_salary_minor),
        CHECK (experience_min_months IS NULL OR experience_max_months IS NULL OR experience_max_months >= experience_min_months)
      );
    `);

    // 2. Job Requirements table
    db.exec(`
      CREATE TABLE IF NOT EXISTS job_requirements (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        requirement_type TEXT NOT NULL,
        requirement_text TEXT NOT NULL,
        is_mandatory INTEGER NOT NULL DEFAULT 0 CHECK (is_mandatory IN (0, 1)),
        source_type TEXT NOT NULL DEFAULT 'description',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
      );
    `);

    // 3. Job Required Skills composite table
    db.exec(`
      CREATE TABLE IF NOT EXISTS job_required_skills (
        job_id TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        importance INTEGER NOT NULL DEFAULT 1 CHECK (importance >= 1 AND importance <= 5),
        created_at TEXT NOT NULL,
        PRIMARY KEY (job_id, skill_id),
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
        FOREIGN KEY (skill_id) REFERENCES candidate_skills(id) ON DELETE RESTRICT
      );
    `);

    // 4. Job Match Results table
    db.exec(`
      CREATE TABLE IF NOT EXISTS job_match_results (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        preference_id TEXT NOT NULL,
        candidate_profile_id TEXT NOT NULL,
        score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
        matched_skills_json TEXT NOT NULL DEFAULT '[]',
        missing_skills_json TEXT NOT NULL DEFAULT '[]',
        reasons_json TEXT NOT NULL DEFAULT '[]',
        scoring_version TEXT NOT NULL,
        is_qualified INTEGER NOT NULL DEFAULT 0 CHECK (is_qualified IN (0, 1)),
        matched_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE RESTRICT,
        FOREIGN KEY (preference_id) REFERENCES job_preferences(id) ON DELETE RESTRICT,
        FOREIGN KEY (candidate_profile_id) REFERENCES candidate_profiles(id) ON DELETE RESTRICT
      );
    `);
  },
};
