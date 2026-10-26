import {
  navigateAndExtract,
  MinimalBrowserPage,
  BrowserSessionOptions,
  BrowserLauncher,
  BrowserEngineError,
} from '../automation/browserEngine.js';
import {
  JobSourceAdapter,
  AdapterQueryOptions,
  AdapterBatchResult,
  NormalizationContext,
  JobNormalizationResult,
  AdapterError,
  createAdapterSuccessResult,
  createAdapterFailureResult,
} from './adapterContract.js';
import { Job, validateJob } from '../storage/jobSchema.js';
import { ConnectorId } from '../storage/connectorSchema.js';

export interface BrowserAdapterConfig<TRaw = unknown> {
  readonly sourceId: ConnectorId | string;
  readonly displayName: string;
  readonly isConfigured?: (settings: unknown) => boolean;
  readonly buildUrl: (options: AdapterQueryOptions) => string;
  readonly extractRecords: (page: MinimalBrowserPage, options: AdapterQueryOptions) => Promise<readonly TRaw[]>;
  readonly normalizeRecord: (rawRecord: TRaw, context: NormalizationContext) => JobNormalizationResult;
  readonly defaultWorkplaceType?: 'remote' | 'hybrid' | 'on_site';
  readonly launcher?: BrowserLauncher;
  readonly sessionOptions?: BrowserSessionOptions;
}

export const mapBrowserEngineErrorToAdapterError = (
  engineError: BrowserEngineError
): AdapterError => {
  switch (engineError.kind) {
    case 'TIMEOUT':
      return {
        kind: 'TIMEOUT',
        message: engineError.message,
        retryable: true,
        cause: engineError.cause,
      };
    case 'INVALID_URL':
      return {
        kind: 'INVALID_RESPONSE',
        message: engineError.message,
        retryable: false,
        cause: engineError.cause,
      };
    case 'CANCELLED':
      return {
        kind: 'TIMEOUT',
        message: engineError.message,
        retryable: false,
        cause: engineError.cause,
      };
    case 'EXTRACTION_ERROR':
    case 'EXECUTION_ERROR':
      return {
        kind: 'PARSER_ERROR',
        message: engineError.message,
        retryable: false,
        cause: engineError.cause,
      };
    case 'PLAYWRIGHT_NOT_INSTALLED':
    case 'LAUNCH_FAILED':
    case 'NAVIGATION_FAILED':
    case 'CLEANUP_ERROR':
    default:
      return {
        kind: 'UNKNOWN',
        message: engineError.message,
        retryable: false,
        cause: engineError.cause,
      };
  }
};

export const createBrowserJobSourceAdapter = <TRaw = unknown>(
  config: BrowserAdapterConfig<TRaw>
): JobSourceAdapter => {
  return {
    sourceId: config.sourceId,
    displayName: config.displayName,
    accessType: 'browser_automation',
    isConfigured: config.isConfigured ?? ((settings) => Boolean(settings && typeof settings === 'object')),
    fetchBatch: async (options: AdapterQueryOptions): Promise<AdapterBatchResult> => {
      const fetchedAt = new Date().toISOString();
      let targetUrl: string;

      try {
        targetUrl = config.buildUrl(options);
      } catch (urlErr) {
        return createAdapterFailureResult({
          sourceId: config.sourceId,
          error: {
            kind: 'INVALID_RESPONSE',
            message: `Failed to construct query URL: ${urlErr instanceof Error ? urlErr.message : String(urlErr)}`,
            retryable: false,
            cause: urlErr,
          },
          fetchedAt,
        });
      }

      const engineResult = await navigateAndExtract(
        targetUrl,
        (page) => config.extractRecords(page, options),
        {
          timeoutMs: options.timeoutMs,
          signal: options.signal,
          launcher: config.launcher,
          ...config.sessionOptions,
        }
      );

      if (!engineResult.success) {
        return createAdapterFailureResult({
          sourceId: config.sourceId,
          error: mapBrowserEngineErrorToAdapterError(engineResult.error),
          fetchedAt,
        });
      }

      const rawList = Array.isArray(engineResult.data) ? engineResult.data : [];
      const validJobs: Job[] = [];
      let skippedCount = 0;

      const normContext: NormalizationContext = {
        collectionTimestamp: new Date(),
        sourceId: config.sourceId,
        defaultWorkplaceType: options.workplaceType && options.workplaceType !== 'any'
          ? options.workplaceType
          : config.defaultWorkplaceType,
      };

      for (const raw of rawList) {
        try {
          const normResult = config.normalizeRecord(raw, normContext);
          if (normResult.success) {
            const validation = validateJob(normResult.job);
            if (validation.valid) {
              validJobs.push(normResult.job);
            } else {
              skippedCount++;
            }
          } else {
            skippedCount++;
          }
        } catch {
          skippedCount++;
        }
      }

      return createAdapterSuccessResult({
        sourceId: config.sourceId,
        jobs: validJobs,
        rawCount: rawList.length,
        skippedCount,
        hasMore: false,
        nextContinuationToken: null,
        fetchedAt,
      });
    },
    normalizeRecord: (rawRecord: unknown, context: NormalizationContext): JobNormalizationResult => {
      return config.normalizeRecord(rawRecord as TRaw, context);
    },
  };
};
