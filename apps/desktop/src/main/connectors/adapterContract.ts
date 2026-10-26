import { Job, validateJob } from '../storage/jobSchema.js';
import { ConnectorId } from '../storage/connectorSchema.js';

export type AdapterAccessType = 'http_api' | 'feed' | 'browser_automation' | 'hybrid';

export type AdapterErrorKind =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'HTTP_ERROR'
  | 'AUTH_REQUIRED'
  | 'RATE_LIMITED'
  | 'PARSER_ERROR'
  | 'ACCESS_DENIED'
  | 'INVALID_RESPONSE'
  | 'UNKNOWN';

export interface AdapterError {
  readonly kind: AdapterErrorKind;
  readonly message: string;
  readonly statusCode?: number;
  readonly retryable: boolean;
  readonly cause?: unknown;
}

export interface AdapterQueryOptions {
  readonly keywords?: readonly string[];
  readonly locationPreference?: string;
  readonly workplaceType?: 'remote' | 'hybrid' | 'on_site' | 'any';
  readonly limit?: number;
  readonly continuationToken?: string | null;
  readonly page?: number;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

export interface NormalizationContext {
  readonly collectionTimestamp: Date;
  readonly sourceId: string;
  readonly defaultWorkplaceType?: 'remote' | 'hybrid' | 'on_site';
}

export type JobNormalizationResult =
  | { readonly success: true; readonly job: Job }
  | { readonly success: false; readonly errors: readonly string[]; readonly rawRecord?: unknown };

export interface AdapterBatchSuccess {
  readonly success: true;
  readonly sourceId: string;
  readonly jobs: readonly Job[];
  readonly rawCount: number;
  readonly validCount: number;
  readonly skippedCount: number;
  readonly nextContinuationToken?: string | null;
  readonly hasMore: boolean;
  readonly fetchedAt: string;
}

export interface AdapterBatchFailure {
  readonly success: false;
  readonly sourceId: string;
  readonly error: AdapterError;
  readonly fetchedAt: string;
}

export type AdapterBatchResult = AdapterBatchSuccess | AdapterBatchFailure;

export interface JobSourceAdapter {
  readonly sourceId: ConnectorId | string;
  readonly displayName: string;
  readonly accessType: AdapterAccessType;
  readonly isConfigured: (settings: unknown) => boolean;
  readonly fetchBatch: (options: AdapterQueryOptions) => Promise<AdapterBatchResult>;
  readonly normalizeRecord: (rawRecord: unknown, context: NormalizationContext) => JobNormalizationResult;
}

export const createAdapterSuccessResult = (params: {
  readonly sourceId: string;
  readonly jobs: readonly Job[];
  readonly rawCount: number;
  readonly skippedCount: number;
  readonly nextContinuationToken?: string | null;
  readonly hasMore?: boolean;
  readonly fetchedAt?: string;
}): AdapterBatchSuccess => ({
  success: true,
  sourceId: params.sourceId,
  jobs: params.jobs,
  rawCount: params.rawCount,
  validCount: params.jobs.length,
  skippedCount: params.skippedCount,
  nextContinuationToken: params.nextContinuationToken ?? null,
  hasMore: params.hasMore ?? Boolean(params.nextContinuationToken),
  fetchedAt: params.fetchedAt ?? new Date().toISOString(),
});

export const createAdapterFailureResult = (params: {
  readonly sourceId: string;
  readonly error: AdapterError;
  readonly fetchedAt?: string;
}): AdapterBatchFailure => ({
  success: false,
  sourceId: params.sourceId,
  error: params.error,
  fetchedAt: params.fetchedAt ?? new Date().toISOString(),
});

export const createNormalizationSuccess = (job: Job): JobNormalizationResult => ({
  success: true,
  job,
});

export const createNormalizationFailure = (
  errors: readonly string[],
  rawRecord?: unknown
): JobNormalizationResult => ({
  success: false,
  errors,
  rawRecord,
});

export const isAdapterBatchSuccess = (
  result: AdapterBatchResult
): result is AdapterBatchSuccess => {
  return result && typeof result === 'object' && result.success === true;
};

export const isAdapterBatchFailure = (
  result: AdapterBatchResult
): result is AdapterBatchFailure => {
  return result && typeof result === 'object' && result.success === false;
};

export const isJobSourceAdapter = (val: unknown): val is JobSourceAdapter => {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
  const a = val as Record<string, unknown>;
  return (
    typeof a.sourceId === 'string' &&
    a.sourceId.trim().length > 0 &&
    typeof a.displayName === 'string' &&
    typeof a.accessType === 'string' &&
    ['http_api', 'feed', 'browser_automation', 'hybrid'].includes(a.accessType) &&
    typeof a.isConfigured === 'function' &&
    typeof a.fetchBatch === 'function' &&
    typeof a.normalizeRecord === 'function'
  );
};
