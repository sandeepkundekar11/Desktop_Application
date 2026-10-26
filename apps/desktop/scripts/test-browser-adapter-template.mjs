import { importLocal, createTestCollector, desktopRoot } from './db-test-helpers.mjs';

const { createBrowserJobSourceAdapter, mapBrowserEngineErrorToAdapterError } = await importLocal('dist-electron/main/connectors/browserAdapterTemplate.js');
const { createNormalizationSuccess, createNormalizationFailure, isJobSourceAdapter, isAdapterBatchSuccess, isAdapterBatchFailure } = await importLocal('dist-electron/main/connectors/adapterContract.js');
const { validateJob, createDefaultQualifications } = await importLocal('dist-electron/main/storage/jobSchema.js');

const { tests, assert } = createTestCollector();

const buildMockJob = (r, ctx) => ({
  id: `${ctx.sourceId}_${String(r.id)}`, source: ctx.sourceId, sourceJobId: String(r.id),
  title: String(r.title || ''), company: String(r.company || ''), jobUrl: String(r.jobUrl || ''),
  applyUrl: null, description: null, employmentType: 'full_time',
  location: r.location ? { city: 'Bengaluru', state: 'KA', country: 'India', rawLocation: String(r.location) } : null,
  workplaceType: 'hybrid', relocation: null, postedAt: r.postedAt ? String(r.postedAt) : null,
  collectedAt: ctx.collectionTimestamp.toISOString(), collectionDate: ctx.collectionTimestamp.toISOString().slice(0, 10),
  qualifications: createDefaultQualifications(), experience: null, salary: null,
});

