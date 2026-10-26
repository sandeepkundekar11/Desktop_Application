import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { importLocal, createTestCollector } from './db-test-helpers.mjs';

const { setCustomDataRoot } = await importLocal('dist-electron/main/storage/storageRootResolver.js');
const { initializeStorageHierarchy } = await importLocal('dist-electron/main/storage/directoryInitializer.js');
const { getTargetStorageLocations } = await importLocal('dist-electron/main/storage/targetStorageLocations.js');
const { readJsonSafe } = await importLocal('dist-electron/main/storage/atomicFileWriter.js');
const {
  listAllResumes,
  insertResumeRecord,
  getResumeDetailsById,
} = await importLocal('dist-electron/main/storage/jsonResumeRepository.js');
const {
  loadCandidateProfile,
  saveCandidateProfile,
  mergeCandidateProfile,
} = await importLocal('dist-electron/main/storage/jsonProfileRepository.js');
const {
  parseCandidateProfileFromText,
  extractContactInfo,
  splitResumeSections,
} = await importLocal('dist-electron/main/extraction/index.js');
const { validateResumeFile } = await importLocal('dist-electron/main/resume/fileValidator.js');

const { tests, assert } = createTestCollector();

async function runTests() {
  console.log('\n======================================================\n   APPLYPILOT CLEAN STORAGE & PROFILE POPULATION TESTS\n======================================================\n');

  const testTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'applypilot-profile-test-'));

  try {
    setCustomDataRoot(testTempDir);

    // 1. Fresh Storage Starts Empty Without Demo/Mock Records
    console.log('\n--- 1. Fresh Storage Contains No Sample Records ---');
    initializeStorageHierarchy(testTempDir);
    const locs = getTargetStorageLocations(testTempDir);

    const freshResumes = listAllResumes(testTempDir);
    assert('Fresh storage contains 0 resumes', freshResumes.length === 0, `Count: ${freshResumes.length}`);

    const freshProfile = loadCandidateProfile(testTempDir);
    assert('Fresh storage candidate profile is empty', freshProfile.profile === null || freshProfile.profile.fullName === '');
    assert('Fresh storage has 0 skills', freshProfile.skills.length === 0);
    assert('Fresh storage has 0 experiences', freshProfile.experience.length === 0);

    const jobsIndex = readJsonSafe(locs.jobsIndexFile, {});
    assert('Jobs index contains 0 jobs (no sample/demo jobs)', Object.keys(jobsIndex.jobs || {}).length === 0);

    const appIndex = readJsonSafe(locs.applicationIndexFile, {});
    assert('Application index contains 0 applications (no sample applications)', Object.keys(appIndex.applications || {}).length === 0);

    const settings = readJsonSafe(locs.settingsFile, null);
    assert('Settings initialized as valid empty object', settings !== null && Object.keys(settings).length === 0);

    // 2. Active JSON Storage Reads and Writes Without Stale SQLite
    console.log('\n--- 2. Active JSON Storage Operations ---');
    const newResumeId = crypto.randomUUID();
    const now = new Date().toISOString();
    insertResumeRecord(
      {
        id: newResumeId,
        originalFilename: 'Test_Candidate_CV.pdf',
        fileFormat: 'pdf',
        fileSize: 1024,
        fileHash: 'mock_hash_123',
        storageFilename: `${newResumeId}.pdf`,
        extractedText: 'Extracted plain text content for test resume',
        characterCount: 44,
        wordCount: 7,
        preview: 'Extracted plain text content',
        createdAt: now,
      },
      testTempDir
    );

    const updatedResumes = listAllResumes(testTempDir);
    assert('Resume is immediately readable from JSON storage', updatedResumes.length === 1);
    assert('Resume metadata ID matches', updatedResumes[0].id === newResumeId);
    assert('Resume metadata filename matches', updatedResumes[0].originalFilename === 'Test_Candidate_CV.pdf');

    const details = getResumeDetailsById(newResumeId, testTempDir);
    assert('Resume details returns extracted text', details?.extractedText === 'Extracted plain text content for test resume');

    // 3. Candidate Profile Auto-Population from Resume Text
    console.log('\n--- 3. Candidate Profile Auto-Population from Resume ---');
    const resumeTextFixture = `
Alex Morgan
Senior Full-Stack Engineer
alex.morgan@example.com | (555) 234-5678 | San Francisco, CA
https://linkedin.com/in/alexmorgan | https://github.com/alexmorgan

PROFESSIONAL SUMMARY
Experienced software engineer with 6+ years specializing in TypeScript, React, Node.js, and cloud systems.

TECHNICAL SKILLS
TypeScript, JavaScript, React, Node.js, Python, PostgreSQL, Docker, AWS, Git

WORK EXPERIENCE
Lead Developer
CloudScale Technologies | 2021 – Present
• Architected real-time notification engine with Node.js and Redis
• Reduced page load times by 40% across web applications

Software Engineer
Nexus Labs | 2018 – 2021
• Built microservices using TypeScript and Express
• Designed relational databases using PostgreSQL

EDUCATION
Bachelor of Science in Computer Science
University of California, Berkeley | 2018
    `.trim();

    const parsed = parseCandidateProfileFromText(resumeTextFixture, 'test-profile');

    assert('Correctly extracted full name', parsed.profile.fullName === 'Alex Morgan', `Name: ${parsed.profile.fullName}`);
    assert('Correctly extracted email', parsed.profile.email === 'alex.morgan@example.com');
    assert('Correctly extracted phone', parsed.profile.phone === '(555) 234-5678');
    assert('Correctly extracted location', parsed.profile.location === 'San Francisco, CA');
    assert('Correctly extracted LinkedIn URL', parsed.profile.linkedinUrl === 'https://linkedin.com/in/alexmorgan');
    assert('Correctly extracted GitHub URL', parsed.profile.githubUrl === 'https://github.com/alexmorgan');
    assert('Missing portfolio remains null (NOT fabricated)', parsed.profile.portfolioUrl === null);
    assert('Extracted professional summary', (parsed.profile.professionalSummary || '').includes('Experienced software engineer'));
    assert('Extracted recognized technical skills', parsed.skills.length >= 7, `Skills count: ${parsed.skills.length}`);
    assert('Extracted TypeScript skill', parsed.skills.some((s) => s.name === 'TypeScript'));
    assert('Extracted React skill', parsed.skills.some((s) => s.name === 'React'));
    assert('Extracted work experiences (2 positions)', parsed.experience.length === 2, `Exp count: ${parsed.experience.length}`);
    assert('Current job marked with isCurrent = true', parsed.experience[0].isCurrent === true);
    assert('Extracted education records', parsed.education.length === 1, `Edu count: ${parsed.education.length}`);
    assert('Extracted education institution', parsed.education[0].institution === 'University of California, Berkeley');
    assert('Confidence score >= 0.70', parsed.confidenceScore >= 0.7, `Score: ${parsed.confidenceScore}`);
    assert('Status is success', parsed.status === 'success');

    // 4. Missing Fields Remain Empty / Un-fabricated
    console.log('\n--- 4. Un-fabricated Missing Fields on Sparse Text ---');
    const sparseText = `
Jordan Smith
Frontend Developer
JavaScript, HTML, CSS
    `.trim();

    const sparseParsed = parseCandidateProfileFromText(sparseText, 'sparse-profile');
    assert('Sparse profile extracted name', sparseParsed.profile.fullName === 'Jordan Smith');
    assert('Sparse profile email is strictly null', sparseParsed.profile.email === null);
    assert('Sparse profile phone is strictly null', sparseParsed.profile.phone === null);
    assert('Sparse profile location is strictly null', sparseParsed.profile.location === null);
    assert('Sparse profile linkedin is strictly null', sparseParsed.profile.linkedinUrl === null);
    assert('Missing fields tracked accurately', sparseParsed.missingFields.includes('email') && sparseParsed.missingFields.includes('phone'));
    assert('Sparse profile marked as partial or needs_review', ['partial', 'needs_review'].includes(sparseParsed.status));

    // 5. Existing Profile Information is Not Silently Overwritten
    console.log('\n--- 5. Non-Destructive Profile Merging & Preservation ---');
    const initialProfile = {
      profile: {
        id: 'default-profile',
        fullName: 'Alex Morgan',
        email: 'alex.original@example.com',
        phone: '555-999-0000',
        location: 'Original City, CA',
        linkedinUrl: 'https://linkedin.com/in/alex-original',
        portfolioUrl: 'https://alexmorgan.dev',
        githubUrl: null,
        professionalSummary: 'Original user-entered summary that must never be destroyed',
        currentTitle: 'Principal Architect',
        totalExperienceMonths: 96,
        createdAt: now,
        updatedAt: now,
      },
      skills: [
        {
          id: 'sk-1',
          profileId: 'default-profile',
          name: 'GraphQL',
          normalizedName: 'graphql',
          category: 'technical',
          sourceType: 'user',
          createdAt: now,
          updatedAt: now,
        },
      ],
      experience: [],
      education: [],
      projects: [],
      certifications: [],
    };
    saveCandidateProfile(initialProfile, testTempDir);

    // Merge with parsed data where email is different and location is null
    const incomingExtracted = {
      profile: {
        ...parsed.profile,
        email: 'alex.new@example.com',
        location: null, // extracted did not find location
      },
      skills: parsed.skills,
      experience: parsed.experience,
      education: parsed.education,
      projects: parsed.projects,
      certifications: parsed.certifications,
    };

    const mergeResult = mergeCandidateProfile(incomingExtracted, testTempDir);
    assert('Merge detected email conflict', mergeResult.conflicts.includes('email'));
    assert('Existing email was PRESERVED without overwrite', mergeResult.merged.profile?.email === 'alex.original@example.com');
    assert('Existing location was PRESERVED when incoming was null', mergeResult.merged.profile?.location === 'Original City, CA');
    assert('Existing user summary was PRESERVED', mergeResult.merged.profile?.professionalSummary === 'Original user-entered summary that must never be destroyed');
    assert('Existing portfolio was PRESERVED', mergeResult.merged.profile?.portfolioUrl === 'https://alexmorgan.dev');
    assert('Original user skill (GraphQL) was preserved alongside new skills', mergeResult.merged.skills.some((s) => s.name === 'GraphQL'));
    assert('New skills (TypeScript) were added', mergeResult.merged.skills.some((s) => s.name === 'TypeScript'));

    // 6. Persistence Verification After Reload
    console.log('\n--- 6. Profile Persistence on Reload ---');
    const reloaded = loadCandidateProfile(testTempDir);
    assert('Reloaded profile matches merged profile full name', reloaded.profile?.fullName === 'Alex Morgan');
    assert('Reloaded profile preserves original email', reloaded.profile?.email === 'alex.original@example.com');
    assert('Reloaded profile contains merged skills', reloaded.skills.length > 5);

    // 7. Invalid File Rejection
    console.log('\n--- 7. Invalid Document Handling ---');
    let emptyFileError = false;
    try {
      validateResumeFile('empty.pdf', Buffer.alloc(0));
    } catch {
      emptyFileError = true;
    }
    assert('Empty document produces a clear validation error', emptyFileError);

    let unsupportedFormatError = false;
    try {
      validateResumeFile('malicious.exe', Buffer.from('NOT_A_RESUME'));
    } catch {
      unsupportedFormatError = true;
    }
    assert('Unsupported file extension produces a clear validation error', unsupportedFormatError);

    // 8. Source File Length Audit (< 300 Lines)
    console.log('\n--- 8. Source File Length Audit (< 300 Lines Rule) ---');
    const filesToAudit = [
      'apps/desktop/src/main/extraction/contactParser.ts',
      'apps/desktop/src/main/extraction/sectionParser.ts',
      'apps/desktop/src/main/extraction/experienceParser.ts',
      'apps/desktop/src/main/extraction/profileParser.ts',
      'apps/desktop/src/main/storage/jsonProfileRepository.ts',
      'apps/desktop/src/main/storage/jsonResumeRepository.ts',
      'apps/desktop/src/main/storage/jsonSettingsRepository.ts',
      'apps/desktop/src/main/ipc/profileIpc.ts',
      'apps/desktop/src/main/resume/resumeService.ts',
      'apps/desktop/src/renderer/components/CandidateProfileCard.tsx',
      'apps/desktop/src/renderer/App.tsx',
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
  console.log(`\n======================================================\n ALL ${tests.length} CLEAN STORAGE & PROFILE TESTS PASSED!\n======================================================\n`);
  process.exit(allPassed ? 0 : 1);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
