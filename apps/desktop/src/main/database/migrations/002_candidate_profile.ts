import { DatabaseSync } from 'node:sqlite';
import { Migration } from '../types.js';

export const migration002: Migration = {
  version: 2,
  name: 'candidate_profile_and_history',
  up: (db: DatabaseSync): void => {
    // 1. Candidate Profiles table
    db.exec(`
      CREATE TABLE IF NOT EXISTS candidate_profiles (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        location TEXT,
        country_code TEXT,
        linkedin_url TEXT,
        portfolio_url TEXT,
        github_url TEXT,
        professional_summary TEXT,
        current_title TEXT,
        total_experience_months INTEGER CHECK (total_experience_months IS NULL OR total_experience_months >= 0),
        profile_data_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Ensure default candidate profile exists for local single-user default context
    const existingDefault = db.prepare("SELECT id FROM candidate_profiles WHERE id = 'default-profile'").get();
    if (!existingDefault) {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO candidate_profiles (
          id, full_name, professional_summary, profile_data_json, created_at, updated_at
        ) VALUES ('default-profile', 'Primary Candidate', 'Local profile for uploaded resumes and job applications', '{}', ?, ?)
      `).run(now, now);
    }

    // 2. Candidate Skills table
    db.exec(`
      CREATE TABLE IF NOT EXISTS candidate_skills (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        name TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        category TEXT,
        proficiency_level TEXT,
        years_used REAL CHECK (years_used IS NULL OR years_used >= 0),
        source_type TEXT NOT NULL DEFAULT 'user',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (profile_id) REFERENCES candidate_profiles(id) ON DELETE CASCADE,
        UNIQUE (profile_id, normalized_name)
      );
    `);

    // 3. Work Experiences table
    db.exec(`
      CREATE TABLE IF NOT EXISTS work_experiences (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        company_name TEXT NOT NULL,
        job_title TEXT NOT NULL,
        employment_type TEXT,
        location TEXT,
        start_date TEXT NOT NULL,
        end_date TEXT,
        is_current INTEGER NOT NULL DEFAULT 0 CHECK (is_current IN (0, 1)),
        description TEXT,
        achievements_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (profile_id) REFERENCES candidate_profiles(id) ON DELETE CASCADE,
        CHECK (end_date IS NULL OR end_date >= start_date),
        CHECK (NOT (is_current = 1 AND end_date IS NOT NULL))
      );
    `);

    // 4. Education Records table
    db.exec(`
      CREATE TABLE IF NOT EXISTS education_records (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        institution TEXT NOT NULL,
        degree TEXT,
        field_of_study TEXT,
        location TEXT,
        start_date TEXT,
        end_date TEXT,
        grade TEXT,
        description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (profile_id) REFERENCES candidate_profiles(id) ON DELETE CASCADE,
        CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date)
      );
    `);

    // 5. Projects table
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        project_url TEXT,
        repository_url TEXT,
        start_date TEXT,
        end_date TEXT,
        technologies_json TEXT NOT NULL DEFAULT '[]',
        achievements_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (profile_id) REFERENCES candidate_profiles(id) ON DELETE CASCADE,
        CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date)
      );
    `);

    // 6. Certifications table
    db.exec(`
      CREATE TABLE IF NOT EXISTS certifications (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        name TEXT NOT NULL,
        issuer TEXT,
        credential_id TEXT,
        credential_url TEXT,
        issue_date TEXT,
        expiry_date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (profile_id) REFERENCES candidate_profiles(id) ON DELETE CASCADE,
        CHECK (issue_date IS NULL OR expiry_date IS NULL OR expiry_date >= issue_date)
      );
    `);

    // 7. Project Skills composite link table
    db.exec(`
      CREATE TABLE IF NOT EXISTS project_skills (
        project_id TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (project_id, skill_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (skill_id) REFERENCES candidate_skills(id) ON DELETE CASCADE
      );
    `);
  },
};
