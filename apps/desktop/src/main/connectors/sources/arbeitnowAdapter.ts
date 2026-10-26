import {
  Job,
  EmploymentType,
  WorkplaceType,
  validateJob,
  isValidUrl,
  isValidIsoDate,
} from '../../storage/jobSchema.js';

export const ARBEITNOW_API_ENDPOINT = 'https://www.arbeitnow.com/api/job-board-api';
export const ARBEITNOW_ATTRIBUTION = 'Job listings sourced from Arbeitnow (https://www.arbeitnow.com)';

export type ArbeitnowErrorKind =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'HTTP_ERROR'
  | 'INVALID_RESPONSE_SHAPE'
  | 'PARSE_ERROR';

export interface ArbeitnowError {
  readonly kind: ArbeitnowErrorKind;
  readonly message: string;
  readonly statusCode?: number;
  readonly cause?: unknown;
}

export interface ArbeitnowFetchOptions {
  readonly endpoint?: string;
  readonly page?: number;
  readonly timeoutMs?: number;
  readonly fetchFn?: typeof fetch;
  readonly now?: () => Date;
}

export interface ArbeitnowFetchResult {
  readonly success: true;
  readonly jobs: readonly Job[];
  readonly totalFetched: number;
  readonly validCount: number;
  readonly invalidCount: number;
  readonly page: number;
  readonly hasNextPage: boolean;
  readonly attribution: string;
}

export type ArbeitnowResult =
  | ArbeitnowFetchResult
  | { readonly success: false; readonly error: ArbeitnowError };

export const parseEmploymentType = (jobTypes: unknown): EmploymentType | null => {
  if (!Array.isArray(jobTypes)) return null;
  const joined = jobTypes.filter((t): t is string => typeof t === 'string').join(' ').toLowerCase();
  if (joined.includes('full-time') || joined.includes('full time')) return 'full_time';
  if (joined.includes('part-time') || joined.includes('part time')) return 'part_time';
  if (joined.includes('contract') || joined.includes('freelance')) return 'contract';
  if (joined.includes('internship') || joined.includes('working student')) return 'internship';
  if (joined.includes('temporary') || joined.includes('seasonal')) return 'temporary';
  if (joined.length > 0) return 'other';
  return null;
};

export const parsePublicationDate = (createdAt: unknown): string | null => {
  if (typeof createdAt === 'number' && Number.isFinite(createdAt) && createdAt > 0) {
    // Detect seconds vs milliseconds
    const ms = createdAt < 1e11 ? createdAt * 1000 : createdAt;
    const date = new Date(ms);
    return !Number.isNaN(date.getTime()) ? date.toISOString() : null;
  }
  if (typeof createdAt === 'string' && isValidIsoDate(createdAt)) {
    return createdAt;
  }
  return null;
};

export const parseWorkplaceType = (remote: unknown, locationRaw?: string): WorkplaceType | null => {
  if (typeof remote === 'boolean') {
    if (remote) return 'remote';
    if (locationRaw && /hybrid/i.test(locationRaw)) return 'hybrid';
    return 'on_site';
  }
  if (locationRaw) {
    if (/remote/i.test(locationRaw)) return 'remote';
    if (/hybrid/i.test(locationRaw)) return 'hybrid';
    if (/on-site|onsite/i.test(locationRaw)) return 'on_site';
  }
  return null;
};

