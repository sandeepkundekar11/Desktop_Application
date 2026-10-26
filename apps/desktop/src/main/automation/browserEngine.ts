export type BrowserEngineErrorKind =
  | 'PLAYWRIGHT_NOT_INSTALLED'
  | 'INVALID_URL'
  | 'LAUNCH_FAILED'
  | 'NAVIGATION_FAILED'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'EXTRACTION_ERROR'
  | 'EXECUTION_ERROR'
  | 'CLEANUP_ERROR';

export interface BrowserEngineError {
  readonly kind: BrowserEngineErrorKind;
  readonly message: string;
  readonly cause?: unknown;
}

export type BrowserEngineResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: BrowserEngineError };

export interface BrowserNavigationOptions {
  readonly timeoutMs?: number;
  readonly waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  readonly signal?: AbortSignal;
}

export interface BrowserSessionOptions extends BrowserNavigationOptions {
  readonly headless?: boolean;
  readonly userAgent?: string;
}

export interface MinimalBrowserPage {
  goto: (url: string, options?: { timeout?: number; waitUntil?: string }) => Promise<unknown>;
  title: () => Promise<string>;
  content: () => Promise<string>;
  close: () => Promise<void>;
}

export interface MinimalBrowserContext {
  newPage: () => Promise<MinimalBrowserPage>;
  close: () => Promise<void>;
}

export interface MinimalBrowserInstance {
  newContext: (options?: { userAgent?: string }) => Promise<MinimalBrowserContext>;
  close: () => Promise<void>;
}

export interface BrowserLaunchOptions {
  readonly headless?: boolean;
  readonly channel?: string;
}

export type BrowserLauncher = (options?: BrowserLaunchOptions) => Promise<MinimalBrowserInstance>;

export const MIN_NAVIGATION_TIMEOUT_MS = 1000;
export const MAX_NAVIGATION_TIMEOUT_MS = 60000;
export const DEFAULT_NAVIGATION_TIMEOUT_MS = 30000;

export const clampTimeout = (timeoutMs?: number): number => {
  if (timeoutMs === undefined || Number.isNaN(timeoutMs)) {
    return DEFAULT_NAVIGATION_TIMEOUT_MS;
  }
  return Math.min(Math.max(timeoutMs, MIN_NAVIGATION_TIMEOUT_MS), MAX_NAVIGATION_TIMEOUT_MS);
};

