import { Migration } from '../types.js';
import { migration001 } from './001_core_metadata.js';
import { migration002 } from './002_candidate_profile.js';
import { migration003 } from './003_resume_documents.js';
import { migration004 } from './004_job_preferences.js';
import { migration005 } from './005_jobs_matching.js';
import { migration006 } from './006_applications.js';
import { migration007 } from './007_automation_diagnostics.js';
import { migration008 } from './008_indexes.js';

export const ALL_MIGRATIONS: readonly Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
  migration008,
];
