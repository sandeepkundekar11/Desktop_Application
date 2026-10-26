import { importLocal, createTestCollector } from './db-test-helpers.mjs';

const {
  createLeverBrowserAdapter,
  createLeverDrivetrainAdapter,
  extractLeverListingsFromHtml,
  parseLeverLocation,
  mapLeverWorkplaceType,
  mapLeverEmploymentType,
  normalizeLeverListing,
  DRIVETRAIN_BOARD_URL,
} = await importLocal('dist-electron/main/connectors/sources/leverBrowserAdapter.js');

const { isJobSourceAdapter, isAdapterBatchSuccess } = await importLocal('dist-electron/main/connectors/adapterContract.js');
const { validateJob } = await importLocal('dist-electron/main/storage/jobSchema.js');
const { calculateJobMatchScore, MATCH_THRESHOLD } = await importLocal('dist-electron/main/scoring/jobScorer.js');
const { loadProfile } = await importLocal('dist-electron/main/storage/jsonProfileRepository.js');

const { tests, assert } = createTestCollector();

async function runLeverAdapterTestSuite() {
  console.log('\n======================================================');
  console.log('STARTING LEVER ADAPTER TEST SUITE (MOCK + LIVE)');
  console.log('======================================================\n');

  // ==========================================
  // SECTION 1: MOCK TESTS (Unit & Simulation)
  // ==========================================
  console.log('--- 1. MOCK UNIT TESTS ---');

  // 1. Adapter Contract Compliance
  const adapter = createLeverDrivetrainAdapter();
  assert('Adapter complies with JobSourceAdapter contract', isJobSourceAdapter(adapter));
  assert('Adapter has expected sourceId', adapter.sourceId === 'lever_drivetrain');
  assert('Adapter has accessType browser_automation', adapter.accessType === 'browser_automation');
  assert('Adapter fetchBatch is callable function', typeof adapter.fetchBatch === 'function');
  assert('Adapter normalizeRecord is callable function', typeof adapter.normalizeRecord === 'function');
  assert('Adapter isConfigured returns true', adapter.isConfigured({}) === true);

  // 2. Location Parser
  const loc1 = parseLeverLocation('India');
  assert('parseLeverLocation handles country-only', loc1 !== null && loc1.country === 'India' && loc1.city === null);

  const loc2 = parseLeverLocation('Bengaluru, India');
  assert('parseLeverLocation handles city and country', loc2 !== null && loc2.city === 'Bengaluru' && loc2.country === 'India');

  const loc3 = parseLeverLocation('San Francisco, California, United States');
  assert('parseLeverLocation handles city, state, country', loc3 !== null && loc3.city === 'San Francisco' && loc3.state === 'California' && loc3.country === 'United States');

  assert('parseLeverLocation handles empty string', parseLeverLocation('') === null);
  assert('parseLeverLocation handles null', parseLeverLocation(null) === null);

  // 3. Workplace & Employment Type Mapping
  assert('mapLeverWorkplaceType maps remote', mapLeverWorkplaceType('Remote-') === 'remote');
  assert('mapLeverWorkplaceType maps hybrid', mapLeverWorkplaceType('Hybrid - Onsite/Remote') === 'hybrid');
  assert('mapLeverWorkplaceType maps on-site', mapLeverWorkplaceType('On-site') === 'on_site');
  assert('mapLeverWorkplaceType uses fallback', mapLeverWorkplaceType(null, 'remote') === 'remote');

  assert('mapLeverEmploymentType maps full time', mapLeverEmploymentType('Full Time') === 'full_time');
  assert('mapLeverEmploymentType maps part time', mapLeverEmploymentType('Part-Time') === 'part_time');
  assert('mapLeverEmploymentType maps contract', mapLeverEmploymentType('Contract') === 'contract');
  assert('mapLeverEmploymentType maps internship', mapLeverEmploymentType('Internship') === 'internship');
  assert('mapLeverEmploymentType handles null', mapLeverEmploymentType(null) === null);

  // 4. HTML Extraction Mock
  const sampleHtml = `
    <div class="postings-group">
      <div class="posting-category-title">Engineering</div>
      <div class="posting" data-qa-posting-id="mock-101">
        <div class="posting-apply" data-qa="btn-apply">
          <a href="https://jobs.lever.co/drivetrain/mock-101/apply" class="posting-btn-submit template-btn-submit hex-color">Apply</a>
        </div>
        <a class="posting-title" href="https://jobs.lever.co/drivetrain/mock-101">
          <h5 data-qa="posting-name">Senior Frontend Engineer</h5>
          <div class="posting-categories">
            <span class="display-inline-block small-category-label workplaceTypes">Remote-</span>
            <span class="sort-by-commitment posting-category small-category-label commitment">Full Time</span>
            <span class="sort-by-location posting-category small-category-label location">Bengaluru, India</span>
          </div>
        </a>
      </div>
    </div>
  `;

  const extracted = extractLeverListingsFromHtml(sampleHtml, 'Drivetrain');
  assert('extractLeverListingsFromHtml extracts 1 posting', extracted.length === 1);
  if (extracted.length === 1) {
    const item = extracted[0];
    assert('Extracted item has valid ID', item.id === 'mock-101');
    assert('Extracted item has valid title', item.title === 'Senior Frontend Engineer');
    assert('Extracted item has valid jobUrl', item.jobUrl === 'https://jobs.lever.co/drivetrain/mock-101');
    assert('Extracted item has valid applyUrl', item.applyUrl === 'https://jobs.lever.co/drivetrain/mock-101/apply');
    assert('Extracted item has cleaned workplaceType', item.workplaceType === 'Remote');
    assert('Extracted item has commitment', item.commitment === 'Full Time');
    assert('Extracted item has location', item.location === 'Bengaluru, India');
  }

  // 5. Normalization & Schema Validation Mock
  const rawMock = {
    id: 'mock-102',
    title: 'Frontend Engineer',
    company: 'Drivetrain',
    jobUrl: 'https://jobs.lever.co/drivetrain/mock-102',
    applyUrl: 'https://jobs.lever.co/drivetrain/mock-102/apply',
    workplaceType: 'Remote-',
    commitment: 'Full Time',
    location: 'India',
    department: 'Engineering',
    postedAt: '2026-10-21T10:00:00.000Z',
  };

  const norm = normalizeLeverListing(rawMock, {
    collectionTimestamp: new Date('2026-10-22T10:00:00.000Z'),
    sourceId: 'lever_drivetrain',
    defaultWorkplaceType: 'remote',
  });

  assert('normalizeLeverListing succeeds on valid raw record', norm.success === true);
  if (norm.success) {
    const val = validateJob(norm.job);
    assert('Normalized Job passes full schema validation', val.valid === true, val.errors.join('; '));
    assert('Normalized Job ID has source prefix', norm.job.id === 'lever_drivetrain_mock-102');
    assert('Normalized Job workplaceType is remote', norm.job.workplaceType === 'remote');
    assert('Normalized Job employmentType is full_time', norm.job.employmentType === 'full_time');
    assert('Normalized Job location country is India', norm.job.location?.country === 'India');
  }

  // 6. Match Scoring Simulation Mock
  const profile = loadProfile();
  const mockFreshJob = {
    id: 'lever_drivetrain_test-fe',
    source: 'lever_drivetrain',
    sourceJobId: 'test-fe',
    title: 'Frontend Engineer',
    company: 'Drivetrain',
    jobUrl: 'https://jobs.lever.co/drivetrain/test-fe',
    applyUrl: null,
    description: 'We are seeking a Frontend Engineer with React, TypeScript, Next.js, and Redux experience.',
    employmentType: 'full_time',
    location: { city: 'Bengaluru', state: 'Karnataka', country: 'India', rawLocation: 'Bengaluru, India' },
    workplaceType: 'remote',
    relocation: null,
    postedAt: '2026-10-20T10:00:00.000Z', // Fresh: 2 days old (well within 6 days)
    collectedAt: '2026-10-22T10:00:00.000Z',
    collectionDate: '2026-10-22',
    qualifications: { required: [], preferred: [] },
    experience: null,
    salary: null,
    sourceMetadata: {},
  };

  const scoreResult = calculateJobMatchScore(mockFreshJob, profile);
  assert(
    `Relevant fresh mock job qualifies (> ${MATCH_THRESHOLD}%, score=${scoreResult.score}%)`,
    scoreResult.score >= MATCH_THRESHOLD
  );

  // ==========================================
  // SECTION 2: LIVE PUBLIC BOARD TEST
  // ==========================================
  console.log('\n--- 2. LIVE PUBLIC BOARD EXTRACTION (PLAYWRIGHT) ---');
  console.log(`Connecting to public board: ${DRIVETRAIN_BOARD_URL}`);

  const liveAdapter = createLeverDrivetrainAdapter();
  const startTime = Date.now();
  const liveBatch = await liveAdapter.fetchBatch({
    keywords: ['Frontend Developer', 'React.js Developer'],
    locationPreference: 'India',
    timeoutMs: 45000,
  });
  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`Live browser extraction completed in ${elapsedSec}s`);
  assert('Live batch extraction succeeded without error', isAdapterBatchSuccess(liveBatch));

  if (isAdapterBatchSuccess(liveBatch)) {
    console.log(`Live listings discovered: ${liveBatch.rawCount}`);
    console.log(`Live listings normalized & schema-valid: ${liveBatch.validCount}`);

    assert('Live listings discovered > 0', liveBatch.rawCount > 0);
    assert('All discovered live listings successfully normalized', liveBatch.rawCount === liveBatch.validCount);

    // Identify target roles
    const frontendRoles = liveBatch.jobs.filter((j) =>
      j.title.toLowerCase().includes('frontend') ||
      j.title.toLowerCase().includes('react')
    );

    console.log(`\nIdentified Frontend/React roles (${frontendRoles.length}):`);
    for (const job of frontendRoles) {
      console.log(`  - Title: ${job.title}`);
      console.log(`    Location: ${job.location?.rawLocation || 'Remote'}`);
      console.log(`    Workplace: ${job.workplaceType}`);
      console.log(`    Posted At: ${job.postedAt || 'Not specified'}`);
      console.log(`    URL: ${job.jobUrl}`);
    }

    const indiaRemoteRole = frontendRoles.find((j) =>
      j.location?.rawLocation?.toLowerCase().includes('india') ||
      j.workplaceType === 'remote'
    );
    assert('Live board contains relevant Frontend role', indiaRemoteRole !== undefined);

    if (indiaRemoteRole) {
      const liveScore = calculateJobMatchScore(indiaRemoteRole, profile);
      console.log(`\nLive match score against candidate profile: ${liveScore.score}% (Qualified: ${liveScore.isQualified})`);
      console.log(`  Matched Skills: ${liveScore.explanation.matchedSkills.join(', ') || 'None'}`);
      console.log(`  Title Details: ${liveScore.explanation.titleMatchDetails}`);
      console.log(`  Location Details: ${liveScore.explanation.locationDetails}`);
      assert('Live target role scores above threshold (>75%)', liveScore.score >= MATCH_THRESHOLD);
    }
  }

  // ==========================================
  // FINAL REPORT & SUMMARY
  // ==========================================
  console.log('\n------------------------------------------------------');
  const passed = tests.filter((t) => t.pass).length;
  const failed = tests.filter((t) => !t.pass).length;
  console.log(`LEVER ADAPTER TEST SUITE: ${passed} passed, ${failed} failed`);
  console.log('------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runLeverAdapterTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
