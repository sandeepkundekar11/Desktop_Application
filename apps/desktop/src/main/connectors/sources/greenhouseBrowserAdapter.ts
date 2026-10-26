import {
  createBrowserJobSourceAdapter,
  BrowserAdapterConfig,
} from '../browserAdapterTemplate.js';
import {
  JobSourceAdapter,
  AdapterQueryOptions,
  NormalizationContext,
  JobNormalizationResult,
  createNormalizationSuccess,
  createNormalizationFailure,
} from '../adapterContract.js';
import {
  Job,
  JobLocation,
  validateJob,
  isValidIsoDate,
  createDefaultQualifications,
} from '../../storage/jobSchema.js';
import { BrowserLauncher, MinimalBrowserPage } from '../../automation/browserEngine.js';

export const COMMERCEIQ_BOARD_TOKEN = 'commerceiq';
export const COMMERCEIQ_BOARD_URL = 'https://job-boards.greenhouse.io/commerceiq';

export interface GreenhouseRawListing {
  readonly id: string | number;
  readonly title: string;
  readonly company_name?: string;
  readonly company?: string;
  readonly absolute_url?: string;
  readonly jobUrl?: string;
  readonly location?: string | { name?: string };
  readonly published_at?: string | null;
  readonly updated_at?: string | null;
  readonly department?: string | { name?: string };
  readonly requisition_id?: string | null;
}

export const parseGreenhouseLocation = (rawLoc?: string | { name?: string }): JobLocation | null => {
  if (!rawLoc) return null;
  const str = typeof rawLoc === 'string' ? rawLoc.trim() : String(rawLoc.name || '').trim();
  if (str.length === 0) return null;

  const parts = str.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const p0 = parts[0] ?? null;
  const p1 = parts[1] ?? null;
  const pLast = parts[parts.length - 1] ?? null;

  if (parts.length === 1) {
    return { city: null, state: null, country: p0, rawLocation: str };
  }
  if (parts.length === 2) {
    return { city: p0, state: null, country: p1, rawLocation: str };
  }
  return {
    city: p0,
    state: p1,
    country: pLast,
    rawLocation: str,
  };
};

export const extractGreenhouseListingsFromHtml = (html: string): readonly GreenhouseRawListing[] => {
  if (!html || typeof html !== 'string' || html.trim().length === 0) {
    return [];
  }

  // 1. Primary Strategy: Extract structured state from window.__remixContext if present
  const remixMatch = html.match(/window\.__remixContext\s*=\s*(\{[\s\S]+?\});\s*<\/script>/);
  if (remixMatch && remixMatch[1]) {
    try {
      const parsed = JSON.parse(remixMatch[1]);
      const data = parsed?.state?.loaderData?.['routes/$url_token']?.jobPosts?.data;
      if (Array.isArray(data) && data.length > 0) {
        return data.map((item) => ({
          id: String(item.id || ''),
          title: String(item.title || ''),
          company: parsed?.state?.loaderData?.['routes/$url_token']?.board?.name || 'CommerceIQ',
          absolute_url: item.absolute_url,
          jobUrl: item.absolute_url,
          location: item.location,
          published_at: item.published_at || null,
          updated_at: item.updated_at || null,
          department: item.department?.name || item.department,
          requisition_id: item.requisition_id || null,
        }));
      }
    } catch {
      // Fall through to DOM parsing fallback
    }
  }

  // 2. Fallback Strategy: Extract job posts from server-rendered HTML markup
  const listings: GreenhouseRawListing[] = [];
  const rowRegex = /<tr class="job-post"[^>]*>([\s\S]*?)<\/tr>/g;
  let match: RegExpExecArray | null;

  while ((match = rowRegex.exec(html)) !== null) {
    const rowHtml = match[1];
    if (!rowHtml) continue;

    const linkMatch = rowHtml.match(/<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!linkMatch) continue;

    const jobUrl = linkMatch[1] ?? '';
    const innerHtml = linkMatch[2] ?? '';

    const titleMatch = innerHtml.match(/<p class="body body--medium">([^<]+)<\/p>/);
    const title = titleMatch?.[1] ? titleMatch[1].trim() : '';

    const locMatch = innerHtml.match(/<p class="body body__secondary body--metadata">([^<]+)<\/p>/);
    const location = locMatch?.[1] ? locMatch[1].trim() : undefined;

    const idMatch = jobUrl.match(/\/jobs\/(\d+)/);
    const id = idMatch?.[1] ?? `gh-${listings.length + 1}`;

    listings.push({
      id,
      title,
      company: 'CommerceIQ',
      jobUrl,
      absolute_url: jobUrl,
      location,
      published_at: null, // DOM row does not render publish date; preserve genuine absence as null
    });
  }

  return listings;
};

