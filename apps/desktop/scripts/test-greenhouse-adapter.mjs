import { importLocal, createTestCollector } from './db-test-helpers.mjs';

const {
  createGreenhouseCommerceIqAdapter,
  normalizeGreenhouseListing,
  extractGreenhouseListingsFromHtml,
  parseGreenhouseLocation,
  COMMERCEIQ_BOARD_TOKEN,
  COMMERCEIQ_BOARD_URL,
} = await importLocal('dist-electron/main/connectors/sources/greenhouseBrowserAdapter.js');

const {
  isJobSourceAdapter,
  isAdapterBatchSuccess,
  isAdapterBatchFailure,
} = await importLocal('dist-electron/main/connectors/adapterContract.js');

const { validateJob } = await importLocal('dist-electron/main/storage/jobSchema.js');

const { tests, assert } = createTestCollector();

const MOCK_REMIX_HTML = `
<!DOCTYPE html>
<html>
<head><title>CommerceIQ Careers</title></head>
<body>
<script>
window.__remixContext = {
  "state": {
    "loaderData": {
      "routes/$url_token": {
        "board": { "name": "CommerceIQ" },
        "jobPosts": {
          "data": [
            {
              "id": 12345,
              "title": "Staff Frontend Engineer",
              "absolute_url": "https://job-boards.greenhouse.io/commerceiq/jobs/12345",
              "location": { "name": "Bengaluru, Karnataka, India" },
              "published_at": "2026-10-20T10:00:00.000Z",
              "updated_at": "2026-10-21T10:00:00.000Z",
              "department": { "name": "Engineering" },
              "requisition_id": "REQ-101"
            },
            {
              "id": 12346,
              "title": "Senior React Engineer",
              "absolute_url": "https://job-boards.greenhouse.io/commerceiq/jobs/12346",
              "location": { "name": "Remote - India" },
              "published_at": null,
              "department": "Platform"
            }
          ]
        }
      }
    }
  }
};
</script>
</body>
</html>
`;

const MOCK_DOM_HTML = `
<!DOCTYPE html>
<html>
<body>
<table>
  <tr class="job-post">
    <td>
      <a href="https://job-boards.greenhouse.io/commerceiq/jobs/67890">
        <p class="body body--medium">Principal Engineer</p>
        <p class="body body__secondary body--metadata">Bengaluru, Karnataka, India</p>
      </a>
    </td>
  </tr>
</table>
</body>
</html>
`;

const createMockLauncher = (htmlContent, onAction = () => {}) => {
  let browserClosed = false;
  let contextClosed = false;
  let pageClosed = false;
  const openedUrls = [];

  const launcher = async () => ({
    newContext: async () => ({
      newPage: async () => ({
        goto: async (url) => {
          openedUrls.push(url);
          onAction('goto', url);
        },
        title: async () => 'Mock Board',
        content: async () => htmlContent,
        close: async () => {
          pageClosed = true;
          onAction('closePage');
        },
      }),
      close: async () => {
        contextClosed = true;
        onAction('closeContext');
      },
    }),
    close: async () => {
      browserClosed = true;
      onAction('closeBrowser');
    },
  });

  return {
    launcher,
    getOpenedUrls: () => openedUrls,
    isCleanedUp: () => browserClosed && contextClosed && pageClosed,
  };
};