export const normalizeArbeitnowJob = (raw: unknown, collectionTimestamp: Date): Job | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const r = raw as Record<string, unknown>;

  const slug = typeof r.slug === 'string' && r.slug.trim().length > 0 ? r.slug.trim() : null;
  const title = typeof r.title === 'string' ? r.title.trim() : '';
  const company = typeof r.company_name === 'string' ? r.company_name.trim() : '';
  const url = typeof r.url === 'string' && isValidUrl(r.url) ? r.url.trim() : '';

  // Generate deterministic ID using slug or URL
  const rawId = slug || (url ? encodeURIComponent(url).slice(-40) : null);
  if (!rawId || !title || !company || !url) {
    return null;
  }

  const id = `arbeitnow_${rawId}`;
  const postedAt = parsePublicationDate(r.created_at);
  const collectedAt = collectionTimestamp.toISOString();
  const collectionDate = collectedAt.slice(0, 10);

  const rawLocation = typeof r.location === 'string' && r.location.trim().length > 0
    ? r.location.trim()
    : null;

  const location = rawLocation
    ? {
        city: null,
        state: null,
        country: null,
        rawLocation,
      }
    : null;

  const workplaceType = parseWorkplaceType(r.remote, rawLocation || undefined);
  const employmentType = parseEmploymentType(r.job_types);

  const tags = Array.isArray(r.tags)
    ? r.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim())
    : [];

  const qualifications = {
    requiredSkills: tags,
    preferredSkills: [],
    requiredQualifications: [],
    preferredQualifications: [],
    sourceEvidence: tags.length > 0 ? [`Arbeitnow listing tags: ${tags.join(', ')}`] : [],
  };

  const description = typeof r.description === 'string' && r.description.trim().length > 0
    ? r.description.trim()
    : null;

  const candidateJob: Job = {
    id,
    source: 'arbeitnow',
    sourceJobId: slug,
    title,
    company,
    jobUrl: url,
    applyUrl: null, // Arbeitnow direct apply URL is not separately distinguished from jobUrl
    description,
    employmentType,
    location,
    workplaceType,
    relocation: null,
    postedAt,
    collectedAt,
    collectionDate,
    qualifications,
    experience: null, // Not declared in Arbeitnow API payload; never fabricated
    salary: null,     // Not declared in Arbeitnow standard payload; never fabricated
    sourceMetadata: {
      provider: 'Arbeitnow Public API',
      attribution: ARBEITNOW_ATTRIBUTION,
      slug,
      rawJobTypes: Array.isArray(r.job_types) ? r.job_types : null,
    },
  };

  const validation = validateJob(candidateJob);
  if (!validation.valid) {
    return null;
  }

  return candidateJob;
};

export const fetchArbeitnowJobs = async (
  options?: ArbeitnowFetchOptions
): Promise<ArbeitnowResult> => {
  const endpointBase = options?.endpoint || ARBEITNOW_API_ENDPOINT;
  const timeoutMs = options?.timeoutMs ?? 10000;
  const customFetch = options?.fetchFn ?? fetch;
  const getNow = options?.now ?? (() => new Date());
  const page = options?.page && options.page > 0 ? options.page : 1;

  let requestUrl: URL;
  try {
    requestUrl = new URL(endpointBase);
    if (page > 1) {
      requestUrl.searchParams.set('page', String(page));
    }
  } catch (err) {
    return {
      success: false,
      error: {
        kind: 'INVALID_RESPONSE_SHAPE',
        message: `Invalid endpoint URL: "${endpointBase}"`,
        cause: err,
      },
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await customFetch(requestUrl.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ApplyPilot/0.1.0 (Desktop Job Discovery; contact@applypilot.local)',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        success: false,
        error: {
          kind: 'HTTP_ERROR',
          message: `Arbeitnow API returned HTTP ${response.status} (${response.statusText})`,
          statusCode: response.status,
        },
      };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (parseErr) {
      return {
        success: false,
        error: {
          kind: 'PARSE_ERROR',
          message: 'Failed to parse JSON response from Arbeitnow API.',
          cause: parseErr,
        },
      };
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return {
        success: false,
        error: {
          kind: 'INVALID_RESPONSE_SHAPE',
          message: 'Arbeitnow API response is not a valid JSON object.',
        },
      };
    }

    const root = payload as Record<string, unknown>;
    if (!Array.isArray(root.data)) {
      return {
        success: false,
        error: {
          kind: 'INVALID_RESPONSE_SHAPE',
          message: 'Arbeitnow API response is missing "data" array.',
        },
      };
    }

    const collectionTimestamp = getNow();
    const rawList = root.data;
    const validJobs: Job[] = [];
    let invalidCount = 0;

    for (const rawItem of rawList) {
      const normalized = normalizeArbeitnowJob(rawItem, collectionTimestamp);
      if (normalized) {
        validJobs.push(normalized);
      } else {
        invalidCount++;
      }
    }

    const links = (root.links && typeof root.links === 'object' ? root.links : {}) as Record<string, unknown>;
    const hasNextPage = typeof links.next === 'string' && links.next.length > 0;

    return {
      success: true,
      jobs: validJobs,
      totalFetched: rawList.length,
      validCount: validJobs.length,
      invalidCount,
      page,
      hasNextPage,
      attribution: ARBEITNOW_ATTRIBUTION,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        success: false,
        error: {
          kind: 'TIMEOUT',
          message: `Arbeitnow API request timed out after ${timeoutMs}ms.`,
          cause: err,
        },
      };
    }

    return {
      success: false,
      error: {
        kind: 'NETWORK_ERROR',
        message: `Arbeitnow network request failed: ${err instanceof Error ? err.message : String(err)}`,
        cause: err,
      },
    };
  } finally {
    clearTimeout(timer);
  }
};
