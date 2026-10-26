import { importLocal, createTestCollector, desktopRoot } from './db-test-helpers.mjs';

const {
  validateJob,
  isJob,
  isValidUrl,
  isValidIsoDate,
  isValidDatePartition,
  createDefaultQualifications,
} = await importLocal('dist-electron/main/storage/jobSchema.js');

const { tests, assert } = createTestCollector();

async function runTests() {
  console.log('\n======================================================');
  console.log('       APPLYPILOT SHARED JOB SCHEMA TESTS');
  console.log('======================================================\n');

  // 1. Valid Job with Complete Information (Diverse Industry: Healthcare)
  console.log('--- 1. Valid Job with Complete Information (Healthcare Industry) ---');
  const completeJob = {
    id: 'hiringcafe_hc-98214',
    source: 'hiringcafe',
    sourceJobId: 'hc-98214',
    title: 'Senior Clinical Research Associate',
    company: 'Apex BioTherapeutics',
    jobUrl: 'https://careers.apexbio.example/jobs/98214',
    applyUrl: 'https://careers.apexbio.example/apply/98214',
    description: 'Lead multi-site Phase II/III clinical trials for oncology therapeutics across participating hospitals.',
    employmentType: 'full_time',
    location: {
      city: 'Boston',
      state: 'MA',
      country: 'United States',
      rawLocation: 'Boston, MA, USA',
    },
    workplaceType: 'hybrid',
    relocation: {
      offered: true,
      details: 'Relocation package provided for qualified candidates.',
    },
    postedAt: '2026-10-18T14:30:00.000Z',
    collectedAt: '2026-10-22T08:00:00.000Z',
    collectionDate: '2026-10-22',
    qualifications: {
      requiredSkills: ['ICH-GCP', 'Protocol Monitoring', 'Regulatory Compliance', 'Trial Master File (TMF)'],
      preferredSkills: ['EDC Systems', 'Medidata Rave', 'Veeva Vault'],
      requiredQualifications: ['Bachelor of Science in Life Sciences or related field', '4+ years of monitoring experience'],
      preferredQualifications: ['CCRA certification through ACRP or SoCRA'],
      sourceEvidence: ['Must possess minimum 4 years on-site monitoring experience in oncology.'],
    },
    experience: {
      minYears: 4,
      maxYears: 8,
      rawText: '4 to 8 years clinical trial monitoring',
    },
    salary: {
      min: 110000,
      max: 145000,
      currency: 'USD',
      period: 'yearly',
      isEstimated: false,
    },
    match: {
      score: 88,
      breakdown: {
        skillScore: 90,
        experienceScore: 85,
      },
      evaluatedAt: '2026-10-22T08:05:00.000Z',
    },
    sourceMetadata: {
      category: 'Clinical Operations',
      feedTag: 'healthcare-biopharma',
    },
  };

  const completeResult = validateJob(completeJob);
  assert('Complete healthcare job passes validateJob', completeResult.valid, completeResult.errors.join('; '));
  assert('Complete healthcare job satisfies isJob type guard', isJob(completeJob));

  // 2. Valid Job with Optional Fields Missing (Civil / Structural Engineering)
  console.log('\n--- 2. Valid Job with Optional Fields Missing (Engineering Industry) ---');
  const minimalJob = {
    id: 'naukri_nk-5501',
    source: 'naukri',
    sourceJobId: null,
    title: 'Bridge Structural Design Engineer',
    company: 'Larsen & Infra Structures Ltd',
    jobUrl: 'https://www.naukri.example/job-listings/bridge-design-5501',
    applyUrl: null,
    description: null,
    employmentType: null,
    location: null,
    workplaceType: null,
    relocation: null,
    postedAt: null,
    collectedAt: '2026-10-22T10:15:30.000Z',
    collectionDate: '2026-10-22',
    qualifications: createDefaultQualifications(),
    experience: null,
    salary: null,
  };

  const minimalResult = validateJob(minimalJob);
  assert('Minimal job with optional fields missing passes validateJob', minimalResult.valid, minimalResult.errors.join('; '));
  assert('Minimal job satisfies isJob type guard', isJob(minimalJob));

  // 3. Invalid Title or Company Validation
  console.log('\n--- 3. Invalid Title and Company Rejection ---');
  const emptyTitleJob = {
    ...minimalJob,
    title: '   ',
  };
  const emptyTitleResult = validateJob(emptyTitleJob);
  assert('Whitespace-only title is rejected', !emptyTitleResult.valid);
  assert('Rejection reason mentions title', emptyTitleResult.errors.some((e) => e.includes('title')));

  const missingCompanyJob = {
    ...minimalJob,
    company: '',
  };
  const missingCompanyResult = validateJob(missingCompanyJob);
  assert('Empty company is rejected', !missingCompanyResult.valid);
  assert('Rejection reason mentions company', missingCompanyResult.errors.some((e) => e.includes('company')));

  // 4. Invalid URL or Date Format
  console.log('\n--- 4. Invalid URL and Date Rejection ---');
  const invalidUrlJob = {
    ...minimalJob,
    jobUrl: 'not_a_valid_url',
  };
  const invalidUrlResult = validateJob(invalidUrlJob);
  assert('Invalid jobUrl is rejected', !invalidUrlResult.valid);
  assert('Rejection reason mentions jobUrl', invalidUrlResult.errors.some((e) => e.includes('jobUrl')));

  const invalidApplyUrlJob = {
    ...minimalJob,
    applyUrl: 'ftp://ftp.example.com/apply',
  };
  const invalidApplyUrlResult = validateJob(invalidApplyUrlJob);
  assert('FTP protocol applyUrl is rejected (must be http/https)', !invalidApplyUrlResult.valid);

  const invalidDateJob = {
    ...minimalJob,
    postedAt: 'invalid-date-string-2026',
  };
  const invalidDateResult = validateJob(invalidDateJob);
  assert('Malformed postedAt timestamp is rejected', !invalidDateResult.valid);
  assert('Rejection reason mentions postedAt', invalidDateResult.errors.some((e) => e.includes('postedAt')));

  const invalidPartitionJob = {
    ...minimalJob,
    collectionDate: '22-10-2026', // wrong format, should be YYYY-MM-DD
  };
  const invalidPartitionResult = validateJob(invalidPartitionJob);
  assert('Non-YYYY-MM-DD collectionDate partition is rejected', !invalidPartitionResult.valid);

  // 5. Invalid Salary and Experience Ranges
  console.log('\n--- 5. Invalid Numeric Ranges (Salary & Experience) ---');
  const invertedSalaryJob = {
    ...minimalJob,
    salary: {
      min: 150000,
      max: 100000, // min > max
      currency: 'USD',
      period: 'yearly',
    },
  };
  const invertedSalaryResult = validateJob(invertedSalaryJob);
  assert('Salary with min > max is rejected', !invertedSalaryResult.valid);
  assert('Error explains salary.min cannot exceed salary.max', invertedSalaryResult.errors.some((e) => e.includes('salary.min')));

  const negativeSalaryJob = {
    ...minimalJob,
    salary: {
      min: -500,
      max: 10000,
      currency: 'USD',
      period: 'monthly',
    },
  };
  const negativeSalaryResult = validateJob(negativeSalaryJob);
  assert('Negative salary amount is rejected', !negativeSalaryResult.valid);

  const invertedExperienceJob = {
    ...minimalJob,
    experience: {
      minYears: 10,
      maxYears: 5, // min > max
    },
  };
  const invertedExperienceResult = validateJob(invertedExperienceJob);
  assert('Experience with minYears > maxYears is rejected', !invertedExperienceResult.valid);

  const negativeExperienceJob = {
    ...minimalJob,
    experience: {
      minYears: -2,
      maxYears: 4,
    },
  };
  const negativeExpResult = validateJob(negativeExperienceJob);
  assert('Negative minYears is rejected', !negativeExpResult.valid);

  const outOfRangeScoreJob = {
    ...minimalJob,
    match: {
      score: 115, // must be 0 - 100
    },
  };
  const outOfRangeScoreResult = validateJob(outOfRangeScoreJob);
  assert('Score > 100 is rejected', !outOfRangeScoreResult.valid);

  // 6. Security: Disallowed Sensitive Keys in Source Metadata
  console.log('\n--- 6. Security: Disallowed Sensitive Keys in Metadata ---');
  const sensitiveMetaJob = {
    ...minimalJob,
    sourceMetadata: {
      externalToken: 'secret_bearer_token_123',
    },
  };
  const sensitiveMetaResult = validateJob(sensitiveMetaJob);
  assert('Disallowed sensitive keys in sourceMetadata are rejected', !sensitiveMetaResult.valid);
  assert('Error mentions sensitive keys', sensitiveMetaResult.errors.some((e) => e.includes('sensitive keys')));

  // 7. Multi-Source & Cross-Industry Extensibility Verification
  console.log('\n--- 7. Cross-Industry and Multi-Source Extensibility ---');
  const diverseSourceJobs = [
    {
      id: 'indeed_ind-8812',
      source: 'indeed',
      sourceJobId: 'ind-8812',
      title: 'Commercial Litigation Associate',
      company: 'Kirkland & Hastings LLP',
      jobUrl: 'https://indeed.example/viewjob?jk=ind-8812',
      applyUrl: null,
      description: 'Defend corporate clients in complex commercial antitrust proceedings.',
      employmentType: 'full_time',
      location: { city: 'Chicago', state: 'IL', country: 'USA', rawLocation: 'Chicago, IL' },
      workplaceType: 'on_site',
      relocation: null,
      postedAt: '2026-10-15T09:00:00.000Z',
      collectedAt: '2026-10-22T08:00:00.000Z',
      collectionDate: '2026-10-22',
      qualifications: {
        requiredSkills: ['Civil Litigation', 'Deposition Defense', 'Antitrust Law'],
        preferredSkills: ['Federal Court Practice'],
        requiredQualifications: ['Juris Doctor (J.D.)', 'Admitted to Illinois State Bar'],
        preferredQualifications: [],
        sourceEvidence: ['Must be in good standing with the Illinois Bar.'],
      },
      experience: { minYears: 3, maxYears: 6, rawText: '3-6 years litigation experience' },
      salary: { min: 215000, max: 260000, currency: 'USD', period: 'yearly' },
    },
    {
      id: 'instahyre_inst-4421',
      source: 'instahyre',
      sourceJobId: 'inst-4421',
      title: 'Head of Supply Chain & Logistics Operations',
      company: 'Zenith Retail Warehousing',
      jobUrl: 'https://instahyre.example/job/4421',
      applyUrl: null,
      description: 'Oversee regional distribution centers and cold storage logistics.',
      employmentType: 'full_time',
      location: { city: 'Bengaluru', state: 'Karnataka', country: 'India', rawLocation: 'Bengaluru, India' },
      workplaceType: 'on_site',
      relocation: null,
      postedAt: '2026-10-20T11:00:00.000Z',
      collectedAt: '2026-10-22T08:00:00.000Z',
      collectionDate: '2026-10-22',
      qualifications: {
        requiredSkills: ['Fleet Management', 'WMS', 'Vendor Negotiation', 'Six Sigma'],
        preferredSkills: ['SAP S/4HANA Logistics'],
        requiredQualifications: ['B.Tech / MBA in Operations'],
        preferredQualifications: [],
        sourceEvidence: ['Minimum 8 years in fulfillment and supply chain.'],
      },
      experience: { minYears: 8, maxYears: 14, rawText: '8-14 years' },
      salary: { min: 3500000, max: 5000000, currency: 'INR', period: 'yearly' },
    },
    {
      id: 'wellfound_wf-309',
      source: 'wellfound',
      sourceJobId: 'wf-309',
      title: 'Lead Industrial Robotics Firmware Engineer',
      company: 'Veloce Robotics',
      jobUrl: 'https://wellfound.example/jobs/309',
      applyUrl: null,
      description: 'Develop low-latency motor control firmware for automated warehouse rovers.',
      employmentType: 'full_time',
      location: { city: 'Munich', state: 'Bavaria', country: 'Germany', rawLocation: 'Munich, Germany' },
      workplaceType: 'hybrid',
      relocation: null,
      postedAt: '2026-10-21T16:00:00.000Z',
      collectedAt: '2026-10-22T08:00:00.000Z',
      collectionDate: '2026-10-22',
      qualifications: {
        requiredSkills: ['Embedded C', 'FreeRTOS', 'CANopen', 'BLDC Motor Control'],
        preferredSkills: ['ROS 2', 'EtherCAT'],
        requiredQualifications: ['M.Sc. in Robotics, Electrical Engineering, or Mechatronics'],
        preferredQualifications: [],
        sourceEvidence: ['Proven experience with deterministic real-time motor control loops.'],
      },
      experience: { minYears: 5, maxYears: null, rawText: '5+ years' },
      salary: { min: 85000, max: 110000, currency: 'EUR', period: 'yearly' },
    },
    {
      id: 'hirist_hr-771',
      source: 'hirist',
      sourceJobId: 'hr-771',
      title: 'Principal Cloud Database Architect',
      company: 'Fintech Core Networks',
      jobUrl: 'https://hirist.example/job/771',
      applyUrl: null,
      description: 'Design distributed transaction topologies and multi-region disaster recovery.',
      employmentType: 'full_time',
      location: { city: 'Hyderabad', state: 'Telangana', country: 'India', rawLocation: 'Hyderabad, India' },
      workplaceType: 'remote',
      relocation: null,
      postedAt: '2026-10-22T07:00:00.000Z',
      collectedAt: '2026-10-22T08:00:00.000Z',
      collectionDate: '2026-10-22',
      qualifications: {
        requiredSkills: ['Distributed Systems', 'PostgreSQL Internals', 'Consensus Algorithms'],
        preferredSkills: ['Spanner', 'CockroachDB'],
        requiredQualifications: ['10+ years backend infrastructure engineering'],
        preferredQualifications: [],
        sourceEvidence: ['10+ years experience building highly concurrent distributed systems.'],
      },
      experience: { minYears: 10, maxYears: 18, rawText: '10-18 years' },
      salary: { min: 6000000, max: 9000000, currency: 'INR', period: 'yearly' },
    },
  ];

  for (const job of diverseSourceJobs) {
    const res = validateJob(job);
    assert(`Job from ${job.source} ("${job.title}") validates cleanly`, res.valid, res.errors.join('; '));
  }

  // 8. Source File Size Audit (< 300 Lines)
  const pathMod = await import('node:path');
  const targetFile = pathMod.resolve(desktopRoot, 'src/main/storage/jobSchema.ts');
  const fsTarget = (await import('node:fs')).readFileSync(targetFile, 'utf8').split('\n').length;
  assert(`jobSchema.ts has ${fsTarget} lines (< 300 lines limit)`, fsTarget < 300);

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
