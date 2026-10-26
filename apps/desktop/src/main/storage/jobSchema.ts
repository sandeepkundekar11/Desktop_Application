import { hasSensitiveKeys } from './connectorSchema.js';

export type EmploymentType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'internship'
  | 'temporary'
  | 'other';

export type WorkplaceType = 'remote' | 'hybrid' | 'on_site';

export type SalaryPeriod = 'hourly' | 'monthly' | 'yearly';

export interface JobLocation {
  readonly city: string | null;
  readonly state: string | null;
  readonly country: string | null;
  readonly rawLocation: string;
}

export interface JobRelocation {
  readonly offered: boolean | null;
  readonly details: string | null;
}

export interface JobSalary {
  readonly min: number | null;
  readonly max: number | null;
  readonly currency: string | null;
  readonly period: SalaryPeriod | null;
  readonly isEstimated?: boolean;
}

export interface JobExperience {
  readonly minYears: number | null;
  readonly maxYears: number | null;
  readonly rawText?: string | null;
}

export interface JobQualifications {
  readonly requiredSkills: readonly string[];
  readonly preferredSkills: readonly string[];
  readonly requiredQualifications: readonly string[];
  readonly preferredQualifications: readonly string[];
  readonly sourceEvidence: readonly string[];
}

export interface JobMatchSummary {
  readonly score: number;
  readonly breakdown?: Readonly<Record<string, number>>;
  readonly evaluatedAt?: string;
}

export interface Job {
  readonly id: string;
  readonly source: string;
  readonly sourceJobId: string | null;
  readonly title: string;
  readonly company: string;
  readonly jobUrl: string;
  readonly applyUrl: string | null;
  readonly description: string | null;
  readonly employmentType: EmploymentType | null;
  readonly location: JobLocation | null;
  readonly workplaceType: WorkplaceType | null;
  readonly relocation: JobRelocation | null;
  readonly postedAt: string | null;
  readonly collectedAt: string;
  readonly collectionDate: string;
  readonly qualifications: JobQualifications;
  readonly experience: JobExperience | null;
  readonly salary: JobSalary | null;
  readonly match?: JobMatchSummary;
  readonly sourceMetadata?: Readonly<Record<string, unknown>>;
}

export interface JobValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export const isValidUrl = (url: unknown): boolean => {
  if (typeof url !== 'string' || url.trim().length === 0) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/i;

export const isValidIsoDate = (dateStr: unknown): boolean => {
  if (typeof dateStr !== 'string' || dateStr.trim().length === 0) return false;
  const trimmed = dateStr.trim();
  if (!ISO_DATE_PATTERN.test(trimmed)) return false;
  const ts = Date.parse(trimmed);
  return !Number.isNaN(ts);
};

export const isValidDatePartition = (dateStr: unknown): boolean => {
  return typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && isValidIsoDate(dateStr);
};

export const createDefaultQualifications = (): JobQualifications => ({
  requiredSkills: [],
  preferredSkills: [],
  requiredQualifications: [],
  preferredQualifications: [],
  sourceEvidence: [],
});

export const validateJob = (candidate: unknown): JobValidationResult => {
  const errors: string[] = [];

  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return { valid: false, errors: ['Job payload must be a non-null object.'] };
  }

  const j = candidate as Record<string, unknown>;

  // 1. Mandatory Identity & Source
  if (typeof j.id !== 'string' || j.id.trim().length === 0) {
    errors.push('id must be a non-empty string.');
  }

  if (typeof j.source !== 'string' || j.source.trim().length === 0) {
    errors.push('source must be a non-empty string.');
  }

  if (j.sourceJobId !== undefined && j.sourceJobId !== null && typeof j.sourceJobId !== 'string') {
    errors.push('sourceJobId must be a string or null.');
  }

  // 2. Mandatory Core Titles
  if (typeof j.title !== 'string' || j.title.trim().length === 0) {
    errors.push('title must be a non-empty string.');
  }

  if (typeof j.company !== 'string' || j.company.trim().length === 0) {
    errors.push('company must be a non-empty string.');
  }

  // 3. URLs
  if (!isValidUrl(j.jobUrl)) {
    errors.push(`jobUrl must be a valid http or https URL. Received: "${String(j.jobUrl)}"`);
  }

