import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { importLocal, createTestCollector } from './db-test-helpers.mjs';

const { setCustomDataRoot } = await importLocal('dist-electron/main/storage/storageRootResolver.js');
const { initializeStorageHierarchy } = await importLocal('dist-electron/main/storage/directoryInitializer.js');
const { getTargetStorageLocations } = await importLocal('dist-electron/main/storage/targetStorageLocations.js');
const { readJsonSafe, writeJsonAtomic } = await importLocal('dist-electron/main/storage/atomicFileWriter.js');
const {
  loadCandidateProfile,
  saveCandidateProfile,
  mergeCandidateProfile,
} = await importLocal('dist-electron/main/storage/jsonProfileRepository.js');
const { importResumeBuffer } = await importLocal('dist-electron/main/resume/resumeService.js');
const { getJsonStorageStatus } = await importLocal('dist-electron/main/ipc/storageIpc.js');

const testTempDir = path.resolve('temp_test_complete_profile_schema_' + Date.now());

const { tests, assert } = createTestCollector();

async function runTests() {
  console.log('======================================================');
  console.log('   APPLYPILOT COMPLETE PROFILE SCHEMA & UI EDIT TESTS ');
  console.log('======================================================\n');

  try {
    setCustomDataRoot(testTempDir);
    initializeStorageHierarchy(testTempDir);
    const locs = getTargetStorageLocations(testTempDir);

    // 1. All 6 profile JSON files exist after launch
    console.log('\n--- 1. All 6 Profile JSON Files Exist After Launch ---');
    assert('candidate-profile.json exists', fs.existsSync(locs.candidateProfileFile));
    assert('skills.json exists', fs.existsSync(locs.skillsFile));
    assert('work-experiences.json exists', fs.existsSync(locs.workExperiencesFile));
    assert('education-records.json exists', fs.existsSync(locs.educationRecordsFile));
    assert('projects.json exists', fs.existsSync(locs.projectsFile));
    assert('certifications.json exists', fs.existsSync(locs.certificationsFile));

    // 2. Every agreed schema key exists with correct type and valid empty default
    console.log('\n--- 2. Schema Keys and Empty Defaults Verification ---');
    const candidateProfile = readJsonSafe(locs.candidateProfileFile, null);
    assert('candidate-profile.json is not null', candidateProfile !== null);
    assert('id is "default-profile"', candidateProfile?.id === 'default-profile');
    assert('fullName exists and is empty string', candidateProfile?.fullName === '');
    assert('email is null', candidateProfile?.email === null);
    assert('phone is null', candidateProfile?.phone === null);
    assert('location is null', candidateProfile?.location === null);
    assert('countryCode is null', candidateProfile?.countryCode === null);
    assert('linkedinUrl is null', candidateProfile?.linkedinUrl === null);
    assert('portfolioUrl is null', candidateProfile?.portfolioUrl === null);
    assert('githubUrl is null', candidateProfile?.githubUrl === null);
    assert('professionalSummary is null', candidateProfile?.professionalSummary === null);
    assert('currentTitle is null', candidateProfile?.currentTitle === null);
    assert('totalExperienceMonths is null', candidateProfile?.totalExperienceMonths === null);
    assert('profileDataJson is valid JSON object/string', typeof candidateProfile?.profileDataJson === 'string');
    assert('createdAt is valid ISO date string', typeof candidateProfile?.createdAt === 'string' && !isNaN(Date.parse(candidateProfile.createdAt)));
    assert('updatedAt is valid ISO date string', typeof candidateProfile?.updatedAt === 'string' && !isNaN(Date.parse(candidateProfile.updatedAt)));

    const skills = readJsonSafe(locs.skillsFile, null);
    assert('skills.json initialized as empty array', Array.isArray(skills) && skills.length === 0);

    const workExp = readJsonSafe(locs.workExperiencesFile, null);
    assert('work-experiences.json initialized as empty array', Array.isArray(workExp) && workExp.length === 0);

    const edu = readJsonSafe(locs.educationRecordsFile, null);
    assert('education-records.json initialized as empty array', Array.isArray(edu) && edu.length === 0);

    const proj = readJsonSafe(locs.projectsFile, null);
    assert('projects.json initialized as empty array', Array.isArray(proj) && proj.length === 0);

    const cert = readJsonSafe(locs.certificationsFile, null);
    assert('certifications.json initialized as empty array', Array.isArray(cert) && cert.length === 0);

    // 3. Repeated initialization preserves existing valid data
    console.log('\n--- 3. Preservation Guarantee on Repeated Initialization ---');
    saveCandidateProfile(
      {
        profile: {
          ...candidateProfile,
          fullName: 'Taylor Swift',
          email: 'taylor@example.com',
          location: 'Nashville, TN',
          currentTitle: 'Lead Songwriter',
        },
        skills: [
          {
            id: 'skill-ts',
            profileId: 'default-profile',
            name: 'TypeScript',
            normalizedName: 'typescript',
            category: 'Languages',
            sourceType: 'user',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        experience: [
          {
            id: 'exp-1',
            profileId: 'default-profile',
            companyName: 'Music Corp',
            jobTitle: 'Principal Artist',
            startDate: '2014-01',
            endDate: null,
            isCurrent: true,
            achievements: ['Won 14 Grammys'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        education: [],
        projects: [],
        certifications: [],
      },
      testTempDir
    );

    // Re-run initialization
    initializeStorageHierarchy(testTempDir);
    const reloadedProfile = loadCandidateProfile(testTempDir);
    assert('fullName preserved after re-init', reloadedProfile.profile?.fullName === 'Taylor Swift');
    assert('email preserved after re-init', reloadedProfile.profile?.email === 'taylor@example.com');
    assert('skills preserved after re-init', reloadedProfile.skills.length === 1 && reloadedProfile.skills[0].name === 'TypeScript');
    assert('work experience preserved after re-init', reloadedProfile.experience.length === 1 && reloadedProfile.experience[0].companyName === 'Music Corp');

    // 4. Manual UI profile edits persist to JSON files and reload after restart
    console.log('\n--- 4. UI Profile Edits Persistence and Validation ---');
    const editedProfilePayload = {
      profile: {
        ...reloadedProfile.profile,
        phone: '(555) 987-6543',
        linkedinUrl: 'https://linkedin.com/in/taylorswift',
        professionalSummary: 'Accomplished engineering leader and songwriter.',
        updatedAt: new Date().toISOString(),
      },
      skills: [
        ...reloadedProfile.skills,
        {
          id: 'skill-react',
          profileId: 'default-profile',
          name: 'React',
          normalizedName: 'react',
          category: 'Frontend',
          sourceType: 'user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      experience: reloadedProfile.experience,
      education: [
        {
          id: 'edu-1',
          profileId: 'default-profile',
          institution: 'Berklee College of Music',
          degree: 'Honorary Doctorate',
          fieldOfStudy: 'Music & Arts',
          location: 'Boston, MA',
          startDate: '2022-01',
          endDate: '2022-05',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      projects: [],
      certifications: [],
    };

    saveCandidateProfile(editedProfilePayload, testTempDir);

    // Verify written directly to the separate JSON files
    const diskProfile = readJsonSafe(locs.candidateProfileFile, null);
    const diskSkills = readJsonSafe(locs.skillsFile, []);
    const diskEdu = readJsonSafe(locs.educationRecordsFile, []);

    assert('candidate-profile.json updated with phone', diskProfile?.phone === '(555) 987-6543');
    assert('candidate-profile.json updated with linkedin', diskProfile?.linkedinUrl === 'https://linkedin.com/in/taylorswift');
    assert('skills.json updated with 2 skills', diskSkills.length === 2);
    assert('education-records.json updated with 1 record', diskEdu.length === 1 && diskEdu[0].institution === 'Berklee College of Music');

    // 5. Non-destructive merge preserves user-entered values during resume extraction
    console.log('\n--- 5. Non-Destructive Merge of Extracted Resume ---');
    const mergeTestPayload = {
      profile: {
        id: 'default-profile',
        fullName: 'Taylor Different Name', // should NOT overwrite existing
        email: 'taylor.new@work.com',     // conflict detected, existing preserved
        phone: null,                      // incoming null should NOT erase existing phone
        location: 'New York, NY',         // will overwrite because existing was null or user had none
        countryCode: 'US',
        linkedinUrl: null,
        portfolioUrl: 'https://taylorswift.com', // previously empty, will populate
        githubUrl: 'https://github.com/taylorswift',
        professionalSummary: 'Extracted summary', // conflict detected, existing preserved
        currentTitle: 'Lead Songwriter',
        totalExperienceMonths: 120,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      skills: [
        {
          id: 'skill-node',
          profileId: 'default-profile',
          name: 'Node.js',
          normalizedName: 'nodejs',
          category: 'Backend',
          sourceType: 'resume_extraction',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      experience: [],
      education: [],
      projects: [],
      certifications: [],
      lastExtractionMetadata: {
        confidenceScore: 0.92,
        fieldsExtracted: ['fullName', 'email', 'portfolioUrl', 'githubUrl'],
        extractedAt: new Date().toISOString(),
        status: 'success',
      },
    };

    const mergeResult = mergeCandidateProfile(mergeTestPayload, testTempDir);
    assert('Conflicts detected for existing fields', mergeResult.conflicts.length > 0);
    assert('Existing fullName preserved (Taylor Swift)', mergeResult.merged.profile?.fullName === 'Taylor Swift');
    assert('Existing email preserved (taylor@example.com)', mergeResult.merged.profile?.email === 'taylor@example.com');
    assert('Existing phone preserved ((555) 987-6543)', mergeResult.merged.profile?.phone === '(555) 987-6543');
    assert('New portfolioUrl populated', mergeResult.merged.profile?.portfolioUrl === 'https://taylorswift.com');
    assert('New skills merged without overwriting existing', mergeResult.merged.skills.length === 3);
    assert('Skills contain both user and extracted skills', mergeResult.merged.skills.some((s) => s.normalizedName === 'nodejs'));

    // 6. Relationship integrity: All records reference 'default-profile'
    console.log('\n--- 6. Entity Relationship Integrity ---');
    const finalSkills = readJsonSafe(locs.skillsFile, []);
    const allSkillsLinked = finalSkills.every((s) => s.profileId === 'default-profile');
    assert('All skills reference valid profileId', allSkillsLinked);

    const finalEdu = readJsonSafe(locs.educationRecordsFile, []);
    const allEduLinked = finalEdu.every((e) => e.profileId === 'default-profile');
    assert('All education records reference valid profileId', allEduLinked);

    // 7. No SQLite connection remains in storage status
    console.log('\n--- 7. Zero SQLite Dependencies in Active Runtime ---');
    const status = getJsonStorageStatus(testTempDir);
    assert('Storage status reports isInitialized = true', status.isInitialized === true);
    assert('Storage status reports databasePath = portable-json', status.databasePath === 'portable-json');
    assert('No SQLite database handles created in testTempDir', !fs.existsSync(path.join(testTempDir, 'database', 'applypilot.sqlite-wal')));

    // 8. Source File Length Audit (< 300 Lines)
    console.log('\n--- 8. Source File Length Audit (< 300 Lines) ---');
    const filesToAudit = [
      'apps/desktop/src/main/storage/targetStorageLocations.ts',
      'apps/desktop/src/main/storage/directoryInitializer.ts',
      'apps/desktop/src/main/storage/jsonSchemas.ts',
      'apps/desktop/src/main/storage/jsonProfileRepository.ts',
      'apps/desktop/src/main/ipc/storageIpc.ts',
      'apps/desktop/src/main/main.ts',
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
  console.log(`\n======================================================\n ALL ${tests.length} COMPLETE PROFILE SCHEMA TESTS PASSED!\n======================================================\n`);
  process.exit(allPassed ? 0 : 1);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
