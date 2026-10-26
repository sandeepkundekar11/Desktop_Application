import { importLocal, createTestCollector, desktopRoot } from './db-test-helpers.mjs';

const { navigateAndExtract } = await importLocal('dist-electron/main/automation/browserEngine.js');
const {
  createAdapterSuccessResult,
  createAdapterFailureResult,
  createNormalizationSuccess,
  createNormalizationFailure,
  isJobSourceAdapter,
  isAdapterBatchSuccess,
  isAdapterBatchFailure,
} = await importLocal('dist-electron/main/connectors/adapterContract.js');
const { validateJob, createDefaultQualifications } = await importLocal('dist-electron/main/storage/jobSchema.js');

const { tests, assert } = createTestCollector();

function mapBrowserErrorToAdapterError(err) {
  if (err.kind === 'TIMEOUT') return { kind: 'TIMEOUT', message: err.message, retryable: true };
  if (err.kind === 'INVALID_URL') return { kind: 'INVALID_RESPONSE', message: err.message, retryable: false };
  if (err.kind === 'EXTRACTION_ERROR' || err.kind === 'EXECUTION_ERROR') return { kind: 'PARSER_ERROR', message: err.message, retryable: false };
  return { kind: 'UNKNOWN', message: err.message, retryable: false };
}

function createMockBrowserAdapter({ launcher, searchUrl = 'https://example.com/jobs' } = {}) {
  let adapter;
  adapter = {
    sourceId: 'linkedin',
    displayName: 'Mock LinkedIn Browser Adapter',
    accessType: 'browser_automation',
    isConfigured: (s) => Boolean(s && typeof s === 'object'),
    fetchBatch: async (options = {}) => {
      const now = new Date().toISOString();
      const res = await navigateAndExtract(
        searchUrl,
        async (page) => {
          const content = await page.content();
          try { return JSON.parse(content); }
          catch { throw new Error('Failed to parse listing payload from page markup'); }
        },
        { timeoutMs: options.timeoutMs, signal: options.signal, launcher }
      );

      if (!res.success) {
        return createAdapterFailureResult({ sourceId: 'linkedin', error: mapBrowserErrorToAdapterError(res.error), fetchedAt: now });
      }

      const rawRecords = Array.isArray(res.data) ? res.data : [];
      const validJobs = [];
      let skippedCount = 0;
      const ctx = { collectionTimestamp: new Date(), sourceId: 'linkedin' };

      for (const raw of rawRecords) {
        const norm = adapter.normalizeRecord(raw, ctx);
        if (norm.success) validJobs.push(norm.job);
        else skippedCount++;
      }

      return createAdapterSuccessResult({
        sourceId: 'linkedin',
        jobs: validJobs,
        rawCount: rawRecords.length,
        skippedCount,
        hasMore: false,
        fetchedAt: now,
      });
    },
    normalizeRecord: (raw, ctx) => {
      if (!raw || typeof raw !== 'object') return createNormalizationFailure(['Not object'], raw);
      const r = raw;
      const job = {
        id: `${ctx.sourceId}_${String(r.id || '')}`,
        source: ctx.sourceId,
        sourceJobId: r.id ? String(r.id) : null,
        title: String(r.title || ''),
        company: String(r.company || ''),
        jobUrl: String(r.jobUrl || ''),
        applyUrl: null,
        description: null,
        employmentType: 'full_time',
        location: r.location ? { city: 'Boston', state: 'MA', country: 'USA', rawLocation: String(r.location) } : null,
        workplaceType: 'remote',
        relocation: null,
        postedAt: r.postedAt ? String(r.postedAt) : null,
        collectedAt: ctx.collectionTimestamp.toISOString(),
        collectionDate: ctx.collectionTimestamp.toISOString().slice(0, 10),
        qualifications: createDefaultQualifications(),
        experience: null,
        salary: null,
      };
      const v = validateJob(job);
      return v.valid ? createNormalizationSuccess(job) : createNormalizationFailure(v.errors, raw);
    },
  };
  return adapter;
}