  if (j.applyUrl !== undefined && j.applyUrl !== null && !isValidUrl(j.applyUrl)) {
    errors.push(`applyUrl must be a valid http or https URL when present. Received: "${String(j.applyUrl)}"`);
  }

  // 4. Timestamps
  if (j.postedAt !== undefined && j.postedAt !== null && !isValidIsoDate(j.postedAt)) {
    errors.push(`postedAt must be a valid ISO 8601 date string when present. Received: "${String(j.postedAt)}"`);
  }

  if (!isValidIsoDate(j.collectedAt)) {
    errors.push(`collectedAt must be a valid ISO 8601 date string. Received: "${String(j.collectedAt)}"`);
  }

  if (!isValidDatePartition(j.collectionDate)) {
    errors.push(`collectionDate must be a YYYY-MM-DD date partition. Received: "${String(j.collectionDate)}"`);
  }

  // 5. Experience Range
  if (j.experience !== undefined && j.experience !== null) {
    if (typeof j.experience !== 'object' || Array.isArray(j.experience)) {
      errors.push('experience must be an object when present.');
    } else {
      const exp = j.experience as Record<string, unknown>;
      const minYears = exp.minYears;
      const maxYears = exp.maxYears;

      if (minYears !== null && minYears !== undefined && (typeof minYears !== 'number' || minYears < 0)) {
        errors.push('experience.minYears must be null or a non-negative number.');
      }
      if (maxYears !== null && maxYears !== undefined && (typeof maxYears !== 'number' || maxYears < 0)) {
        errors.push('experience.maxYears must be null or a non-negative number.');
      }
      if (
        typeof minYears === 'number' &&
        typeof maxYears === 'number' &&
        minYears > maxYears
      ) {
        errors.push(`experience.minYears (${minYears}) cannot exceed experience.maxYears (${maxYears}).`);
      }
    }
  }

  // 6. Salary Range
  if (j.salary !== undefined && j.salary !== null) {
    if (typeof j.salary !== 'object' || Array.isArray(j.salary)) {
      errors.push('salary must be an object when present.');
    } else {
      const sal = j.salary as Record<string, unknown>;
      const min = sal.min;
      const max = sal.max;

      if (min !== null && min !== undefined && (typeof min !== 'number' || min < 0)) {
        errors.push('salary.min must be null or a non-negative number.');
      }
      if (max !== null && max !== undefined && (typeof max !== 'number' || max < 0)) {
        errors.push('salary.max must be null or a non-negative number.');
      }
      if (typeof min === 'number' && typeof max === 'number' && min > max) {
        errors.push(`salary.min (${min}) cannot exceed salary.max (${max}).`);
      }
      if (
        sal.period !== null &&
        sal.period !== undefined &&
        !['hourly', 'monthly', 'yearly'].includes(sal.period as string)
      ) {
        errors.push(`salary.period must be "hourly", "monthly", "yearly", or null. Received: "${String(sal.period)}"`);
      }
    }
  }

  // 7. Optional Match Score
  if (j.match !== undefined && j.match !== null) {
    if (typeof j.match !== 'object' || Array.isArray(j.match)) {
      errors.push('match must be an object when present.');
    } else {
      const m = j.match as Record<string, unknown>;
      if (typeof m.score !== 'number' || m.score < 0 || m.score > 100 || Number.isNaN(m.score)) {
        errors.push(`match.score must be a number between 0 and 100. Received: "${String(m.score)}"`);
      }
      if (m.evaluatedAt !== undefined && m.evaluatedAt !== null && !isValidIsoDate(m.evaluatedAt)) {
        errors.push(`match.evaluatedAt must be a valid ISO 8601 date string when present. Received: "${String(m.evaluatedAt)}"`);
      }
    }
  }

  // 8. Sensitive Keys Check on Source Metadata
  if (j.sourceMetadata !== undefined && j.sourceMetadata !== null) {
    if (typeof j.sourceMetadata !== 'object') {
      errors.push('sourceMetadata must be an object when present.');
    } else if (hasSensitiveKeys(j.sourceMetadata)) {
      errors.push('sourceMetadata contains disallowed sensitive keys.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const isJob = (candidate: unknown): candidate is Job => {
  return validateJob(candidate).valid;
};
