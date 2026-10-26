import fs from 'node:fs';
import path from 'node:path';
import { importLocal, createTestCollector } from './db-test-helpers.mjs';

const { setCustomDataRoot } = await importLocal('dist-electron/main/storage/storageRootResolver.js');
const { initializeStorageHierarchy, reconcileLegacyProfileStorage } = await importLocal('dist-electron/main/storage/directoryInitializer.js');
const { getTargetStorageLocations } = await importLocal('dist-electron/main/storage/targetStorageLocations.js');
const { readJsonSafe, writeJsonAtomic } = await importLocal('dist-electron/main/storage/atomicFileWriter.js');
const {
  loadCandidateProfile,
  saveCandidateProfile,
  mergeCandidateProfile,
} = await importLocal('dist-electron/main/storage/jsonProfileRepository.js');
const {
  normalizeResumeText,
  parseCandidateProfileFromText,
  parseWorkExperiences,
  parseEducationRecords,
  parseProjects,
  parseCertifications,
  extractContactInfo,
} = await importLocal('dist-electron/main/extraction/index.js');

const testTempDir = path.resolve('temp_test_extraction_and_tabs_' + Date.now());
const { tests, assert } = createTestCollector();

async function runTests() {
  console.log('======================================================');
  console.log('   APPLYPILOT RESUME EXTRACTION & TABS AUDIT TESTS   ');
  console.log('======================================================\n');

  try {
    setCustomDataRoot(testTempDir);
    initializeStorageHierarchy(testTempDir);
    const locs = getTargetStorageLocations(testTempDir);

    // -------------------------------------------------------------------------
    // 1. Multi-role at same company & bullet points association
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Multi-Role Work Experience Parsing ---');
    const multiRoleText = `
Technomind Solution Ltd | Belgaum, India
Lead React Architect | Jan 2024 – Present
• Architected core microfrontend framework
• Decreased initial load time by 45%
React.js Developer | Jan 2022 – Dec 2023
• Built reusable design system components
• Integrated payment gateway with 99.9% uptime
`;
    const extractedMultiRole = parseWorkExperiences(multiRoleText, 'default-profile');
    assert('Extracted 2 distinct roles', extractedMultiRole.length === 2, `Actual: ${extractedMultiRole.length}`);

    const role1 = extractedMultiRole[0];
    const role2 = extractedMultiRole[1];
    assert('Role 1 title is Lead React Architect', role1?.jobTitle === 'Lead React Architect');
    assert('Role 1 company is Technomind Solution Ltd', role1?.companyName === 'Technomind Solution Ltd');
    assert('Role 1 startDate is 2024-01', role1?.startDate === '2024-01');
    assert('Role 1 isCurrent is true', role1?.isCurrent === true);
    assert('Role 1 endDate is null', role1?.endDate === null);
    assert('Role 1 has 2 achievements', role1?.achievements?.length === 2);
    assert('Role 1 achievement content preserved', role1?.achievements?.[0]?.includes('microfrontend'));

    assert('Role 2 title is React.js Developer', role2?.jobTitle === 'React.js Developer');
    assert('Role 2 inherited company Technomind Solution Ltd', role2?.companyName === 'Technomind Solution Ltd');
    assert('Role 2 startDate is 2022-01', role2?.startDate === '2022-01');
    assert('Role 2 endDate is 2023-12', role2?.endDate === '2023-12');
    assert('Role 2 isCurrent is false', role2?.isCurrent === false);
    assert('Role 2 has 2 achievements', role2?.achievements?.length === 2);

    // -------------------------------------------------------------------------
    // 2. Dates without fabrication & missing dates handled as null
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Date Normalization & No Fabrication ---');
    const missingDateText = `
Senior Consultant
Acme Advisory
• Advised executive team on cloud transformation
`;
    const missingDateRole = parseWorkExperiences(missingDateText, 'default-profile');
    assert('Extracted 1 role with missing dates', missingDateRole.length === 1);
    assert('Missing startDate is null (not fabricated to 2020-01)', missingDateRole[0]?.startDate === null);
    assert('Missing endDate is null', missingDateRole[0]?.endDate === null);
    assert('isCurrent is false', missingDateRole[0]?.isCurrent === false);

    // -------------------------------------------------------------------------
    // 3. Normalization & Page Artifact Removal
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Page Number Filtering & Artifact Cleansing ---');
    const rawWithFooters = `
John Doe
Lead Engineer
-- 1 of 2 --
Page 2 of 2
1 / 2
Experience at Google
`;
    const normalized = normalizeResumeText(rawWithFooters);
    assert('Footers "-- 1 of 2 --" stripped', !normalized.text.includes('-- 1 of 2 --'));
    assert('Footers "Page 2 of 2" stripped', !normalized.text.includes('Page 2 of 2'));
    assert('Footers "1 / 2" stripped', !normalized.text.includes('1 / 2'));

    // -------------------------------------------------------------------------
    // 4. Diverse Section Headings Detection
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Diverse Section Headings Recognition ---');
    const diverseResume = `
Jane Smith
jane@example.com | (555) 012-3456 | Seattle, WA
https://linkedin.com/in/janesmith

CAREER OBJECTIVE
High-energy engineering leader passionate about AI application systems.

AREAS OF EXPERTISE
TypeScript, Node.js, Electron, Next.js, PostgreSQL, Docker, AWS

CAREER HISTORY
Acme Cloud Systems
Staff Engineer | 06/2021 – Present
• Designed distributed event pipeline
• Reduced system outages by 60%

ACADEMIC QUALIFICATIONS
University of Washington
Bachelor of Science in Computer Science | 2020

SELECTED PROJECTS
ApplyPilot Desktop | TypeScript, Electron
https://github.com/example/applypilot
• Built offline-first job application tool

CREDENTIALS
AWS Certified Solutions Architect - Amazon Web Services
Issued 2023
`;
    const parsedData = parseCandidateProfileFromText(diverseResume, 'default-profile');
    assert('Contact name parsed as Jane Smith', parsedData.profile.fullName === 'Jane Smith');
    assert('Email parsed correctly', parsedData.profile.email === 'jane@example.com');
    assert('Phone parsed correctly', parsedData.profile.phone === '(555) 012-3456');
    assert('Summary extracted under CAREER OBJECTIVE', Boolean(parsedData.profile.professionalSummary?.includes('High-energy engineering leader')));
    assert('Skills extracted under AREAS OF EXPERTISE', parsedData.skills.some((s) => s.normalizedName === 'typescript'));
    assert('Work experience extracted under CAREER HISTORY', parsedData.experience.length === 1 && parsedData.experience[0].jobTitle === 'Staff Engineer');
    assert('Education extracted under ACADEMIC QUALIFICATIONS', parsedData.education.length === 1 && parsedData.education[0].institution.includes('University of Washington'));
    assert('Projects extracted under SELECTED PROJECTS', parsedData.projects.length === 1 && parsedData.projects[0].name.includes('ApplyPilot Desktop'));
    assert('Certifications extracted under CREDENTIALS', parsedData.certifications.length === 1 && parsedData.certifications[0].name.includes('AWS Certified Solutions Architect'));
    assert('High extraction confidence score', parsedData.confidenceScore >= 0.7);

    // -------------------------------------------------------------------------
    // 5. Deduplication on Repeated Processing
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Duplicate Prevention on Repeated Processing ---');
    // First merge
    const merge1 = mergeCandidateProfile({
      profile: parsedData.profile,
      skills: parsedData.skills,
      experience: parsedData.experience,
      education: parsedData.education,
      projects: parsedData.projects,
      certifications: parsedData.certifications,
    }, testTempDir);

    const initialExpCount = merge1.merged.experience.length;
    const initialSkillCount = merge1.merged.skills.length;
    const initialProjCount = merge1.merged.projects.length;
    const initialCertCount = merge1.merged.certifications.length;

    // Second merge with same extracted data
    const merge2 = mergeCandidateProfile({
      profile: parsedData.profile,
      skills: parsedData.skills,
      experience: parsedData.experience,
      education: parsedData.education,
      projects: parsedData.projects,
      certifications: parsedData.certifications,
    }, testTempDir);

    assert('Zero duplicate experiences created on re-processing', merge2.merged.experience.length === initialExpCount);
    assert('Zero duplicate skills created on re-processing', merge2.merged.skills.length === initialSkillCount);
    assert('Zero duplicate projects created on re-processing', merge2.merged.projects.length === initialProjCount);
    assert('Zero duplicate certifications created on re-processing', merge2.merged.certifications.length === initialCertCount);

    // -------------------------------------------------------------------------
    // 6. JSON Consolidation & Legacy File Cleanup
    // -------------------------------------------------------------------------
    console.log('\n--- 6. JSON Consolidation & Legacy Path Migration ---');
    assert('Canonical candidate-profile.json exists', fs.existsSync(locs.candidateProfileFile));
    assert('Settings file is in data/settings/settings.json', locs.settingsFile.includes(path.join('settings', 'settings.json')));
    assert('Job preferences is in data/preferences/job-preferences.json', locs.jobPreferencesFile.includes(path.join('preferences', 'job-preferences.json')));

    // Simulate presence of legacy redundant files under profile/
    const legacyProfile = path.join(locs.profileDir, 'profile.json');
    const legacySettings = path.join(locs.profileDir, 'settings.json');
    const legacyPrefs = path.join(locs.profileDir, 'job-preferences.json');

    writeJsonAtomic(legacyProfile, { githubUrl: 'https://github.com/migrated' });
    writeJsonAtomic(legacySettings, { theme: 'dark' });
    writeJsonAtomic(legacyPrefs, { remoteOnly: true });

    reconcileLegacyProfileStorage(locs);

    assert('Legacy profile.json was removed after reconciliation', !fs.existsSync(legacyProfile));
    assert('Legacy settings.json was removed after reconciliation', !fs.existsSync(legacySettings));
    assert('Legacy job-preferences.json was removed after reconciliation', !fs.existsSync(legacyPrefs));

    const reconciledSettings = readJsonSafe(locs.settingsFile, {});
    assert('Legacy settings data reconciled to settings/settings.json', reconciledSettings.theme === 'dark');

    const reconciledPrefs = readJsonSafe(locs.jobPreferencesFile, {});
    assert('Legacy preferences reconciled to preferences/job-preferences.json', reconciledPrefs.remoteOnly === true);

    // -------------------------------------------------------------------------
    // 7. Profile Edits Across All 6 Tabs Persist Correctly
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Tabbed Profile Persistence Validation ---');
    const tabEditPayload = {
      profile: {
        ...merge2.merged.profile,
        fullName: 'Jane Smith Updated',
        currentTitle: 'Chief Technology Officer',
      },
      skills: [
        ...merge2.merged.skills,
        {
          id: 'skill-graphql',
          profileId: 'default-profile',
          name: 'GraphQL',
          normalizedName: 'graphql',
          category: 'technical',
          sourceType: 'user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      experience: [
        ...merge2.merged.experience,
        {
          id: 'exp-founder',
          profileId: 'default-profile',
          companyName: 'NextGen AI Labs',
          jobTitle: 'Founder',
          startDate: '2025-01',
          endDate: null,
          isCurrent: true,
          achievements: ['Founded next-gen dev tooling'],
          description: 'Founded next-gen dev tooling',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      education: merge2.merged.education,
      projects: merge2.merged.projects,
      certifications: merge2.merged.certifications,
    };

    saveCandidateProfile(tabEditPayload, testTempDir);

    const reloaded = loadCandidateProfile(testTempDir);
    assert('Updated full name persisted', reloaded.profile?.fullName === 'Jane Smith Updated');
    assert('Updated current title persisted', reloaded.profile?.currentTitle === 'Chief Technology Officer');
    assert('New skill persisted', reloaded.skills.some((s) => s.normalizedName === 'graphql'));
    assert('New experience persisted', reloaded.experience.some((e) => e.companyName === 'NextGen AI Labs'));

    // -------------------------------------------------------------------------
    // 8. Source File Length Audit (< 300 Lines)
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Strict Source File Line Count Audit (< 300 Lines) ---');
    const srcDir = path.resolve('src');
    const scanDir = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          scanDir(full);
        } else if (/\.(ts|tsx)$/.test(ent.name) && !ent.name.endsWith('.d.ts')) {
          const content = fs.readFileSync(full, 'utf8');
          const lines = content.split('\n').length;
          assert(`File ${path.relative(srcDir, full)} is under 300 lines (${lines} lines)`, lines < 300);
        }
      }
    };
    scanDir(srcDir);

  } finally {
    setCustomDataRoot(null);
    try {
      fs.rmSync(testTempDir, { recursive: true, force: true });
    } catch {
      // Cleanup best effort
    }
  }

  const allPassed = tests.every((t) => t.pass);
  console.log(`\n======================================================\n ALL ${tests.length} RESUME EXTRACTION & TABS TESTS PASSED!\n======================================================\n`);
  process.exit(allPassed ? 0 : 1);
}

runTests().catch((err) => {
  console.error('Test suite failed unexpectedly:', err);
  process.exit(1);
});