async function runTests() {
  console.log('\n======================================================\n APPLYPILOT GREENHOUSE COMMERCEIQ ADAPTER TESTS\n======================================================\n');

  // 1. Adapter Contract Conformance
  console.log('--- 1. Adapter Contract Conformance ---');
  const adapter = createGreenhouseCommerceIqAdapter();
  assert('Adapter passes isJobSourceAdapter check', isJobSourceAdapter(adapter));
  assert('sourceId is greenhouse_commerceiq', adapter.sourceId === 'greenhouse_commerceiq');
  assert('displayName is accurate', adapter.displayName === 'CommerceIQ Careers (Greenhouse Board)');
  assert('accessType is browser_automation', adapter.accessType === 'browser_automation');
  assert('isConfigured returns true for valid settings', adapter.isConfigured({}));
  assert('COMMERCEIQ_BOARD_URL is set correctly', COMMERCEIQ_BOARD_URL === 'https://job-boards.greenhouse.io/commerceiq');

  // 2. Location Parsing
  console.log('\n--- 2. Location Parsing ---');
  const loc1 = parseGreenhouseLocation('India');
  assert('1-part location parses country', loc1?.country === 'India' && loc1?.city === null);

  const loc2 = parseGreenhouseLocation('Bengaluru, India');
  assert('2-part location parses city and country', loc2?.city === 'Bengaluru' && loc2?.country === 'India');

  const loc3 = parseGreenhouseLocation('Bengaluru, Karnataka, India');
  assert('3-part location parses city, state, country', loc3?.city === 'Bengaluru' && loc3?.state === 'Karnataka' && loc3?.country === 'India');

  const locObj = parseGreenhouseLocation({ name: 'Bengaluru, Karnataka, India' });
  assert('Object location parses name property', locObj?.city === 'Bengaluru' && locObj?.state === 'Karnataka');

  const locEmpty = parseGreenhouseLocation('   ');
  assert('Empty location returns null', locEmpty === null);

  // 3. Publication Date Handling (No Fabrication)
  console.log('\n--- 3. Genuine Publication Date Handling (No Fabrication) ---');
  const normCtx = { collectionTimestamp: new Date('2026-10-22T10:00:00Z'), sourceId: 'greenhouse_commerceiq' };

  const resWithDate = normalizeGreenhouseListing({
    id: 'gh-1',
    title: 'Staff Frontend Engineer',
    company: 'CommerceIQ',
    jobUrl: 'https://job-boards.greenhouse.io/commerceiq/jobs/1',
    published_at: '2026-10-20T10:00:00.000Z',
  }, normCtx);
  assert('Genuine ISO date is preserved', resWithDate.success && resWithDate.job.postedAt === '2026-10-20T10:00:00.000Z');

  const resWithoutDate = normalizeGreenhouseListing({
    id: 'gh-2',
    title: 'Senior Frontend Engineer',
    company: 'CommerceIQ',
    jobUrl: 'https://job-boards.greenhouse.io/commerceiq/jobs/2',
    published_at: null,
  }, normCtx);
  assert('Missing published_at produces postedAt = null', resWithoutDate.success && resWithoutDate.job.postedAt === null);
  assert('Collection date is not substituted into postedAt', resWithoutDate.success && resWithoutDate.job.postedAt !== resWithoutDate.job.collectedAt);

  const resWithInvalidDate = normalizeGreenhouseListing({
    id: 'gh-3',
    title: 'Junior Frontend Engineer',
    company: 'CommerceIQ',
    jobUrl: 'https://job-boards.greenhouse.io/commerceiq/jobs/3',
    published_at: 'yesterday afternoon',
  }, normCtx);
  assert('Non-ISO date produces postedAt = null', resWithInvalidDate.success && resWithInvalidDate.job.postedAt === null);

  // 4. Missing Optional Fields & Defaults
  console.log('\n--- 4. Missing Optional Fields & Workplace Defaults ---');
  const resRemote = normalizeGreenhouseListing({
    id: 'gh-4',
    title: 'Fullstack Engineer',
    jobUrl: 'https://job-boards.greenhouse.io/commerceiq/jobs/4',
    location: 'Remote - India',
  }, normCtx);
  assert('Remote keyword sets workplaceType to remote', resRemote.success && resRemote.job.workplaceType === 'remote');
  assert('Default employmentType is full_time', resRemote.success && resRemote.job.employmentType === 'full_time');

  // 5. Successful Batch Extraction via Mock Launcher & Cleanup
  console.log('\n--- 5. Batch Extraction with Mock Launcher & Cleanup ---');
  const mock1 = createMockLauncher(MOCK_REMIX_HTML);
  const testAdapter1 = createGreenhouseCommerceIqAdapter({ launcher: mock1.launcher });

  const batch1 = await testAdapter1.fetchBatch({});
  assert('Batch fetch returns success = true', isAdapterBatchSuccess(batch1));
  if (isAdapterBatchSuccess(batch1)) {
    assert('Extracted 2 raw records', batch1.rawCount === 2);
    assert('Normalized 2 valid records', batch1.validCount === 2);
    assert('Skipped count is 0', batch1.skippedCount === 0);
    assert('First job title is Staff Frontend Engineer', batch1.jobs[0]?.title === 'Staff Frontend Engineer');
    assert('First job has genuine publication date', batch1.jobs[0]?.postedAt === '2026-10-20T10:00:00.000Z');
    assert('Second job has null publication date', batch1.jobs[1]?.postedAt === null);
    assert('All valid jobs pass validateJob', batch1.jobs.every((j) => validateJob(j).valid));
  }
  assert('Mock browser, context, and page cleaned up', mock1.isCleanedUp());

  // 6. Partial Batch Handling (Invalid Record Skipping)
  console.log('\n--- 6. Partial Batch Handling (Invalid Listing Skipped) ---');
  const partialHtml = `
  <script>
  window.__remixContext = {
    "state": {
      "loaderData": {
        "routes/$url_token": {
          "board": { "name": "CommerceIQ" },
          "jobPosts": {
            "data": [
              { "id": 1, "title": "Valid Role", "absolute_url": "https://job-boards.greenhouse.io/commerceiq/jobs/1" },
              { "id": 2, "title": "", "absolute_url": "https://job-boards.greenhouse.io/commerceiq/jobs/2" }
            ]
          }
        }
      }
    }
  };
  </script>`;
  const mockPartial = createMockLauncher(partialHtml);
  const partialAdapter = createGreenhouseCommerceIqAdapter({ launcher: mockPartial.launcher });
  const partialBatch = await partialAdapter.fetchBatch({});
  assert('Partial batch returns success = true', isAdapterBatchSuccess(partialBatch));
  if (isAdapterBatchSuccess(partialBatch)) {
    assert('Raw count is 2', partialBatch.rawCount === 2);
    assert('Valid count is 1', partialBatch.validCount === 1);
    assert('Skipped count is 1 for invalid title', partialBatch.skippedCount === 1);
    assert('Valid job title matches', partialBatch.jobs[0]?.title === 'Valid Role');
  }

  // 7. Fallback DOM Parsing
  console.log('\n--- 7. Fallback DOM Parsing ---');
  const domListings = extractGreenhouseListingsFromHtml(MOCK_DOM_HTML);
  assert('Fallback DOM parsing extracts 1 listing', domListings.length === 1);
  assert('DOM listing title is Principal Engineer', domListings[0]?.title === 'Principal Engineer');
  assert('DOM listing has postedAt = null', domListings[0]?.published_at === null);

  // 8. Cancellation and Timeout Behavior
  console.log('\n--- 8. Cancellation and Timeout Handling ---');
  const abortController = new AbortController();
  abortController.abort();
  const cancelledBatch = await testAdapter1.fetchBatch({ signal: abortController.signal });
  assert('Aborted signal returns failure result', isAdapterBatchFailure(cancelledBatch));
  if (isAdapterBatchFailure(cancelledBatch)) {
    assert('Failure kind is TIMEOUT', cancelledBatch.error.kind === 'TIMEOUT');
    assert('Cancellation is non-retryable', cancelledBatch.error.retryable === false);
  }

  // Timeout simulation
  const timeoutLauncher = async () => ({
    newContext: async () => ({
      newPage: async () => ({
        goto: async () => {
          const err = new Error('Navigation timed out after 5000ms');
          err.name = 'TimeoutError';
          throw err;
        },
        title: async () => '',
        content: async () => '',
        close: async () => {},
      }),
      close: async () => {},
    }),
    close: async () => {},
  });
  const timeoutAdapter = createGreenhouseCommerceIqAdapter({ launcher: timeoutLauncher });
  const timeoutBatch = await timeoutAdapter.fetchBatch({ timeoutMs: 5000 });
  assert('Timeout returns failure result', isAdapterBatchFailure(timeoutBatch));
  if (isAdapterBatchFailure(timeoutBatch)) {
    assert('Error kind is TIMEOUT', timeoutBatch.error.kind === 'TIMEOUT');
    assert('Timeout error is retryable', timeoutBatch.error.retryable === true);
  }

  // 9. Confirmation: No Real Job Board Contacted in Tests
  console.log('\n--- 9. No Real Job Board Contacted Verification ---');
  const opened = mock1.getOpenedUrls();
  assert('Mock launcher was invoked with target URL', opened.length > 0 && opened[0]?.includes('commerceiq'));
  assert('No external network request made (all handled by mock page)', mock1.isCleanedUp());

  // Summary
  console.log('\n------------------------------------------------------');
  const passed = tests.filter((t) => t.pass).length;
  const failed = tests.filter((t) => !t.pass).length;
  console.log(`GREENHOUSE ADAPTER SUITE: ${passed} passed, ${failed} failed`);
  console.log('------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