async function runTests() {
  console.log('\n======================================================');
  console.log(' APPLYPILOT BROWSER ADAPTER INTEGRATION TESTS');
  console.log('======================================================\n');

  // 1. Successful Integration & Schema Normalization
  console.log('--- 1. Successful Integration & Schema Normalization ---');
  let cleanBrowserClosed = false, cleanContextClosed = false, cleanPageClosed = false;
  const validPayload = JSON.stringify([{
    id: 'li-101',
    title: 'Senior Clinical Bioinformatics Scientist',
    company: 'Biotech Discovery Labs',
    jobUrl: 'https://careers.biotech.example/jobs/101',
    location: 'Boston, MA',
    postedAt: '2026-10-20T10:00:00.000Z',
  }]);

  const successLauncher = async () => ({
    newContext: async () => ({
      newPage: async () => ({
        goto: async () => {},
        title: async () => 'Careers',
        content: async () => validPayload,
        close: async () => { cleanPageClosed = true; },
      }),
      close: async () => { cleanContextClosed = true; },
    }),
    close: async () => { cleanBrowserClosed = true; },
  });

  const adapter = createMockBrowserAdapter({ launcher: successLauncher });
  assert('Adapter conforms to JobSourceAdapter contract', isJobSourceAdapter(adapter));

  const batch = await adapter.fetchBatch({ timeoutMs: 15000 });
  assert('Batch result indicates success = true', isAdapterBatchSuccess(batch));
  if (isAdapterBatchSuccess(batch)) {
    assert('Batch contains 1 normalized job', batch.jobs.length === 1);
    assert('Raw count is 1', batch.rawCount === 1);
    assert('Valid count is 1', batch.validCount === 1);
    assert('Skipped count is 0', batch.skippedCount === 0);
    assert('Job title preserved', batch.jobs[0].title === 'Senior Clinical Bioinformatics Scientist');
    assert('Job passes validateJob checks', validateJob(batch.jobs[0]).valid === true);
  }
  assert('Page cleaned up after success', cleanPageClosed === true);
  assert('Context cleaned up after success', cleanContextClosed === true);
  assert('Browser cleaned up after success', cleanBrowserClosed === true);

  // 2. Error Translation
  console.log('\n--- 2. Error Translation to Supported Adapter Error Kinds ---');
  const invalidUrlBatch = await createMockBrowserAdapter({ searchUrl: 'not_valid_url', launcher: successLauncher }).fetchBatch();
  assert('Invalid URL returns failure', isAdapterBatchFailure(invalidUrlBatch));
  if (isAdapterBatchFailure(invalidUrlBatch)) {
    assert('Translates to INVALID_RESPONSE', invalidUrlBatch.error.kind === 'INVALID_RESPONSE');
  }

  process.env.APPLYPILOT_SIMULATE_NO_PLAYWRIGHT = '1';
  const missingDepBatch = await createMockBrowserAdapter({ launcher: undefined }).fetchBatch();
  delete process.env.APPLYPILOT_SIMULATE_NO_PLAYWRIGHT;
  assert('Missing Playwright returns failure', isAdapterBatchFailure(missingDepBatch));
  if (isAdapterBatchFailure(missingDepBatch)) {
    assert('Translates to UNKNOWN with clear message', missingDepBatch.error.kind === 'UNKNOWN');
    assert('Explains Playwright is not available', missingDepBatch.error.message.includes('Playwright is not available'));
    assert('Missing dependency is not retryable', missingDepBatch.error.retryable === false);
  }

  let parsePageClosed = false, parseBrowserClosed = false;
  const parseFailLauncher = async () => ({
    newContext: async () => ({
      newPage: async () => ({
        goto: async () => {},
        title: async () => '',
        content: async () => '<html>Not JSON</html>',
        close: async () => { parsePageClosed = true; },
      }),
      close: async () => {},
    }),
    close: async () => { parseBrowserClosed = true; },
  });
  const parseFailBatch = await createMockBrowserAdapter({ launcher: parseFailLauncher }).fetchBatch();
  assert('Extractor error returns failure', isAdapterBatchFailure(parseFailBatch));
  if (isAdapterBatchFailure(parseFailBatch)) {
    assert('Translates to PARSER_ERROR', parseFailBatch.error.kind === 'PARSER_ERROR');
    assert('Parser error is not retryable', parseFailBatch.error.retryable === false);
  }
  assert('Page closed on extractor error', parsePageClosed === true);
  assert('Browser closed on extractor error', parseBrowserClosed === true);

  let timeoutPageClosed = false, timeoutBrowserClosed = false;
  const timeoutLauncher = async () => ({
    newContext: async () => ({
      newPage: async () => ({
        goto: async () => {
          const tErr = new Error('page.goto: Timeout 1000ms exceeded.');
          tErr.name = 'TimeoutError';
          throw tErr;
        },
        title: async () => '',
        content: async () => '',
        close: async () => { timeoutPageClosed = true; },
      }),
      close: async () => {},
    }),
    close: async () => { timeoutBrowserClosed = true; },
  });
  const timeoutBatch = await createMockBrowserAdapter({ launcher: timeoutLauncher }).fetchBatch({ timeoutMs: 1000 });
  assert('Timeout returns failure', isAdapterBatchFailure(timeoutBatch));
  if (isAdapterBatchFailure(timeoutBatch)) {
    assert('Translates to TIMEOUT kind', timeoutBatch.error.kind === 'TIMEOUT');
    assert('Timeout marked retryable', timeoutBatch.error.retryable === true);
  }
  assert('Page closed on timeout', timeoutPageClosed === true);
  assert('Browser closed on timeout', timeoutBrowserClosed === true);

  // 3. Cancellation Propagation
  console.log('\n--- 3. Cancellation Propagation ---');
  const preAborted = new AbortController();
  preAborted.abort();
  let preAbortedLauncherCalled = false;
  const preAbortedBatch = await createMockBrowserAdapter({
    launcher: async () => { preAbortedLauncherCalled = true; throw new Error('Unreachable'); },
  }).fetchBatch({ signal: preAborted.signal });
  assert('Pre-aborted query returns failure', isAdapterBatchFailure(preAbortedBatch));
  assert('Launcher never invoked when pre-aborted', preAbortedLauncherCalled === false);

  const inFlightCtrl = new AbortController();
  let inFlightPageClosed = false, inFlightBrowserClosed = false;
  const inFlightLauncher = async () => ({
    newContext: async () => ({
      newPage: async () => ({
        goto: async () => {
          inFlightCtrl.abort();
          const err = new Error('Navigation aborted');
          err.name = 'AbortError';
          throw err;
        },
        title: async () => '',
        content: async () => '',
        close: async () => { inFlightPageClosed = true; },
      }),
      close: async () => {},
    }),
    close: async () => { inFlightBrowserClosed = true; },
  });
  const inFlightBatch = await createMockBrowserAdapter({ launcher: inFlightLauncher }).fetchBatch({ signal: inFlightCtrl.signal });
  assert('In-flight abort returns failure', isAdapterBatchFailure(inFlightBatch));
  assert('Page cleaned up on in-flight abort', inFlightPageClosed === true);
  assert('Browser cleaned up on in-flight abort', inFlightBrowserClosed === true);

  // 4. Partial Batch Failure & Record Skipping
  console.log('\n--- 4. Partial Batch Failure & Record Skipping ---');
  const mixedPayload = JSON.stringify([
    { id: 'li-201', title: 'Oncology Data Scientist', company: 'Therapeutics AI', jobUrl: 'https://careers.therapeutics.example/jobs/201' },
    { id: 'li-invalid', title: '   ', company: 'Company', jobUrl: 'https://example.com/job/empty' },
    { id: 'li-202', title: 'Robotics Systems Architect', company: 'Kinematics', jobUrl: 'https://careers.kinematics.example/jobs/202' },
  ]);

  const mixedLauncher = async () => ({
    newContext: async () => ({
      newPage: async () => ({
        goto: async () => {},
        title: async () => 'Mixed',
        content: async () => mixedPayload,
        close: async () => {},
      }),
      close: async () => {},
    }),
    close: async () => {},
  });

  const mixedBatch = await createMockBrowserAdapter({ launcher: mixedLauncher }).fetchBatch();
  assert('Partial batch returns overall success = true', isAdapterBatchSuccess(mixedBatch));
  if (isAdapterBatchSuccess(mixedBatch)) {
    assert('Raw count reflects all 3 extracted records', mixedBatch.rawCount === 3);
    assert('Valid count reflects the 2 valid jobs', mixedBatch.validCount === 2);
    assert('Skipped count reflects the 1 invalid job', mixedBatch.skippedCount === 1);
    assert('Jobs array contains exactly 2 valid jobs', mixedBatch.jobs.length === 2);
  }

  // 5. Source File Size Audit (< 300 Lines)
  console.log('\n--- 5. Source File Length Verification (< 300 Lines) ---');
  const pathMod = await import('node:path');
  const fsMod = await import('node:fs');
  const selfFile = pathMod.resolve(desktopRoot, 'scripts/test-browser-adapter-integration.mjs');
  const lineCount = fsMod.readFileSync(selfFile, 'utf8').split('\n').length;
  assert(`test-browser-adapter-integration.mjs has ${lineCount} lines (< 300 lines limit)`, lineCount < 300);

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
