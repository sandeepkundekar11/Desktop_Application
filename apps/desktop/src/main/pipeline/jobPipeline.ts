import path from 'node:path';
import fs from 'node:fs';
import { loadProfile } from '../storage/jsonProfileRepository.js';
import { loadConnectors } from '../storage/jsonConnectorRepository.js';
import { getTargetStorageLocations } from '../storage/targetStorageLocations.js';
import { writeJsonAtomic } from '../storage/atomicFileWriter.js';
import { Job, isValidIsoDate } from '../storage/jobSchema.js';
import { BrowserLauncher } from '../automation/browserEngine.js';
import { JobSourceAdapter, isAdapterBatchSuccess } from '../connectors/adapterContract.js';
import { createGreenhouseCommerceIqAdapter } from '../connectors/sources/greenhouseBrowserAdapter.js';
import { calculateJobMatchScore, MATCH_THRESHOLD } from '../scoring/jobScorer.js';

import { MinimalProfile } from '../storage/minimalProfileSchema.js';

export interface RejectedListingReport {
  readonly jobId: string;
  readonly title: string;
  readonly company: string;
  readonly source: string;
  readonly reason: string;
}

export interface SourceExecutionStatus {
  readonly sourceId: string;
  readonly displayName: string;
  readonly status: 'executed' | 'stopped' | 'failed' | 'skipped';
  readonly message: string;
  readonly rawCount: number;
  readonly validCount: number;
}

export interface PipelineReport {
  readonly collectionDate: string;
  readonly timestamp: string;
  readonly sources: readonly SourceExecutionStatus[];
  readonly discoveredCount: number;
  readonly normalizedCount: number;
  readonly qualifiedCount: number;
  readonly rejectedCount: number;
  readonly deduplicatedCount: number;
  readonly savedCount: number;
  readonly savedPath: string | null;
  readonly rejectedListings: readonly RejectedListingReport[];
  readonly qualifyingJobs: readonly Job[];
}

export interface PipelineOptions {
  readonly overrideStorageRoot?: string;
  readonly customProfile?: MinimalProfile;
  readonly customLauncher?: BrowserLauncher;
  readonly customAdapters?: readonly JobSourceAdapter[];
  readonly mockCurrentDate?: Date;
}

const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;

export const normalizeDedupeKey = (job: Job): string => {
  const normUrl = job.jobUrl
    .toLowerCase()
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
    .trim();
  const normTitle = job.title.toLowerCase().trim();
  const normCompany = job.company.toLowerCase().trim();
  const city = job.location?.city?.toLowerCase().trim() || '';
  return `${normUrl}:::${normCompany}:::${normTitle}:::${city}`;
};

