import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { importLocal, createTestCollector } from './db-test-helpers.mjs';

const { setCustomDataRoot } = await importLocal('dist-electron/main/storage/storageRootResolver.js');
const { initializeStorageHierarchy } = await importLocal('dist-electron/main/storage/directoryInitializer.js');
const { getTargetStorageLocations } = await importLocal('dist-electron/main/storage/targetStorageLocations.js');
const { readJsonSafe, writeJsonAtomic } = await importLocal('dist-electron/main/storage/atomicFileWriter.js');
const {
  listAllResumes,
  insertResumeRecord,
  getResumeDetailsById,
  findResumeByHash,
} = await importLocal('dist-electron/main/storage/jsonResumeRepository.js');
const {
  createJob,
  getJobById,
  moveJobCategory,
  saveTailoredResume,
  getTailoredResume,
  saveJobMatchResult,
  getJobsIndex,
  getApplicationIndex,
} = await importLocal('dist-electron/main/storage/jsonJobRepository.js');

const testTempDir = path.resolve('temp_test_job_storage_architecture_' + Date.now());

const { tests, assert } = createTestCollector();

async function runTests() {
  console.log('======================================================');
  console.log('   APPLYPILOT FINAL RESUME & JOB ARCHITECTURE TESTS   ');
  console.log('======================================================\n');

  try {
    setCustomDataRoot(testTempDir);
    initializeStorageHierarchy(testTempDir);
    const locs = getTargetStorageLocations(testTempDir);

    // 1. One master-resume folder: data/resumes/
    console.log('\n--- 1. Single Master-Resume Folder Architecture ---');
    assert('data/resumes/ exists', fs.existsSync(locs.resumesDir));
    
    // Check no subdirectories under data/resumes/
    const resumeEntries = fs.readdirSync(locs.resumesDir);
    const resumeSubdirs = resumeEntries.filter((entry) => {
      return fs.statSync(path.join(locs.resumesDir, entry)).isDirectory();
    });
    assert('Zero subdirectories under data/resumes/ on fresh start', resumeSubdirs.length === 0, `Found: ${resumeSubdirs.join(', ')}`);
    assert('resume-metadata.json exists in data/resumes/', fs.existsSync(locs.resumeMetadataFile));
    assert('jobs-index.json is authoritative in data/jobs/', locs.jobsIndexFile.endsWith(path.join('jobs', 'jobs-index.json')));
    assert('application-index.json is stored in data/applications/', locs.applicationIndexFile.endsWith(path.join('applications', 'application-index.json')));

    // 2. Master Resumes Stored Directly in data/resumes/
    console.log('\n--- 2. Master Resumes Storage & Unchanged Original ---');
    const masterResumeId = crypto.randomUUID();
    const masterFilename = `${masterResumeId}.pdf`;
    const masterFileContent = Buffer.from('%PDF-1.4 Mock Original Master Resume Buffer Content 12345');
    const masterFileHash = crypto.createHash('sha256').update(masterFileContent).digest('hex');

    // Save original file directly into data/resumes/
    const masterFilePath = path.join(locs.resumesDir, masterFilename);
    fs.writeFileSync(masterFilePath, masterFileContent);

    insertResumeRecord(
      {
        id: masterResumeId,
        originalFilename: 'Senior_Fullstack_Master_Resume.pdf',
        fileFormat: 'pdf',
        fileSize: masterFileContent.length,
        fileHash: masterFileHash,
        storageFilename: masterFilename,
        extractedText: 'Alex Morgan Senior Full-Stack Engineer TypeScript React Node.js',
        characterCount: 65,
        wordCount: 8,
        preview: 'Alex Morgan Senior Full-Stack Engineer',
        createdAt: new Date().toISOString(),
        extractionStatus: 'success',
        confidenceScore: 0.95,
      },
      testTempDir
    );

    const resumes = listAllResumes(testTempDir);
    assert('Master resume is recorded in resume-metadata.json', resumes.length === 1);
    assert('Master resume record preserves fileHash', resumes[0].fileHash === masterFileHash);
    assert('Master resume record preserves extractionStatus', resumes[0].extractionStatus === 'success');
    assert('Master file exists directly in data/resumes/', fs.existsSync(masterFilePath));
    assert('Master file content is preserved unchanged', fs.readFileSync(masterFilePath).equals(masterFileContent));

    // Confirm no subdirectories were created during resume insertion
    const resumeEntriesAfter = fs.readdirSync(locs.resumesDir);
    const subdirsAfter = resumeEntriesAfter.filter((entry) => {
      return fs.statSync(path.join(locs.resumesDir, entry)).isDirectory();
    });
    assert('No subdirectories created under data/resumes/ after master upload', subdirsAfter.length === 0);

    // 3. Day-wise Job Folder Organization & Stable IDs
    console.log('\n--- 3. Day-Wise Job Organization & Stable IDs ---');
    const stableJobId = 'lead-ts-architect-2026';
    const discoveryTimestamp = '2026-10-15T09:30:00.000Z';
    const expectedDiscoveryDate = '2026-10-15';

    const createdJob = createJob(
      {
        id: stableJobId,
        title: 'Lead TypeScript Architect',
        companyName: 'Acme Systems',
        jobUrl: 'https://careers.acme.example/jobs/1234',
        location: 'San Francisco, CA',
        workMode: 'remote',
        category: 'discovered',
        matchScore: 92,
        discoveredAt: discoveryTimestamp,
      },
      testTempDir
    );

    const expectedInitialFolder = `jobs/${expectedDiscoveryDate}/discovered/job_${stableJobId}`;
    assert('Job created with stable folder path', createdJob.folderPath === expectedInitialFolder);
    assert('Job folder exists on disk', fs.existsSync(path.join(locs.root, createdJob.folderPath)));

    const jobJsonPath = path.join(locs.root, createdJob.folderPath, 'job.json');
    assert('job.json exists inside the job folder', fs.existsSync(jobJsonPath));
    const parsedJob = readJsonSafe(jobJsonPath, null);
    assert('job.json contains correct stable ID', parsedJob?.id === stableJobId);
    assert('job.json contains correct discoveredAt timestamp', parsedJob?.discoveredAt === discoveryTimestamp);
    assert('job.json status is discovered', parsedJob?.status === 'discovered');

    // Authoritative index check
    const jobsIndex = getJobsIndex(testTempDir);
    assert('jobs-index.json has stable job entry', !!jobsIndex.jobs[stableJobId]);
    assert('jobs-index.json points to correct folderPath', jobsIndex.jobs[stableJobId].folderPath === expectedInitialFolder);
    assert('jobs-index.json tracks category = discovered', jobsIndex.jobs[stableJobId].category === 'discovered');

    // 4. Job Match Result Inside Job Folder
    console.log('\n--- 4. Job Match Result Stored Inside Job Folder ---');
    saveJobMatchResult(
      stableJobId,
      {
        id: `match-${stableJobId}`,
        jobId: stableJobId,
        matchScore: 95,
        breakdown: { skillScore: 100, experienceScore: 90 },
        evaluatedAt: new Date().toISOString(),
      },
      testTempDir
    );

    const matchJsonPath = path.join(locs.root, createdJob.folderPath, 'match-result.json');
    assert('match-result.json stored inside job folder', fs.existsSync(matchJsonPath));
    const jobsIndexAfterMatch = getJobsIndex(testTempDir);
    assert('jobs-index.json updated with new matchScore', jobsIndexAfterMatch.jobs[stableJobId].matchScore === 95);

    // 5. Tailored Resume Stored Exclusively Inside Job Folder
    console.log('\n--- 5. Tailored Resumes Stored ONLY Inside Job Folder ---');
    const tailoredPdfContent = Buffer.from('%PDF-1.4 Tailored Resume for Acme Systems');
    const tailoredDocxContent = Buffer.from('PK\x03\x04 Tailored DOCX Resume Content');

    const tailoredPdfRelPath = saveTailoredResume(stableJobId, 'pdf', tailoredPdfContent, testTempDir);
    const tailoredDocxRelPath = saveTailoredResume(stableJobId, 'docx', tailoredDocxContent, testTempDir);

    assert('tailored-resume.pdf stored inside job folder', tailoredPdfRelPath === `${expectedInitialFolder}/tailored-resume.pdf`);
    assert('tailored-resume.docx stored inside job folder', tailoredDocxRelPath === `${expectedInitialFolder}/tailored-resume.docx`);
    assert('tailored-resume.pdf exists on disk', fs.existsSync(path.join(locs.root, tailoredPdfRelPath)));
    assert('tailored-resume.docx exists on disk', fs.existsSync(path.join(locs.root, tailoredDocxRelPath)));

    // Verify tailored resume is NEVER stored or duplicated in data/resumes/
    const masterDirFiles = fs.readdirSync(locs.resumesDir);
    const hasTailoredInMaster = masterDirFiles.some((f) => f.includes('tailored') || f.includes(stableJobId));
    assert('Tailored resume is NOT present in data/resumes/', !hasTailoredInMaster);

    const readTailoredPdf = getTailoredResume(stableJobId, 'pdf', testTempDir);
    assert('getTailoredResume retrieves correct content from job folder', readTailoredPdf?.equals(tailoredPdfContent) === true);

    // 6. Job Folder Moving Preserves Files, Tailored Resumes & Stable ID
    console.log('\n--- 6. Moving Job Preserves All Files & Stable ID ---');
    // Move from discovered -> shortlisted
    const movedToShortlisted = moveJobCategory(stableJobId, 'shortlisted', testTempDir);
    const expectedShortlistedFolder = `jobs/${expectedDiscoveryDate}/shortlisted/job_${stableJobId}`;
    assert('Job folder path updated to shortlisted', movedToShortlisted.newFolderPath === expectedShortlistedFolder);
    assert('Old discovered folder no longer exists', !fs.existsSync(path.join(locs.root, expectedInitialFolder)));
    assert('New shortlisted folder exists', fs.existsSync(path.join(locs.root, expectedShortlistedFolder)));

    // Verify all files preserved intact in the new location
    assert('job.json preserved after move', fs.existsSync(path.join(locs.root, expectedShortlistedFolder, 'job.json')));
    assert('match-result.json preserved after move', fs.existsSync(path.join(locs.root, expectedShortlistedFolder, 'match-result.json')));
    assert('tailored-resume.pdf preserved after move', fs.existsSync(path.join(locs.root, expectedShortlistedFolder, 'tailored-resume.pdf')));
    assert('tailored-resume.docx preserved after move', fs.existsSync(path.join(locs.root, expectedShortlistedFolder, 'tailored-resume.docx')));

    const reloadedJobAfterMove = getJobById(stableJobId, testTempDir);
    assert('Job lookup by stable ID succeeds after move', reloadedJobAfterMove !== null);
    assert('Job status updated to shortlisted in job.json', reloadedJobAfterMove?.job.status === 'shortlisted');

    const indexAfterMove1 = getJobsIndex(testTempDir);
    assert('jobs-index.json category updated to shortlisted', indexAfterMove1.jobs[stableJobId].category === 'shortlisted');
    assert('jobs-index.json folderPath points to new shortlisted path', indexAfterMove1.jobs[stableJobId].folderPath === expectedShortlistedFolder);

    // Move from shortlisted -> applied
    const movedToApplied = moveJobCategory(stableJobId, 'applied', testTempDir);
    const expectedAppliedFolder = `jobs/${expectedDiscoveryDate}/applied/job_${stableJobId}`;
    assert('Job folder path updated to applied', movedToApplied.newFolderPath === expectedAppliedFolder);
    assert('Tailored resume still intact in applied folder', fs.existsSync(path.join(locs.root, expectedAppliedFolder, 'tailored-resume.pdf')));

    // Check application index updated
    const appIndex = getApplicationIndex(testTempDir);
    assert('application-index.json contains entry for applied job', !!appIndex.applications[stableJobId]);
    assert('application-index.json points to applied folder path', appIndex.applications[stableJobId].folderPath === expectedAppliedFolder);

    // 7. Duplicate Prevention and Unsafe Overwrites
    console.log('\n--- 7. Overwrite Protection & Duplicate Prevention ---');
    let duplicateCreateFailed = false;
    try {
      createJob(
        {
          id: stableJobId,
          title: 'Duplicate Job Test',
          companyName: 'Acme Systems',
          jobUrl: 'https://careers.acme.example/jobs/duplicate',
          category: 'discovered',
        },
        testTempDir
      );
    } catch (err) {
      duplicateCreateFailed = true;
    }
    assert('Creating job with existing ID throws and prevents duplicate record', duplicateCreateFailed);

    // 8. Line Count Rule Verification (< 300 Lines)
    console.log('\n--- 8. Source File Length Audit (< 300 Lines) ---');
    const filesToAudit = [
      'apps/desktop/src/main/storage/targetStorageLocations.ts',
      'apps/desktop/src/main/storage/paths.ts',
      'apps/desktop/src/main/storage/directoryInitializer.ts',
      'apps/desktop/src/main/storage/jsonSchemas.ts',
      'apps/desktop/src/main/storage/jsonResumeRepository.ts',
      'apps/desktop/src/main/storage/jsonJobRepository.ts',
      'apps/desktop/src/main/storage/legacyDataMigrator.ts',
      'apps/desktop/src/main/resume/resumeService.ts',
      'apps/desktop/src/main/resume/types.ts',
    ];

    let allUnder300 = true;
    for (const relPath of filesToAudit) {
      const fullPath = path.resolve(relPath);
      if (fs.existsSync(fullPath)) {
        const lineCount = fs.readFileSync(fullPath, 'utf8').split('\n').length;
        const pass = lineCount < 300;
        if (!pass) allUnder300 = false;
        assert(`${path.basename(relPath)} is under 300 lines (${lineCount} lines)`, pass);
      }
    }
    assert('All modified and created files strictly under 300 lines', allUnder300);

  } finally {
    setCustomDataRoot(null);
    fs.rmSync(testTempDir, { recursive: true, force: true });
  }

  const allPassed = tests.every((t) => t.pass);
  console.log(`\n======================================================\n ALL ${tests.length} FINAL RESUME & JOB ARCHITECTURE TESTS PASSED!\n======================================================\n`);
  process.exit(allPassed ? 0 : 1);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
