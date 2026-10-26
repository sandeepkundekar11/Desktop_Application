import { DatabaseSync } from 'node:sqlite';
import { Migration } from '../types.js';

export const migration008: Migration = {
  version: 8,
  name: 'required_performance_and_constraint_indexes',
  up: (db: DatabaseSync): void => {
    // 1. Candidate profile indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_candidate_skills_profile ON candidate_skills(profile_id);
      CREATE INDEX IF NOT EXISTS idx_work_experiences_profile ON work_experiences(profile_id);
      CREATE INDEX IF NOT EXISTS idx_education_records_profile ON education_records(profile_id);
      CREATE INDEX IF NOT EXISTS idx_projects_profile ON projects(profile_id);
      CREATE INDEX IF NOT EXISTS idx_certifications_profile ON certifications(profile_id);
    `);

    // 2. Resume document & version indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_resume_documents_profile ON resume_documents(profile_id);
      CREATE INDEX IF NOT EXISTS idx_resume_versions_doc_ver ON resume_versions(document_id, version_number);
      CREATE INDEX IF NOT EXISTS idx_resume_versions_source_job ON resume_versions(source_job_id);
    `);

    // 3. Job preference indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_job_pref_titles_pref ON job_preference_titles(preference_id);
      CREATE INDEX IF NOT EXISTS idx_job_pref_locs_pref ON job_preference_locations(preference_id);
    `);

    // 4. Job discovery and matching indexes
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_source_external
        ON jobs(source_id, external_job_id)
        WHERE external_job_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_jobs_status_discovered ON jobs(job_status, discovered_at);
      CREATE INDEX IF NOT EXISTS idx_job_match_pref_score ON job_match_results(preference_id, score);
      CREATE INDEX IF NOT EXISTS idx_job_match_job_matched ON job_match_results(job_id, matched_at);
    `);

    // 5. Application and history indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_applications_status_updated ON applications(status, updated_at);
      CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id);
      CREATE INDEX IF NOT EXISTS idx_application_events_app_created ON application_events(application_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_application_answers_app ON application_answers(application_id);
      CREATE INDEX IF NOT EXISTS idx_application_artifacts_app ON application_artifacts(application_id);
    `);

    // 6. Automation and diagnostics indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_automation_sessions_app_started ON automation_sessions(application_id, started_at);
      CREATE INDEX IF NOT EXISTS idx_automation_events_session_created ON automation_events(session_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_site_capabilities_source ON site_capabilities(source_id);
    `);
  },
};