export const isValidHttpUrl = (url: unknown): boolean => {
  if (typeof url !== 'string' || url.trim().length === 0) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const loadPlaywrightModule = async (): Promise<{ chromium: { launch: (options?: BrowserLaunchOptions) => Promise<MinimalBrowserInstance> } } | null> => {
  if (process.env.APPLYPILOT_SIMULATE_NO_PLAYWRIGHT === '1') {
    return null;
  }
  const dynamicImport = async (modName: string) => {
    try {
      const loader = new Function('specifier', 'return import(specifier)');
      const loaded = (await loader(modName)) as unknown as { chromium?: { launch?: (options?: BrowserLaunchOptions) => Promise<MinimalBrowserInstance> } };
      if (loaded?.chromium?.launch && typeof loaded.chromium.launch === 'function') {
        return loaded as { chromium: { launch: (options?: BrowserLaunchOptions) => Promise<MinimalBrowserInstance> } };
      }
      return null;
    } catch {
      return null;
    }
  };

  const pw = await dynamicImport('playwright');
  if (pw) return pw;
  return await dynamicImport('playwright-core');
};

export const createEngineError = (
  kind: BrowserEngineErrorKind,
  message: string,
  cause?: unknown
): BrowserEngineError => ({
  kind,
  message,
  cause,
});

export const withBrowser = async <T>(
  action: (browser: MinimalBrowserInstance) => Promise<T>,
  options?: BrowserSessionOptions & { launcher?: BrowserLauncher }
): Promise<BrowserEngineResult<T>> => {
  if (options?.signal?.aborted) {
    return {
      success: false,
      error: createEngineError('CANCELLED', 'Operation was cancelled prior to launching browser.'),
    };
  }

  let launcher = options?.launcher;
  if (!launcher) {
    const pw = await loadPlaywrightModule();
    if (!pw || !pw.chromium || typeof pw.chromium.launch !== 'function') {
      return {
        success: false,
        error: createEngineError(
          'PLAYWRIGHT_NOT_INSTALLED',
          'Playwright is not available in the environment. Browser automation requires playwright or playwright-core.'
        ),
      };
    }
    launcher = async (launchOpts) => {
      try {
        return await pw.chromium.launch(launchOpts);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Executable doesn't exist") || msg.includes('download new browsers')) {
          try {
            return await pw.chromium.launch({ ...launchOpts, channel: 'chrome' });
          } catch {
            return await pw.chromium.launch({ ...launchOpts, channel: 'msedge' });
          }
        }
        throw err;
      }
    };
  }

  let browser: MinimalBrowserInstance | null = null;

  try {
    browser = await launcher({ headless: options?.headless ?? true });
  } catch (launchErr) {
    return {
      success: false,
      error: createEngineError(
        'LAUNCH_FAILED',
        `Failed to launch browser: ${launchErr instanceof Error ? launchErr.message : String(launchErr)}`,
        launchErr
      ),
    };
  }

  try {
    if (options?.signal?.aborted) {
      return {
        success: false,
        error: createEngineError('CANCELLED', 'Operation was cancelled after browser launch.'),
      };
    }

    const result = await action(browser);
    return {
      success: true,
      data: result,
    };
  } catch (execErr) {
    if (options?.signal?.aborted || (execErr instanceof Error && execErr.name === 'AbortError')) {
      return {
        success: false,
        error: createEngineError('CANCELLED', 'Operation was cancelled during browser execution.', execErr),
      };
    }

    if (execErr instanceof Error && (execErr.name === 'TimeoutError' || /timed out/i.test(execErr.message))) {
      return {
        success: false,
        error: createEngineError('TIMEOUT', execErr.message, execErr),
      };
    }

    return {
      success: false,
      error: createEngineError(
        'EXECUTION_ERROR',
        `Browser execution error: ${execErr instanceof Error ? execErr.message : String(execErr)}`,
        execErr
      ),
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.warn(`[BrowserEngine] Warning during browser cleanup: ${String(closeErr)}`);
      }
    }
  }
};

export const navigateAndExtract = async <T>(
  url: string,
  extractor: (page: MinimalBrowserPage) => Promise<T>,
  options?: BrowserSessionOptions & { launcher?: BrowserLauncher }
): Promise<BrowserEngineResult<T>> => {
  if (!isValidHttpUrl(url)) {
    return {
      success: false,
      error: createEngineError('INVALID_URL', `Invalid navigation target URL: "${String(url)}"`),
    };
  }

  const effectiveTimeout = clampTimeout(options?.timeoutMs);

  return withBrowser(async (browser) => {
    let context: MinimalBrowserContext | null = null;
    let page: MinimalBrowserPage | null = null;

    try {
      context = await browser.newContext(
        options?.userAgent ? { userAgent: options.userAgent } : undefined
      );
      page = await context.newPage();

      // Setup cancellation listener
      let onAbort: (() => void) | null = null;
      if (options?.signal) {
        onAbort = () => {
          if (page) {
            page.close().catch(() => {});
          }
        };
        options.signal.addEventListener('abort', onAbort, { once: true });
      }

      try {
        await page.goto(url, {
          timeout: effectiveTimeout,
          waitUntil: options?.waitUntil ?? 'domcontentloaded',
        });
      } catch (navErr) {
        if (options?.signal?.aborted) {
          throw new Error('Navigation was cancelled by AbortSignal.');
        }
        const msg = navErr instanceof Error ? navErr.message : String(navErr);
        if (/timeout/i.test(msg)) {
          const timeoutErr = new Error(`Navigation to "${url}" timed out after ${effectiveTimeout}ms.`);
          timeoutErr.name = 'TimeoutError';
          throw timeoutErr;
        }
        throw new Error(`Navigation to "${url}" failed: ${msg}`);
      } finally {
        if (options?.signal && onAbort) {
          options.signal.removeEventListener('abort', onAbort);
        }
      }

      return await extractor(page);
    } finally {
      if (page) {
        try {
          await page.close();
        } catch {
          // ignore page close error
        }
      }
      if (context) {
        try {
          await context.close();
        } catch {
          // ignore context close error
        }
      }
    }
  }, options);
};
