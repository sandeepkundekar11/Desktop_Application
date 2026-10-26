import { importLocal, createTestCollector, desktopRoot } from './db-test-helpers.mjs';

const {
  createAdapterSuccessResult,
  createAdapterFailureResult,
  createNormalizationSuccess,
  createNormalizationFailure,
  isAdapterBatchSuccess,
  isAdapterBatchFailure,
  isJobSourceAdapter,
} = await importLocal('dist-electron/main/connectors/adapterContract.js');

const {
  validateJob,
  createDefaultQualifications,
} = await importLocal('dist-electron/main/storage/jobSchema.js');

const { SUPPORTED_CONNECTOR_IDS } = await importLocal('dist-electron/main/storage/connectorSchema.js');

const { tests, assert } = createTestCollector();

async function runTests() {
  console.log('\n======================================================');
  console.log('    APPLYPILOT SOURCE-INDEPENDENT ADAPTER CONTRACT TESTS');
  console.log('======================================================\n');

  // 1. Conformance of HTTP-based and Browser Automation Adapters
  console.log('--- 1. Conformance of Diverse Adapter Implementations ---');
  const mockHttpAdapter = {
    sourceId: 'hiringcafe',
    displayName: 'HiringCafe Direct Employer Feed',
    accessType: 'http_api',
    isConfigured: (settings) => Boolean(settings && typeof settings === 'object'),
    fetchBatch: async (options) => {
      const now = new Date().toISOString();
      return createAdapterSuccessResult({
        sourceId: 'hiringcafe',
        jobs: [
          {
            id: 'hiringcafe_hc-101',
            source: 'hiringcafe',
            sourceJobId: 'hc-101',
            title: 'Cardiology Nurse Practitioner',
            company: 'Metropolitan Heart Clinic',
            jobUrl: 'https://careers.metroheart.example/jobs/101',
            applyUrl: null,
            description: 'Comprehensive outpatient cardiology patient evaluations and treatment plans.',
            employmentType: 'full_time',
            location: { city: 'Philadelphia', state: 'PA', country: 'USA', rawLocation: 'Philadelphia, PA' },
            workplaceType: 'on_site',
            relocation: null,
            postedAt: '2026-10-20T10:00:00.000Z',
            collectedAt: now,
            collectionDate: now.slice(0, 10),
            qualifications: {
              ...createDefaultQualifications(),
              requiredSkills: ['BLS', 'ACLS', 'Cardiac Care'],
              requiredQualifications: ['MSN', 'Board Certified APRN'],
            },
            experience: { minYears: 2, maxYears: 5, rawText: '2-5 years' },
            salary: { min: 115000, max: 135000, currency: 'USD', period: 'yearly' },
          },
        ],
        rawCount: 1,
        skippedCount: 0,
        nextContinuationToken: 'token_page_2',
        hasMore: true,
      });
    },
    normalizeRecord: (raw, ctx) => {
      if (!raw || typeof raw !== 'object') {
        return createNormalizationFailure(['Record is not a valid object'], raw);
      }
      const r = raw;
      const job = {
        id: `${ctx.sourceId}_${String(r.id)}`,
        source: ctx.sourceId,
        sourceJobId: String(r.id),
        title: String(r.title || ''),
        company: String(r.company || ''),
        jobUrl: String(r.jobUrl || ''),
        applyUrl: null,
        description: null,
        employmentType: null,
        location: null,
        workplaceType: ctx.defaultWorkplaceType ?? null,
        relocation: null,
        postedAt: null,
        collectedAt: ctx.collectionTimestamp.toISOString(),
        collectionDate: ctx.collectionTimestamp.toISOString().slice(0, 10),
        qualifications: createDefaultQualifications(),
        experience: null,
        salary: null,
      };
      const validation = validateJob(job);
      return validation.valid
        ? createNormalizationSuccess(job)
        : createNormalizationFailure(validation.errors, raw);
    },
  };

  const mockBrowserAdapter = {
    sourceId: 'linkedin',
    displayName: 'LinkedIn Professional Network',
    accessType: 'browser_automation',
    isConfigured: (settings) => Boolean(settings && settings.locationPreference),
    fetchBatch: async (options) => {
      // Simulate timeout or failure on browser session
      if (options.timeoutMs && options.timeoutMs < 50) {
        return createAdapterFailureResult({
          sourceId: 'linkedin',
          error: {
            kind: 'TIMEOUT',
            message: `Browser session query exceeded timeout of ${options.timeoutMs}ms.`,
            retryable: true,
          },
        });
      }
      return createAdapterSuccessResult({
        sourceId: 'linkedin',
        jobs: [],
        rawCount: 0,
        skippedCount: 0,
        hasMore: false,
      });
    },
    normalizeRecord: (raw, ctx) => {
      return createNormalizationFailure(['Not implemented in stub'], raw);
    },
  };

  assert('HTTP adapter satisfies isJobSourceAdapter', isJobSourceAdapter(mockHttpAdapter));
  assert('Browser automation adapter satisfies isJobSourceAdapter', isJobSourceAdapter(mockBrowserAdapter));

  // 2. Multi-Source ID Support for All 7 Planned Sources
  console.log('\n--- 2. Support for All 7 Source Identifiers ---');
  for (const srcId of SUPPORTED_CONNECTOR_IDS) {
    const stubAdapter = {
      sourceId: srcId,
      displayName: `Adapter for ${srcId}`,
      accessType: srcId === 'linkedin' ? 'browser_automation' : 'http_api',
      isConfigured: () => true,
      fetchBatch: async () => createAdapterSuccessResult({ sourceId: srcId, jobs: [], rawCount: 0, skippedCount: 0 }),
      normalizeRecord: (raw, ctx) => createNormalizationFailure(['Stub'], raw),
    };
    assert(`Adapter for source "${srcId}" conforms to contract`, isJobSourceAdapter(stubAdapter));
  }

  // 3. Batch Success Structure & Pagination
  console.log('\n--- 3. Batch Success & Continuation Token ---');
  const batchSuccess = await mockHttpAdapter.fetchBatch({ limit: 10 });
  assert('Batch result indicates success = true', isAdapterBatchSuccess(batchSuccess));
  assert('Batch contains 1 normalized job', batchSuccess.jobs.length === 1);
  assert('Batch preserves sourceId = hiringcafe', batchSuccess.sourceId === 'hiringcafe');
  assert('Batch contains valid nextContinuationToken', batchSuccess.nextContinuationToken === 'token_page_2');
  assert('Batch hasMore is true', batchSuccess.hasMore === true);
  assert('Job within batch passes validateJob', validateJob(batchSuccess.jobs[0]).valid);

  // 4. Explicit Error Handling (No Silent Failure / Conversion to Empty Results)
  console.log('\n--- 4. Explicit Error Reporting Without Silent Conversion ---');
  const timeoutFailure = await mockBrowserAdapter.fetchBatch({ timeoutMs: 10 });
  assert('Timeout result indicates success = false', isAdapterBatchFailure(timeoutFailure));
  assert('Error kind is TIMEOUT', timeoutFailure.error.kind === 'TIMEOUT');
  assert('Error retryable flag is true', timeoutFailure.error.retryable === true);
  assert('Error message is descriptive', timeoutFailure.error.message.includes('timeout'));

  // 5. Independent Failure Isolation (One Adapter Failure Does Not Affect Another)
  console.log('\n--- 5. Independent Failure Isolation ---');
  const [resA, resB] = await Promise.all([
    mockBrowserAdapter.fetchBatch({ timeoutMs: 5 }), // Fails with timeout
    mockHttpAdapter.fetchBatch({ limit: 5 }),          // Succeeds
  ]);

  assert('Adapter A returned explicit failure', isAdapterBatchFailure(resA));
  assert('Adapter B concurrently returned explicit success', isAdapterBatchSuccess(resB));
  assert('Adapter B jobs array intact despite Adapter A failure', resB.jobs.length === 1);

  // 6. Normalization Contract & Raw Record Provenance
  console.log('\n--- 6. Normalization Contract ---');
  const validRaw = { id: 'leg-404', title: 'Corporate Environmental Counsel', company: 'Solaria Energy', jobUrl: 'https://solaria.example/job/404' };
  const normSuccess = mockHttpAdapter.normalizeRecord(validRaw, {
    collectionTimestamp: new Date(),
    sourceId: 'hiringcafe',
  });
  assert('Valid record normalizes with success = true', normSuccess.success);
  assert('Normalized job has correct title', normSuccess.success && normSuccess.job.title === 'Corporate Environmental Counsel');

  const invalidRaw = { id: 'bad-1', title: '', company: 'Acme', jobUrl: 'not_a_url' };
  const normFailure = mockHttpAdapter.normalizeRecord(invalidRaw, {
    collectionTimestamp: new Date(),
    sourceId: 'hiringcafe',
  });
  assert('Malformed record normalizes with success = false', !normFailure.success);
  assert('Failure preserves raw record for provenance', !normFailure.success && normFailure.rawRecord === invalidRaw);
  assert('Failure contains validation errors', !normFailure.success && normFailure.errors.length > 0);

  // 7. Cancellation Signal Support
  console.log('\n--- 7. AbortSignal Cancellation Support ---');
  const abortController = new AbortController();
  abortController.abort();
  let caughtAbort = false;
  const cancellableAdapter = {
    sourceId: 'indeed',
    displayName: 'Indeed Feed',
    accessType: 'feed',
    isConfigured: () => true,
    fetchBatch: async (options) => {
      if (options.signal?.aborted) {
        return createAdapterFailureResult({
          sourceId: 'indeed',
          error: {
            kind: 'NETWORK_ERROR',
            message: 'Query cancelled by caller signal.',
            retryable: false,
          },
        });
      }
      return createAdapterSuccessResult({ sourceId: 'indeed', jobs: [], rawCount: 0, skippedCount: 0 });
    },
    normalizeRecord: (raw) => createNormalizationFailure(['Stub'], raw),
  };

  const cancelledRes = await cancellableAdapter.fetchBatch({ signal: abortController.signal });
  assert('Cancelled query returns explicit failure with cancellation message', isAdapterBatchFailure(cancelledRes));
  assert('Error message notes caller cancellation', cancelledRes.error.message.includes('cancelled'));

  // 8. File Length Verification (< 300 Lines)
  console.log('\n--- 8. File Length Verification (< 300 Lines) ---');
  const pathMod = await import('node:path');
  const targetFile = pathMod.resolve(desktopRoot, 'src/main/connectors/adapterContract.ts');
  const fsTarget = (await import('node:fs')).readFileSync(targetFile, 'utf8').split('\n').length;
  assert(`adapterContract.ts has ${fsTarget} lines (< 300 lines limit)`, fsTarget < 300);

  const allPassed = tests.every((t) => t.pass);
  console.log('\n======================================================');
  console.log(` RESULTS: ${tests.filter(t => t.pass).length} / ${tests.length} TESTS PASSED`);
  console.log('======================================================\n');
  process.exit(allPassed ? 0 : 1);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
