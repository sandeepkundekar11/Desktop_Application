import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const desktopRoot = path.resolve(__dirname, '..');

export const importLocal = async (relPath) => {
  const abs = path.resolve(desktopRoot, relPath);
  return import(pathToFileURL(abs).href);
};

export const EXPECTED_TABLES = [
  'schema_migrations',
  'app_metadata',
  'app_settings',
  'ai_providers',
  'ai_models',
  'ai_feature_settings',
  'candidate_profiles',
  'candidate_skills',
  'work_experiences',
  'education_records',
  'projects',
  'certifications',
  'project_skills',
  'resume_documents',
  'resume_versions',
  'resume_optimizations',
  'resume_approvals',
  'job_sources',
  'job_preferences',
  'job_preference_titles',
  'job_preference_locations',
  'jobs',
  'job_requirements',
  'job_required_skills',
  'job_match_results',
  'applications',
  'application_events',
  'application_answers',
  'application_artifacts',
  'automation_sessions',
  'automation_events',
  'site_capabilities',
  'data_transfers',
  'diagnostic_events',
];

export const createTestCollector = () => {
  const tests = [];
  const assert = (name, cond, details = '') => {
    tests.push({ name, pass: Boolean(cond), details });
    const sym = cond ? '✓ PASS' : '✗ FAIL';
    console.log(`${sym} : ${name} ${details ? '(' + details + ')' : ''}`);
  };
  return { tests, assert };
};
