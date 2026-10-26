import { importLocal, createTestCollector, desktopRoot } from './db-test-helpers.mjs';

const {
  navigateAndExtract,
  withBrowser,
  clampTimeout,
  isValidHttpUrl,
  MIN_NAVIGATION_TIMEOUT_MS,
  MAX_NAVIGATION_TIMEOUT_MS,
  DEFAULT_NAVIGATION_TIMEOUT_MS,
} = await importLocal('dist-electron/main/automation/browserEngine.js');

const { tests, assert } = createTestCollector();

async function runTests() {
  console.log('\n======================================================');
  console.log('       APPLYPILOT BROWSER ENGINE FOUNDATION TESTS');
  console.log('======================================================\n');

  // 1. Timeout Clamping and Validation
  console.log('--- 1. Safe Timeout Bounds Clamping ---');
  assert('Default timeout is 30,000ms', clampTimeout() === DEFAULT_NAVIGATION_TIMEOUT_MS);
  assert('Below min (500ms) clamps to 1,000ms', clampTimeout(500) === MIN_NAVIGATION_TIMEOUT_MS);
  assert('Above max (120,000ms) clamps to 60,000ms', clampTimeout(120000) === MAX_NAVIGATION_TIMEOUT_MS);
  assert('Valid timeout (15,000ms) is preserved', clampTimeout(15000) === 15000);
  assert('NaN clamps to default timeout', clampTimeout(Number.NaN) === DEFAULT_NAVIGATION_TIMEOUT_MS);

  // 2. URL Validation
  console.log('\n--- 2. URL Validation ---');
  assert('Valid HTTPS URL accepted', isValidHttpUrl('https://example.com/careers'));
  assert('Valid HTTP URL accepted', isValidHttpUrl('http://localhost:3000/jobs'));
  assert('FTP protocol rejected', !isValidHttpUrl('ftp://example.com/file'));
  assert('Empty string rejected', !isValidHttpUrl(''));
  assert('Malformed string rejected', !isValidHttpUrl('not_a_valid_url'));

  // 3. Graceful Handling When Playwright is Not Available
  console.log('\n--- 3. Handling Uninstalled Playwright ---');
  process.env.APPLYPILOT_SIMULATE_NO_PLAYWRIGHT = '1';
  const noLauncherResult = await navigateAndExtract('https://example.com/test', async () => 'data');
  delete process.env.APPLYPILOT_SIMULATE_NO_PLAYWRIGHT;
  assert('Returns explicit failure without throwing', noLauncherResult.success === false);
  if (!noLauncherResult.success) {
    assert('Error kind is PLAYWRIGHT_NOT_INSTALLED', noLauncherResult.error.kind === 'PLAYWRIGHT_NOT_INSTALLED');
    assert('Error message explains missing dependency', noLauncherResult.error.message.includes('Playwright is not available'));
  }

  // 4. Invalid URL Rejection Prior to Launch
  console.log('\n--- 4. Invalid URL Rejection Prior to Launch ---');
  const invalidUrlResult = await navigateAndExtract('invalid-url-string', async () => 'data', {
    launcher: async () => { throw new Error('Launcher should not be called on invalid URL'); },
  });
  assert('Invalid URL returns failure', invalidUrlResult.success === false);
  if (!invalidUrlResult.success) {
    assert('Error kind is INVALID_URL', invalidUrlResult.error.kind === 'INVALID_URL');
  }

  // 5. Complete Lifecycle & Reliable Cleanup With Mock Driver
  console.log('\n--- 5. Lifecycle Management and Reliable Resource Cleanup ---');
  let browserClosed = false;
  let contextClosed = false;
  let pageClosed = false;
  let visitedUrl = '';

  const mockLauncher = async () => ({
    newContext: async () => ({
      newPage: async () => ({
        goto: async (url) => { visitedUrl = url; },
        title: async () => 'Careers at Example Corp',
        content: async () => '<html><body><h1>Open Positions</h1></body></html>',
        close: async () => { pageClosed = true; },
      }),
      close: async () => { contextClosed = true; },
    }),
    close: async () => { browserClosed = true; },
  });

  const successResult = await navigateAndExtract(
    'https://example.com/careers',
    async (page) => {
      const title = await page.title();
      const content = await page.content();
      return { title, length: content.length };
    },
    { launcher: mockLauncher }
  );

  assert('Navigation and extraction returns success = true', successResult.success === true);
  if (successResult.success) {
    assert('Visited expected caller URL', visitedUrl === 'https://example.com/careers');
    assert('Extracted page title correctly', successResult.data.title === 'Careers at Example Corp');
    assert('Page length is positive', successResult.data.length > 0);
  }
  assert('Page was reliably closed in cleanup', pageClosed === true);
  assert('Context was reliably closed in cleanup', contextClosed === true);
  assert('Browser was reliably closed in cleanup', browserClosed === true);

  // 6. Reliable Cleanup on Extraction Failure
  console.log('\n--- 6. Cleanup Guarantee on Extractor Exception ---');
  let browserClosedAfterFail = false;
  let pageClosedAfterFail = false;

  const failLauncher = async () => ({
    newContext: async () => ({
      newPage: async () => ({
        goto: async () => {},
        title: async () => '',
        content: async () => '',
        close: async () => { pageClosedAfterFail = true; },
      }),
      close: async () => {},
    }),
    close: async () => { browserClosedAfterFail = true; },
  });

  const failedExtractionResult = await navigateAndExtract(
    'https://example.com/failing',
    async () => {
      throw new Error('Simulated DOM parsing exception');
    },
    { launcher: failLauncher }
  );

  assert('Extraction failure returns success = false', failedExtractionResult.success === false);
  if (!failedExtractionResult.success) {
    assert('Error kind is EXECUTION_ERROR', failedExtractionResult.error.kind === 'EXECUTION_ERROR');
    assert('Error message contains original cause', failedExtractionResult.error.message.includes('Simulated DOM parsing exception'));
  }
  assert('Page closed despite extractor exception', pageClosedAfterFail === true);
  assert('Browser closed despite extractor exception', browserClosedAfterFail === true);

  // 7. Navigation Timeout Handling
  console.log('\n--- 7. Navigation Timeout Handling ---');
  const timeoutLauncher = async () => ({
    newContext: async () => ({
      newPage: async () => ({
        goto: async () => {
          const timeoutErr = new Error('page.goto: Timeout 1000ms exceeded.');
          timeoutErr.name = 'TimeoutError';
          throw timeoutErr;
        },
        title: async () => '',
        content: async () => '',
        close: async () => {},
      }),
      close: async () => {},
    }),
    close: async () => {},
  });

  const timeoutResult = await navigateAndExtract(
    'https://example.com/slow',
    async () => 'never_reached',
    { timeoutMs: 1000, launcher: timeoutLauncher }
  );

  assert('Timeout returns success = false', timeoutResult.success === false);
  if (!timeoutResult.success) {
    assert('Error kind is TIMEOUT', timeoutResult.error.kind === 'TIMEOUT');
    assert('Error message contains timeout details', timeoutResult.error.message.includes('timed out after 1000ms'));
  }

  // 8. Cancellation Via AbortSignal
  console.log('\n--- 8. AbortSignal Cancellation ---');
  const preAbortedController = new AbortController();
  preAbortedController.abort();

  let launcherCalled = false;
  const preAbortedResult = await navigateAndExtract(
    'https://example.com/cancelled',
    async () => 'never',
    {
      signal: preAbortedController.signal,
      launcher: async () => {
        launcherCalled = true;
        throw new Error('Should not be called');
      },
    }
  );

  assert('Pre-aborted signal returns success = false', preAbortedResult.success === false);
  assert('Launcher was never called when signal was pre-aborted', launcherCalled === false);
  if (!preAbortedResult.success) {
    assert('Error kind is CANCELLED', preAbortedResult.error.kind === 'CANCELLED');
  }

  // 9. Source File Size Audit (< 300 Lines)
  console.log('\n--- 9. File Length Verification (< 300 Lines) ---');
  const pathMod = await import('node:path');
  const targetFile = pathMod.resolve(desktopRoot, 'src/main/automation/browserEngine.ts');
  const fsTarget = (await import('node:fs')).readFileSync(targetFile, 'utf8').split('\n').length;
  assert(`browserEngine.ts has ${fsTarget} lines (< 300 lines limit)`, fsTarget < 300);

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
