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

export const DRIVETRAIN_BOARD_TOKEN = 'drivetrain';
export const DRIVETRAIN_BOARD_URL = 'https://jobs.lever.co/drivetrain';

export interface LeverRawListing {
  readonly id: string;
  readonly title: string;
  readonly company?: string;
  readonly jobUrl: string;
  readonly applyUrl?: string | null;
  readonly workplaceType?: string | null;
  readonly commitment?: string | null;
  readonly location?: string | null;
  readonly department?: string | null;
  readonly postedAt?: string | null;
  readonly description?: string | null;
}

export const parseLeverLocation = (rawLoc?: string | null): JobLocation | null => {
  if (!rawLoc || typeof rawLoc !== 'string') return null;
  const str = rawLoc.replace(/[—–]/g, '').trim();
  if (str.length === 0) return null;

  const parts = str.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  if (parts.length === 1) {
    const single = parts[0]!;
    // Common country / territory values
    const isCountry = /^(india|united states|us|uk|united kingdom|canada|germany|remote)$/i.test(single);
    return {
      city: isCountry ? null : single,
      state: null,
      country: single,
      rawLocation: str,
    };
  }

  const city = parts[0] ?? null;
  const last = parts[parts.length - 1] ?? null;
  const state = parts.length > 2 ? parts[1] ?? null : null;

  return {
    city,
    state,
    country: last,
    rawLocation: str,
  };
};

export const mapLeverWorkplaceType = (
  rawWorkplace?: string | null,
  defaultType?: 'remote' | 'hybrid' | 'on_site'
): 'remote' | 'hybrid' | 'on_site' => {
  if (!rawWorkplace) return defaultType ?? 'on_site';
  const lower = rawWorkplace.toLowerCase();
  if (lower.includes('hybrid')) return 'hybrid';
  if (lower.includes('remote')) return 'remote';
  if (lower.includes('on-site') || lower.includes('onsite')) return 'on_site';
  return defaultType ?? 'on_site';
};

export const mapLeverEmploymentType = (
  commitment?: string | null
): 'full_time' | 'part_time' | 'contract' | 'internship' | 'other' | null => {
  if (!commitment) return null;
  const lower = commitment.toLowerCase();
  if (lower.includes('full time') || lower.includes('full-time')) return 'full_time';
  if (lower.includes('part time') || lower.includes('part-time')) return 'part_time';
  if (lower.includes('contract')) return 'contract';
  if (lower.includes('intern')) return 'internship';
  return 'other';
};

export const extractLeverListingsFromHtml = (
  html: string,
  boardCompany = 'Drivetrain'
): readonly LeverRawListing[] => {
  if (!html || typeof html !== 'string' || html.trim().length === 0) {
    return [];
  }

  const listings: LeverRawListing[] = [];
  const parts = html.split('<div class="posting"');

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]!;
    const idMatch = part.match(/data-qa-posting-id="([^"]+)"/);
    const id = idMatch?.[1] ? idMatch[1].trim() : '';

    const titleMatch = part.match(/data-qa="posting-name"[^>]*>([^<]+)</);
    const title = titleMatch?.[1] ? titleMatch[1].trim() : '';

    const linkMatch = part.match(/<a class="posting-title"[^>]*href="([^"]+)"/);
    const jobUrl = linkMatch?.[1] ? linkMatch[1].trim() : '';

    const applyMatch =
      part.match(/class="[^"]*posting-apply[^"]*"[\s\S]*?href="([^"]+)"/) ||
      part.match(/<a[^>]+href="([^"]+)"[^>]+class="[^"]*posting-btn-submit[^"]*"/);
    const applyUrl = applyMatch?.[1] ? applyMatch[1].trim() : null;

    const wpMatch = part.match(/class="[^"]*workplaceTypes[^"]*"[^>]*>([^<]+)</);
    const workplaceType = wpMatch?.[1] ? wpMatch[1].replace(/[—–\-]/g, '').trim() : null;

    const commitMatch = part.match(/class="[^"]*commitment[^"]*"[^>]*>([^<]+)</);
    const commitment = commitMatch?.[1] ? commitMatch[1].trim() : null;

    const locMatch = part.match(/class="[^"]*location[^"]*"[^>]*>([^<]+)</);
    const location = locMatch?.[1] ? locMatch[1].trim() : null;

    if (id && title && jobUrl) {
      listings.push({
        id,
        title,
        company: boardCompany,
        jobUrl,
        applyUrl,
        workplaceType,
        commitment,
        location,
        department: null,
        postedAt: null,
      });
    }
  }

  return listings;
};