export const normalizeGreenhouseListing = (
  raw: GreenhouseRawListing,
  context: NormalizationContext
): JobNormalizationResult => {
  if (!raw || typeof raw !== 'object') {
    return createNormalizationFailure(['Listing record is not an object'], raw);
  }

  const jobUrl = String(raw.jobUrl || raw.absolute_url || '').trim();
  const title = String(raw.title || '').trim();
  const company = String(raw.company || raw.company_name || 'CommerceIQ').trim();
  const rawId = String(raw.id || '').trim();

  // Validate genuine publication date without fabricating collection date
  let postedAt: string | null = null;
  if (raw.published_at && isValidIsoDate(raw.published_at)) {
    postedAt = raw.published_at;
  }

  const location = parseGreenhouseLocation(raw.location);
  const locStr = location?.rawLocation?.toLowerCase() || '';
  let workplaceType: 'remote' | 'hybrid' | 'on_site' | null = context.defaultWorkplaceType ?? null;
  if (locStr.includes('remote')) {
    workplaceType = 'remote';
  } else if (locStr.includes('hybrid')) {
    workplaceType = 'hybrid';
  } else if (location && !workplaceType) {
    workplaceType = 'on_site';
  }

  const job: Job = {
    id: `${context.sourceId}_${rawId || Math.random().toString(36).slice(2)}`,
    source: context.sourceId,
    sourceJobId: rawId || null,
    title,
    company,
    jobUrl,
    applyUrl: jobUrl ? `${jobUrl.replace(/\/$/, '')}#app` : null,
    description: null,
    employmentType: 'full_time',
    location,
    workplaceType,
    relocation: null,
    postedAt,
    collectedAt: context.collectionTimestamp.toISOString(),
    collectionDate: context.collectionTimestamp.toISOString().slice(0, 10),
    qualifications: createDefaultQualifications(),
    experience: null,
    salary: null,
    sourceMetadata: {
      boardIdentifier: COMMERCEIQ_BOARD_TOKEN,
      department: typeof raw.department === 'string' ? raw.department : raw.department?.name,
      requisitionId: raw.requisition_id || null,
    },
  };

  const validation = validateJob(job);
  if (!validation.valid) {
    return createNormalizationFailure(validation.errors, raw);
  }

  return createNormalizationSuccess(job);
};

export const createGreenhouseCommerceIqAdapter = (
  options?: {
    readonly boardToken?: string;
    readonly launcher?: BrowserLauncher;
  }
): JobSourceAdapter => {
  const boardToken = options?.boardToken || COMMERCEIQ_BOARD_TOKEN;
  const boardUrl = `https://job-boards.greenhouse.io/${boardToken}`;

  const config: BrowserAdapterConfig<GreenhouseRawListing> = {
    sourceId: 'greenhouse_commerceiq',
    displayName: 'CommerceIQ Careers (Greenhouse Board)',
    launcher: options?.launcher,
    buildUrl: (_opts: AdapterQueryOptions) => boardUrl,
    extractRecords: async (page: MinimalBrowserPage) => {
      const html = await page.content();
      return extractGreenhouseListingsFromHtml(html);
    },
    normalizeRecord: normalizeGreenhouseListing,
    defaultWorkplaceType: 'hybrid',
  };

  return createBrowserJobSourceAdapter(config);
};
