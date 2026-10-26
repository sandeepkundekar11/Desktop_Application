import fs from 'node:fs';
import path from 'node:path';
import { importLocal, createTestCollector, desktopRoot } from './db-test-helpers.mjs';

const { executeFindJobsPipeline, normalizeDedupeKey } = await importLocal('dist-electron/main/pipeline/jobPipeline.js');
const { calculateJobMatchScore, MATCH_THRESHOLD } = await importLocal('dist-electron/main/scoring/jobScorer.js');
const { createBrowserJobSourceAdapter } = await importLocal('dist-electron/main/connectors/browserAdapterTemplate.js');
const { createDefaultQualifications } = await importLocal('dist-electron/main/storage/jobSchema.js');

const { tests, assert } = createTestCollector();

const buildTestJob = (overrides = {}) => ({
  id: overrides.id || `test-job-${Math.random().toString(36).slice(2, 7)}`,
  source: overrides.source || 'test_source',
  sourceJobId: overrides.sourceJobId || 'ext-1',
  title: overrides.title || 'Staff Frontend Engineer',
  company: overrides.company || 'CommerceIQ',
  jobUrl: overrides.jobUrl || 'https://job-boards.greenhouse.io/commerceiq/jobs/101',
  applyUrl: overrides.applyUrl || null,
  description: overrides.description || 'React, TypeScript, Next.js frontend engineering platform',
  employmentType: 'full_time',
  location: overrides.location !== undefined ? overrides.location : { city: 'Bengaluru', state: 'Karnataka', country: 'India', rawLocation: 'Bengaluru, Karnataka, India' },
  workplaceType: overrides.workplaceType || 'hybrid',
  relocation: null,
  postedAt: overrides.postedAt !== undefined ? overrides.postedAt : '2026-10-21T10:00:00.000Z',
  collectedAt: '2026-10-22T10:00:00.000Z',
  collectionDate: '2026-10-22',
  qualifications: createDefaultQualifications(),
  experience: overrides.experience !== undefined ? overrides.experience : null,
  salary: overrides.salary !== undefined ? overrides.salary : null,
  sourceMetadata: { boardIdentifier: 'commerceiq' },
});

const mockProfile = {
  user_info: {
    first_name: 'Sandeep', last_name: 'Kundekar', middle_name: 'N', email: 'sandeep@example.com',
    country_code: '+91', phone_number: '8217291928', country: 'India', state: 'Karnataka', city: 'Belgaum',
    street_address: '', zip_code: '', language: [],
  },
  professional: {
    professional_heading: 'React.js Developer',
    professional_summary: 'Frontend Developer with 3+ years experience with React, TypeScript, Next.js',
    experience: '3 roles documented',
    skills: ['React', 'TypeScript', 'Next.js', 'JavaScript', 'Redux', 'Playwright', 'Node.js', 'Tailwind CSS'],
    certificates: [],
    projects: [],
  },
  education: [],
  experience: [
    { job_title: 'React.js Developer', company: 'Technomind', location: 'Belgaum', start_date: '2025-04', end_date: '2026-04', description: 'Next.js, React' },
    { job_title: 'Frontend Developer', company: 'Priyaraja', location: 'Bengaluru', start_date: '2023-09', end_date: '2025-03', description: 'TypeScript, Playwright' },
  ],
  resume: { master_resume_url: 'resumes/master-resume.pdf' },
  work_preference: {
    expected_annual_salary_lpa: null, current_annual_salary: null, currency: 'INR', nationality: 'Indian',
    notice_period: '', preferred_job_titles: ['Frontend Developer', 'React.js Developer'], preferred_locations: ['Bengaluru', 'Remote'],
  },
  social_media: { linkedin_profile: '', github_link: '', portfolio_link: '' },
};