export const executeFindJobsPipeline = async (
  options: PipelineOptions = {}
): Promise<PipelineReport> => {
  const now = options.mockCurrentDate ?? new Date();
  const collectionDate = now.toISOString().slice(0, 10);
  const locations = getTargetStorageLocations(options.overrideStorageRoot);

  // 1. Read candidate profile
  const profile = options.customProfile ?? loadProfile(options.overrideStorageRoot);

  // 2. Read connector configuration
  const connectorsConfig = loadConnectors(options.overrideStorageRoot);

  const sourcesStatus: SourceExecutionStatus[] = [];
  const allExtractedJobs: Job[] = [];
  let discoveredCount = 0;
  let normalizedCount = 0;

  // 3. Identify and run permitted sources
  // Check configured connectors from connectors.json first and report stopped status
  for (const conn of connectorsConfig.connectors) {
    if (conn.isEnabled) {
      if (['linkedin', 'wellfound', 'instahyre'].includes(conn.id)) {
        sourcesStatus.push({
          sourceId: conn.id,
          displayName: conn.name,
          status: 'stopped',
          message: `Stopped: ${conn.name} requires authentication and anti-bot controls. Automated scraping not permitted.`,
          rawCount: 0,
          validCount: 0,
        });
      } else {
        sourcesStatus.push({
          sourceId: conn.id,
          displayName: conn.name,
          status: 'skipped',
          message: `Skipped: ${conn.name} implementation scheduled in future chunk.`,
          rawCount: 0,
          validCount: 0,
        });
      }
    }
  }

  // Permitted job board adapters
  const adapters: readonly JobSourceAdapter[] =
    options.customAdapters ?? [
      createGreenhouseCommerceIqAdapter({ launcher: options.customLauncher }),
    ];

  for (const adapter of adapters) {
    try {
      const batch = await adapter.fetchBatch({
        keywords: profile.work_preference?.preferred_job_titles || [profile.professional.professional_heading],
        locationPreference: profile.user_info.city || 'India',
      });

      if (isAdapterBatchSuccess(batch)) {
        discoveredCount += batch.rawCount;
        normalizedCount += batch.validCount;
        allExtractedJobs.push(...batch.jobs);

        sourcesStatus.push({
          sourceId: String(adapter.sourceId),
          displayName: adapter.displayName,
          status: 'executed',
          message: `Successfully extracted ${batch.validCount} normalized listings.`,
          rawCount: batch.rawCount,
          validCount: batch.validCount,
        });
      } else {
        sourcesStatus.push({
          sourceId: String(adapter.sourceId),
          displayName: adapter.displayName,
          status: 'failed',
          message: `Failed: ${batch.error.message}`,
          rawCount: 0,
          validCount: 0,
        });
      }
    } catch (err) {
      sourcesStatus.push({
        sourceId: String(adapter.sourceId),
        displayName: adapter.displayName,
        status: 'failed',
        message: `Exception: ${err instanceof Error ? err.message : String(err)}`,
        rawCount: 0,
        validCount: 0,
      });
    }
  }

  // 4. Scoring, Freshness Filtering, and Deduplication
  const rejectedListings: RejectedListingReport[] = [];
  const scoredQualifiedJobs: Job[] = [];
  const seenDedupeKeys = new Map<string, string>(); // dedupeKey -> jobId
  let deduplicatedCount = 0;

  for (const job of allExtractedJobs) {
    // A. Deduplication check
    const dedupeKey = normalizeDedupeKey(job);
    const existingJobId = seenDedupeKeys.get(dedupeKey);
    if (existingJobId) {
      deduplicatedCount++;
      rejectedListings.push({
        jobId: job.id,
        title: job.title,
        company: job.company,
        source: job.source,
        reason: `Rejected as duplicate of earlier listing (ID: ${existingJobId}).`,
      });
      continue;
    }

    // B. Calculate explainable match score
    const scoreResult = calculateJobMatchScore(job, profile);
    const scoredJob: Job = {
      ...job,
      match: {
        score: scoreResult.score,
        evaluatedAt: now.toISOString(),
      },
    };

    // C. Strict threshold check (score > 75)
    if (!scoreResult.isQualified) {
      rejectedListings.push({
        jobId: job.id,
        title: job.title,
        company: job.company,
        source: job.source,
        reason: `Score ${scoreResult.score}% does not exceed threshold of ${MATCH_THRESHOLD}%. (Skills: ${scoreResult.breakdown.skills}/35, Title: ${scoreResult.breakdown.title}/25, Exp: ${scoreResult.breakdown.experience}/20, Loc: ${scoreResult.breakdown.location}/10, Sal: ${scoreResult.breakdown.salary}/10)`,
      });
      continue;
    }

    // D. Trustworthy Publication Date & 6-Day Freshness Window
    if (!scoredJob.postedAt || !isValidIsoDate(scoredJob.postedAt)) {
      rejectedListings.push({
        jobId: job.id,
        title: job.title,
        company: job.company,
        source: job.source,
        reason: 'Missing trustworthy publication date to verify 6-day freshness requirement. Date not fabricated.',
      });
      continue;
    }

    const postedTime = new Date(scoredJob.postedAt).getTime();
    const ageMs = now.getTime() - postedTime;
    if (ageMs > SIX_DAYS_MS) {
      const daysOld = (ageMs / (24 * 60 * 60 * 1000)).toFixed(1);
      rejectedListings.push({
        jobId: job.id,
        title: job.title,
        company: job.company,
        source: job.source,
        reason: `Published on ${scoredJob.postedAt.slice(0, 10)} (${daysOld} days old), exceeding the 6-day freshness window.`,
      });
      continue;
    }

    // Listing passed all filters!
    seenDedupeKeys.set(dedupeKey, job.id);
    scoredQualifiedJobs.push(scoredJob);
  }

  // 5. Persistence: Save only qualifying jobs to data/jobs/YYYY-MM-DD/jobs.json
  // Do not create empty daily directories or files when there are no qualifying jobs
  let savedPath: string | null = null;
  if (scoredQualifiedJobs.length > 0) {
    const dailyJobsDir = path.join(locations.root, 'jobs', collectionDate);
    savedPath = path.join(dailyJobsDir, 'jobs.json');
    writeJsonAtomic(savedPath, scoredQualifiedJobs, true);
  }

  return {
    collectionDate,
    timestamp: now.toISOString(),
    sources: sourcesStatus,
    discoveredCount,
    normalizedCount,
    qualifiedCount: scoredQualifiedJobs.length,
    rejectedCount: rejectedListings.length,
    deduplicatedCount,
    savedCount: scoredQualifiedJobs.length,
    savedPath,
    rejectedListings,
    qualifyingJobs: scoredQualifiedJobs,
  };
};