export const normalizeLeverListing = (
  raw: LeverRawListing,
  context: NormalizationContext
): JobNormalizationResult => {
  if (!raw || typeof raw !== 'object') {
    return createNormalizationFailure(['Listing record must be a valid non-null object.'], raw);
  }

  const isoCollection = context.collectionTimestamp.toISOString();
  const datePartition = isoCollection.slice(0, 10);
  const company = raw.company && raw.company.trim().length > 0 ? raw.company.trim() : 'Drivetrain';

  const job: Job = {
    id: `${String(context.sourceId)}_${raw.id}`,
    source: String(context.sourceId),
    sourceJobId: String(raw.id),
    title: raw.title ? raw.title.trim() : '',
    company,
    jobUrl: raw.jobUrl ? raw.jobUrl.trim() : '',
    applyUrl: raw.applyUrl ? raw.applyUrl.trim() : null,
    description: raw.description
      ? raw.description.trim()
      : `${raw.title} at ${company}. Location: ${raw.location || 'Unspecified'}. Employment: ${raw.commitment || 'Standard'}.`,
    employmentType: mapLeverEmploymentType(raw.commitment),
    location: parseLeverLocation(raw.location),
    workplaceType: mapLeverWorkplaceType(raw.workplaceType, context.defaultWorkplaceType),
    relocation: null,
    postedAt: raw.postedAt && isValidIsoDate(raw.postedAt) ? raw.postedAt : null,
    collectedAt: isoCollection,
    collectionDate: datePartition,
    qualifications: createDefaultQualifications(),
    experience: null,
    salary: null,
    sourceMetadata: {
      leverPostingId: raw.id,
      department: raw.department || null,
    },
  };

  const validation = validateJob(job);
  if (!validation.valid) {
    return createNormalizationFailure(validation.errors, raw);
  }

  return createNormalizationSuccess(job);
};

export const createLeverBrowserAdapter = (
  options: {
    readonly boardToken: string;
    readonly displayName?: string;
    readonly companyName?: string;
    readonly launcher?: BrowserLauncher;
    readonly defaultWorkplaceType?: 'remote' | 'hybrid' | 'on_site';
  }
): JobSourceAdapter => {
  const token = options.boardToken;
  const boardUrl = `https://jobs.lever.co/${token}`;
  const companyName = options.companyName || token.charAt(0).toUpperCase() + token.slice(1);
  const displayName = options.displayName || `${companyName} Careers (Lever Board)`;
  const sourceId = `lever_${token}`;

  const config: BrowserAdapterConfig<LeverRawListing> = {
    sourceId,
    displayName,
    launcher: options.launcher,
    buildUrl: (_opts: AdapterQueryOptions) => boardUrl,
    extractRecords: async (page: MinimalBrowserPage) => {
      const html = await page.content();
      const listings = extractLeverListingsFromHtml(html, companyName);

      try {
        const resp = await fetch(`https://api.lever.co/v0/postings/${token}?mode=json`);
        if (resp.ok) {
          const apiList = (await resp.json()) as Array<{
            id?: string;
            createdAt?: number;
            descriptionPlain?: string;
            applyUrl?: string;
          }>;
          if (Array.isArray(apiList)) {
            const apiMap: Record<string, { postedAt?: string; description?: string; applyUrl?: string }> = {};
            for (const item of apiList) {
              if (item && item.id) {
                apiMap[String(item.id)] = {
                  postedAt: typeof item.createdAt === 'number' ? new Date(item.createdAt).toISOString() : undefined,
                  description: item.descriptionPlain || undefined,
                  applyUrl: item.applyUrl || undefined,
                };
              }
            }
            return listings.map((l) => {
              const meta = apiMap[l.id];
              return {
                ...l,
                postedAt: meta?.postedAt || l.postedAt || null,
                description: meta?.description || l.description || null,
                applyUrl: l.applyUrl || meta?.applyUrl || null,
              };
            });
          }
        }
      } catch {
        // Fall back to HTML-extracted listings if API enrichment fails
      }

      return listings;
    },
    normalizeRecord: normalizeLeverListing,
    defaultWorkplaceType: options.defaultWorkplaceType ?? 'remote',
  };

  return createBrowserJobSourceAdapter(config);
};

export const createLeverDrivetrainAdapter = (
  options?: {
    readonly launcher?: BrowserLauncher;
  }
): JobSourceAdapter => {
  return createLeverBrowserAdapter({
    boardToken: DRIVETRAIN_BOARD_TOKEN,
    displayName: 'Drivetrain Careers (Lever Board)',
    companyName: 'Drivetrain',
    launcher: options?.launcher,
    defaultWorkplaceType: 'remote',
  });
};