async function runTests() {
  console.log('\n======================================================\n APPLYPILOT /find-jobs PIPELINE TESTS\n======================================================\n');

  const now = new Date('2026-10-22T12:00:00.000Z');
  const tempTestDir = path.resolve(desktopRoot, 'temp-pipeline-test-' + Date.now());

  try {
    // 1. Scoring Weights & Threshold Filtering
    console.log('--- 1. Scoring Weights & Threshold Filtering ---');
    const highMatchJob = buildTestJob({
      title: 'Senior Frontend Developer (React)',
      description: 'Building web apps with React, TypeScript, Next.js and Redux',
      location: { city: 'Bengaluru', state: 'Karnataka', country: 'India', rawLocation: 'Bengaluru, India' },
    });
    const highMatchScore = calculateJobMatchScore(highMatchJob, mockProfile);
    assert('High match job score exceeds 75%', highMatchScore.score > 75, `Score: ${highMatchScore.score}%`);
    assert('High match job isQualified is true', highMatchScore.isQualified === true);
    assert('Skills score is awarded properly', highMatchScore.breakdown.skills >= 28);
    assert('Title score is awarded properly', highMatchScore.breakdown.title >= 20);
    assert('Location score is awarded properly', highMatchScore.breakdown.location === 10);
    assert('Missing salary gives 0 credit (not fabricated)', highMatchScore.breakdown.salary === 0);

    const irrelevantJob = buildTestJob({
      title: 'Senior Petroleum Drilling Engineer',
      description: 'Offshore oil extraction operations',
      location: { city: 'Houston', state: 'Texas', country: 'USA', rawLocation: 'Houston, TX' },
    });
    const lowMatchScore = calculateJobMatchScore(irrelevantJob, mockProfile);
    assert('Irrelevant job score is below 75%', lowMatchScore.score <= 75, `Score: ${lowMatchScore.score}%`);
    assert('Irrelevant job isQualified is false', lowMatchScore.isQualified === false);

    // 2. Freshness and Missing Date Rules
    console.log('\n--- 2. Freshness Window (6 Days) & Date Quality ---');
    const freshJob = buildTestJob({ id: 'fresh-1', postedAt: '2026-10-20T10:00:00.000Z' }); // 2 days old
    const staleJob = buildTestJob({ id: 'stale-1', postedAt: '2026-10-10T10:00:00.000Z' }); // 12 days old
    const noDateJob = buildTestJob({ id: 'nodate-1', postedAt: null });

    const adapterWithDates = createBrowserJobSourceAdapter({
      sourceId: 'mock_source_dates', displayName: 'Mock Dates Source',
      buildUrl: () => 'https://example.com/dates',
      extractRecords: async () => [freshJob, staleJob, noDateJob],
      normalizeRecord: (r) => ({ success: true, job: r }),
    });

    const dateReport = await executeFindJobsPipeline({
      customAdapters: [adapterWithDates],
      overrideStorageRoot: tempTestDir,
      mockCurrentDate: now,
    });

    assert('Fresh job is kept', dateReport.qualifyingJobs.some((j) => j.id === 'fresh-1'));
    assert('Stale job is rejected (>6 days)', dateReport.rejectedListings.some((r) => r.jobId === 'stale-1' && r.reason.includes('exceeding the 6-day freshness window')));
    assert('Job with missing date is rejected without date fabrication', dateReport.rejectedListings.some((r) => r.jobId === 'nodate-1' && r.reason.includes('Missing trustworthy publication date')));
    assert('Fresh job postedAt is not replaced with collection date', dateReport.qualifyingJobs.find((j) => j.id === 'fresh-1')?.postedAt === '2026-10-20T10:00:00.000Z');

    // 3. Deduplication Across Sources
    console.log('\n--- 3. Deduplication Across Sources ---');
    const jobA = buildTestJob({ id: 'job-orig', jobUrl: 'https://careers.example.com/jobs/42?utm_source=board', postedAt: '2026-10-21T00:00:00Z' });
    const jobB = buildTestJob({ id: 'job-dup', jobUrl: 'https://careers.example.com/jobs/42#apply', postedAt: '2026-10-21T00:00:00Z' });

    const dedupeAdapter = createBrowserJobSourceAdapter({
      sourceId: 'mock_dedupe_source', displayName: 'Mock Dedupe Source',
      buildUrl: () => 'https://example.com/dedupe',
      extractRecords: async () => [jobA, jobB],
      normalizeRecord: (r) => ({ success: true, job: r }),
    });

    const dedupeReport = await executeFindJobsPipeline({
      customAdapters: [dedupeAdapter],
      overrideStorageRoot: tempTestDir,
      mockCurrentDate: now,
    });

    assert('Deduplication identified 1 duplicate', dedupeReport.deduplicatedCount === 1);
    assert('Original job kept', dedupeReport.qualifyingJobs.some((j) => j.id === 'job-orig'));
    assert('Duplicate job rejected with explanation', dedupeReport.rejectedListings.some((r) => r.jobId === 'job-dup' && r.reason.includes('duplicate of earlier listing')));

    // 4. Persistence to data/jobs/YYYY-MM-DD/jobs.json
    console.log('\n--- 4. Persistence & Safe Atomic Output ---');
    assert('Qualifying jobs saved to disk', dedupeReport.savedCount > 0 && dedupeReport.savedPath !== null);
    if (dedupeReport.savedPath) {
      assert('File exists on filesystem', fs.existsSync(dedupeReport.savedPath));
      assert('Filename is jobs.json in date partition', dedupeReport.savedPath.includes('2026-10-22') && dedupeReport.savedPath.endsWith('jobs.json'));
      const savedData = JSON.parse(fs.readFileSync(dedupeReport.savedPath, 'utf-8'));
      assert('Saved data is JSON array with qualifying jobs', Array.isArray(savedData) && savedData.length === dedupeReport.savedCount);
      assert('Saved jobs retain match scores', savedData[0]?.match?.score > 75);
    }

    // 5. No-Results Behavior (No Empty File or Directory)
    console.log('\n--- 5. No-Results / Zero-Matches Handling ---');
    const emptyTestDir = path.resolve(desktopRoot, 'temp-empty-test-' + Date.now());
    const failingAdapter = createBrowserJobSourceAdapter({
      sourceId: 'mock_empty_source', displayName: 'Mock Empty Source',
      buildUrl: () => 'https://example.com/empty',
      extractRecords: async () => [irrelevantJob],
      normalizeRecord: (r) => ({ success: true, job: r }),
    });

    const emptyReport = await executeFindJobsPipeline({
      customAdapters: [failingAdapter],
      overrideStorageRoot: emptyTestDir,
      mockCurrentDate: now,
    });

    assert('Saved count is 0 when no jobs qualify', emptyReport.savedCount === 0);
    assert('savedPath is null when 0 jobs qualify', emptyReport.savedPath === null);
    const targetDailyDir = path.join(emptyTestDir, 'jobs', '2026-10-22');
    assert('No empty daily directory or file was created', !fs.existsSync(targetDailyDir));

    // 6. Partial Source Failure & Restricted Source Reporting
    console.log('\n--- 6. Source Reporting & Graceful Fault Isolation ---');
    const crashingAdapter = createBrowserJobSourceAdapter({
      sourceId: 'crashing_source', displayName: 'Crashing Adapter',
      buildUrl: () => 'https://example.com/crash',
      extractRecords: async () => { throw new Error('Simulated upstream network breakdown'); },
      normalizeRecord: (r) => ({ success: true, job: r }),
    });

    const faultReport = await executeFindJobsPipeline({
      customAdapters: [crashingAdapter, dedupeAdapter],
      overrideStorageRoot: tempTestDir,
      mockCurrentDate: now,
    });

    assert('Faulty adapter recorded as failed without crashing entire pipeline', faultReport.sources.some((s) => s.sourceId === 'crashing_source' && s.status === 'failed'));
    assert('Healthy adapter executed successfully in same batch', faultReport.sources.some((s) => s.sourceId === 'mock_dedupe_source' && s.status === 'executed'));
    assert('Pipeline continued and saved qualifying jobs from healthy adapter', faultReport.savedCount > 0);

  } finally {
    // Cleanup temporary test directories
    try {
      if (fs.existsSync(tempTestDir)) fs.rmSync(tempTestDir, { recursive: true, force: true });
    } catch {}
  }

  // Summary
  console.log('\n------------------------------------------------------');
  const passed = tests.filter((t) => t.pass).length;
  const failed = tests.filter((t) => !t.pass).length;
  console.log(`FIND-JOBS PIPELINE SUITE: ${passed} passed, ${failed} failed`);
  console.log('------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