async function runTests() {
  console.log('\n======================================================\n APPLYPILOT BROWSER ADAPTER TEMPLATE TESTS\n======================================================\n');

  // 1. Adapter Contract Conformance
  console.log('--- 1. Adapter Contract Conformance ---');
  const dummyAdapter = createBrowserJobSourceAdapter({
    sourceId: 'indeed',
    displayName: 'Mock Indeed Browser Adapter',
    buildUrl: () => 'https://example.com/jobs',
    extractRecords: async () => [],
    normalizeRecord: (raw) => createNormalizationFailure(['Stub'], raw),
  });

  assert('Template output satisfies isJobSourceAdapter', isJobSourceAdapter(dummyAdapter));
  assert('Access type is browser_automation', dummyAdapter.accessType === 'browser_automation');
  assert('Default isConfigured returns true for valid object', dummyAdapter.isConfigured({}));

  // 2. Successful Extraction, Normalization & Cleanup
  console.log('\n--- 2. Successful Extraction and Normalization ---');
  let cleanBrowserClosed = false, cleanContextClosed = false, cleanPageClosed = false;

  const validRawList = [{
    id: 'template-job-1',
    title: 'Principal Distributed Systems Engineer',
    company: 'Enterprise Cloud Infrastructure',
    jobUrl: 'https://careers.enterprisecloud.example/jobs/1',
    location: 'Bengaluru, Karnataka, India',
    postedAt: '2026-10-21T08:00:00.000Z',
  }];

  const successLauncher = async () => ({
    newContext: async () => ({
      newPage: async () => ({
        goto: async () => {},
        title: async () => 'Roles',
        content: async () => JSON.stringify(validRawList),
        close: async () => { cleanPageClosed = true; },
      }),
      close: async () => { cleanContextClosed = true; },
    }),
    close: async () => { cleanBrowserClosed = true; },
  });

  const successAdapter = createBrowserJobSourceAdapter({
    sourceId: 'indeed',
    displayName: 'Indeed Feed',
    launcher: successLauncher,
    buildUrl: (opts) => `https://example.com/search?q=${opts.keywords?.join('+') || 'all'}`,
    extractRecords: async (page) => JSON.parse(await page.content()),
    normalizeRecord: (r, ctx) => createNormalizationSuccess(buildMockJob(r, ctx)),
  });

  const batchResult = await successAdapter.fetchBatch({ keywords: ['Distributed', 'Systems'] });
  assert('Batch returns success = true', isAdapterBatchSuccess(batchResult));
  if (isAdapterBatchSuccess(batchResult)) {
    assert('1 job normalized in batch', batchResult.jobs.length === 1);
    assert('Raw count is 1', batchResult.rawCount === 1);
    assert('Valid count is 1', batchResult.validCount === 1);
    assert('Skipped count is 0', batchResult.skippedCount === 0);
    assert('Job title preserved', batchResult.jobs[0].title === 'Principal Distributed Systems Engineer');
    assert('Normalized job satisfies schema validateJob', validateJob(batchResult.jobs[0]).valid === true);
  }
  assert('Page cleaned up after success', cleanPageClosed === true);
  assert('Context cleaned up after success', cleanContextClosed === true);
  assert('Browser cleaned up after success', cleanBrowserClosed === true);

  // 3. Partial Batch Failure & Record Skipping
  console.log('\n--- 3. Partial Batch Failure & Record Skipping ---');
  const mixedRawList = [
    { id: 'job-valid-1', title: 'Senior Frontend Architect', company: 'Tech India', jobUrl: 'https://careers.techsolutions.example/jobs/1' },
    { id: 'job-invalid', title: '   ', company: 'Missing Title Corp', jobUrl: 'https://example.com/bad/1' },
    { id: 'job-valid-2', title: 'Full Stack Next.js Lead', company: 'Digital Platforms', jobUrl: 'https://careers.digitalplatforms.example/jobs/2' },
  ];

  const mixedAdapter = createBrowserJobSourceAdapter({
    sourceId: 'indeed',
    displayName: 'Indeed Mixed',
    launcher: async () => ({
      newContext: async () => ({
        newPage: async () => ({ goto: async () => {}, title: async () => '', content: async () => '', close: async () => {} }),
        close: async () => {},
      }),
      close: async () => {},
    }),
    buildUrl: () => 'https://example.com/mixed',
    extractRecords: async () => mixedRawList,
    normalizeRecord: (r, ctx) => {
      const job = buildMockJob(r, ctx);
      const v = validateJob(job);
      return v.valid ? createNormalizationSuccess(job) : createNormalizationFailure(v.errors, r);
    },
  });

  const mixedBatch = await mixedAdapter.fetchBatch({});
  assert('Mixed batch returns success = true', isAdapterBatchSuccess(mixedBatch));
  if (isAdapterBatchSuccess(mixedBatch)) {
    assert('Raw count reflects all 3 items', mixedBatch.rawCount === 3);
    assert('Valid count reflects 2 valid jobs', mixedBatch.validCount === 2);
    assert('Skipped count reflects 1 invalid job', mixedBatch.skippedCount === 1);
    assert('Returned jobs array has length 2', mixedBatch.jobs.length === 2);
    assert('First valid job title matches', mixedBatch.jobs[0].title === 'Senior Frontend Architect');
    assert('Second valid job title matches', mixedBatch.jobs[1].title === 'Full Stack Next.js Lead');
  }

  // 4. Error Translations
  console.log('\n--- 4. Error Translations to Adapter Error Kinds ---');
  const invalidUrlAdapter = createBrowserJobSourceAdapter({
    sourceId: 'indeed',
    displayName: 'Invalid URL',
    launcher: successLauncher,
    buildUrl: () => 'not_a_valid_http_protocol',
    extractRecords: async () => [],
    normalizeRecord: (r) => createNormalizationFailure([], r),
  });
  const invalidUrlBatch = await invalidUrlAdapter.fetchBatch({});
  assert('Invalid URL returns failure', isAdapterBatchFailure(invalidUrlBatch));
  if (isAdapterBatchFailure(invalidUrlBatch)) {
    assert('Error kind translates to INVALID_RESPONSE', invalidUrlBatch.error.kind === 'INVALID_RESPONSE');
  }

  const missingDepAdapter = createBrowserJobSourceAdapter({
    sourceId: 'indeed',
    displayName: 'Missing Dep',
    launcher: undefined,
    buildUrl: () => 'https://example.com/missing-dep',
    extractRecords: async () => [],
    normalizeRecord: (r) => createNormalizationFailure([], r),
  });
  process.env.APPLYPILOT_SIMULATE_NO_PLAYWRIGHT = '1';
  const missingDepBatch = await missingDepAdapter.fetchBatch({});
  delete process.env.APPLYPILOT_SIMULATE_NO_PLAYWRIGHT;
  assert('Missing Playwright returns failure', isAdapterBatchFailure(missingDepBatch));
  if (isAdapterBatchFailure(missingDepBatch)) {
    assert('Error kind translates to UNKNOWN', missingDepBatch.error.kind === 'UNKNOWN');
    assert('Error indicates Playwright is not available', missingDepBatch.error.message.includes('Playwright is not available'));
    assert('Missing dependency is marked non-retryable', missingDepBatch.error.retryable === false);
  }

  let parsePageClosed = false, parseBrowserClosed = false;
  const parseFailAdapter = createBrowserJobSourceAdapter({
    sourceId: 'indeed',
    displayName: 'Extractor Error',
    launcher: async () => ({
      newContext: async () => ({
        newPage: async () => ({ goto: async () => {}, title: async () => '', content: async () => '', close: async () => { parsePageClosed = true; } }),
        close: async () => {},
      }),
      close: async () => { parseBrowserClosed = true; },
    }),
    buildUrl: () => 'https://example.com/parse-fail',
    extractRecords: async () => { throw new Error('Simulated DOM query selector syntax error'); },
    normalizeRecord: (r) => createNormalizationFailure([], r),
  });
  const parseFailBatch = await parseFailAdapter.fetchBatch({});
  assert('Extractor error returns failure', isAdapterBatchFailure(parseFailBatch));
  if (isAdapterBatchFailure(parseFailBatch)) {
    assert('Error translates to PARSER_ERROR', parseFailBatch.error.kind === 'PARSER_ERROR');
    assert('Parser error is non-retryable', parseFailBatch.error.retryable === false);
  }
  assert('Page cleaned up despite extractor exception', parsePageClosed === true);
  assert('Browser cleaned up despite extractor exception', parseBrowserClosed === true);

  let timeoutPageClosed = false, timeoutBrowserClosed = false;
  const timeoutAdapter = createBrowserJobSourceAdapter({
    sourceId: 'indeed',
    displayName: 'Timeout',
    launcher: async () => ({
      newContext: async () => ({
        newPage: async () => ({
          goto: async () => { const t = new Error('page.goto: Timeout 1000ms exceeded.'); t.name = 'TimeoutError'; throw t; },
          title: async () => '',
          content: async () => '',
          close: async () => { timeoutPageClosed = true; },
        }),
        close: async () => {},
      }),
      close: async () => { timeoutBrowserClosed = true; },
    }),
    buildUrl: () => 'https://example.com/timeout',
    extractRecords: async () => [],
    normalizeRecord: (r) => createNormalizationFailure([], r),
  });
  const timeoutBatch = await timeoutAdapter.fetchBatch({ timeoutMs: 1000 });
  assert('Navigation timeout returns failure', isAdapterBatchFailure(timeoutBatch));
  if (isAdapterBatchFailure(timeoutBatch)) {
    assert('Error translates to TIMEOUT kind', timeoutBatch.error.kind === 'TIMEOUT');
    assert('Timeout error is marked retryable', timeoutBatch.error.retryable === true);
  }
  assert('Page cleaned up on timeout', timeoutPageClosed === true);
  assert('Browser cleaned up on timeout', timeoutBrowserClosed === true);

  // 5. Cancellation Propagation
  console.log('\n--- 5. Cancellation Propagation ---');
  const preAborted = new AbortController();
  preAborted.abort();
  let preAbortedLauncherCalled = false;
  const preAbortedAdapter = createBrowserJobSourceAdapter({
    sourceId: 'indeed',
    displayName: 'Pre-aborted',
    launcher: async () => { preAbortedLauncherCalled = true; throw new Error('Unreachable'); },
    buildUrl: () => 'https://example.com/pre-aborted',
    extractRecords: async () => [],
    normalizeRecord: (r) => createNormalizationFailure([], r),
  });
  const preAbortedBatch = await preAbortedAdapter.fetchBatch({ signal: preAborted.signal });
  assert('Pre-aborted signal returns failure', isAdapterBatchFailure(preAbortedBatch));
  assert('Launcher was never called for pre-aborted signal', preAbortedLauncherCalled === false);

  const inFlightCtrl = new AbortController();
  let inFlightPageClosed = false, inFlightBrowserClosed = false;
  const inFlightAdapter = createBrowserJobSourceAdapter({
    sourceId: 'indeed',
    displayName: 'In-flight Abort',
    launcher: async () => ({
      newContext: async () => ({
        newPage: async () => ({
          goto: async () => {
            inFlightCtrl.abort();
            const err = new Error('Operation aborted');
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
    }),
    buildUrl: () => 'https://example.com/inflight-abort',
    extractRecords: async () => [],
    normalizeRecord: (r) => createNormalizationFailure([], r),
  });
  const inFlightBatch = await inFlightAdapter.fetchBatch({ signal: inFlightCtrl.signal });
  assert('In-flight abort returns failure', isAdapterBatchFailure(inFlightBatch));
  assert('Page cleaned up on in-flight abort', inFlightPageClosed === true);
  assert('Browser cleaned up on in-flight abort', inFlightBrowserClosed === true);

  // 6. Source File Size Audit (< 300 Lines)
  console.log('\n--- 6. Source File Length Verification (< 300 Lines) ---');
  const pathMod = await import('node:path');
  const fsMod = await import('node:fs');
  const targetTemplate = pathMod.resolve(desktopRoot, 'src/main/connectors/browserAdapterTemplate.ts');
  const selfFile = pathMod.resolve(desktopRoot, 'scripts/test-browser-adapter-template.mjs');
  const templateLines = fsMod.readFileSync(targetTemplate, 'utf8').split('\n').length;
  const testLines = fsMod.readFileSync(selfFile, 'utf8').split('\n').length;
  assert(`browserAdapterTemplate.ts has ${templateLines} lines (< 300 lines limit)`, templateLines < 300);
  assert(`test-browser-adapter-template.mjs has ${testLines} lines (< 300 lines limit)`, testLines < 300);

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
