import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from 'electron';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const testDataDir = path.join(projectRoot, 'data');

const log = (msg) => console.log(`[TEST-REPLACE] ${msg}`);
const assert = (condition, msg) => {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(msg);
  }
  console.log(`✅ ${msg}`);
};

const createDocxBuffer = async (text) => {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>'
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>'
  );

  const paragraphs = text
    .split('\n')
    .map((line) => `<w:p><w:r><w:t>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</w:t></w:r></w:p>`)
    .join('');

  zip.file(
    'word/document.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body>' +
      paragraphs +
      '</w:body>' +
      '</w:document>'
  );

  return zip.generateAsync({ type: 'nodebuffer' });
};

async function runReplacementTests() {
  log('Starting full Resume & Extracted Profile Replacement verification...');

  const { initializeStorageHierarchy } = await import('../dist-electron/main/storage/directoryInitializer.js');
  const { loadProfile } = await import('../dist-electron/main/storage/jsonProfileRepository.js');
  const { getTargetStorageLocations } = await import('../dist-electron/main/storage/targetStorageLocations.js');
  const { getMasterResumeStatus, importResumeBuffer } = await import('../dist-electron/main/resume/resumeService.js');
  const { isMinimalProfile } = await import('../dist-electron/main/storage/minimalProfileSchema.js');

  // Initialize storage hierarchy
  initializeStorageHierarchy(testDataDir);
  const locations = getTargetStorageLocations(testDataDir);

  // Backup current master resume if present to restore at the very end
  let originalMasterBackup = null;
  let originalMasterName = null;
  if (fs.existsSync(locations.masterResumePdf)) {
    originalMasterBackup = fs.readFileSync(locations.masterResumePdf);
    originalMasterName = 'master-resume.pdf';
  } else if (fs.existsSync(locations.masterResumeDocx)) {
    originalMasterBackup = fs.readFileSync(locations.masterResumeDocx);
    originalMasterName = 'master-resume.docx';
  }

  try {
    // -------------------------------------------------------------
    // Step 1: Upload Resume A for Person A
    // Contains: full skills, two work experiences, education, projects, certifications, contact details
    // -------------------------------------------------------------
    log('--- Step 1: Upload Resume A for Person A ---');
    const resumeAText = `Alexander Armstrong
alexander.armstrong@example.com | 415-555-0144 | San Francisco, CA
https://linkedin.com/in/alexander-armstrong | https://github.com/alexander-armstrong

SUMMARY
Senior Software Engineer with deep expertise in full stack and cloud distributed systems.

EXPERIENCE
Lead Architect | TechCorp | Jan 2021 - Present
- Designed microservices architecture handling 10M daily requests.
- Mentored a distributed team of engineers.

Software Engineer | NextGen Systems | Mar 2018 - Dec 2020
- Built RESTful APIs and real-time streaming services.
- Optimized database query performance by 40%.

EDUCATION
Stanford University | B.S. in Computer Science | Sep 2014 - Jun 2018

PROJECTS
CloudSync - Distributed cloud file synchronization engine with end-to-end encryption.

CERTIFICATIONS
AWS Certified Solutions Architect

SKILLS
TypeScript, React, Python, Docker, Kubernetes, AWS, PostgreSQL
`;

    const resumeABuffer = await createDocxBuffer(resumeAText);
    const resultA = await importResumeBuffer('resume_alexander.docx', resumeABuffer, testDataDir);

    assert(resultA.success === true, 'Resume A imported successfully');

    // -------------------------------------------------------------
    // Step 2: Confirm profile contains Person A's extracted data
    // -------------------------------------------------------------
    log('--- Step 2: Confirm profile contains Person A extracted data ---');
    const profileA = loadProfile(testDataDir);
    assert(isMinimalProfile(profileA), 'Profile A matches MinimalProfile schema');
    assert(profileA.user_info.first_name === 'Alexander', 'Person A first_name matches');
    assert(profileA.user_info.last_name === 'Armstrong', 'Person A last_name matches');
    assert(profileA.user_info.email === 'alexander.armstrong@example.com', 'Person A email matches');
    assert(profileA.user_info.phone_number.includes('415-555-0144') || profileA.user_info.phone_number.includes('4155550144'), 'Person A phone matches');
    assert(profileA.user_info.city === 'San Francisco', 'Person A city matches');
    assert(profileA.social_media.linkedin_profile.includes('alexander-armstrong'), 'Person A linkedin matches');
    assert(profileA.social_media.github_link.includes('alexander-armstrong'), 'Person A github matches');
    assert(profileA.experience.length === 2, `Person A has 2 experience entries (found ${profileA.experience.length})`);
    assert(profileA.experience[0].company === 'TechCorp', 'Person A first company is TechCorp');
    assert(profileA.experience[1].company === 'NextGen Systems', 'Person A second company is NextGen Systems');
    assert(profileA.education.length >= 1, 'Person A education extracted');
    assert(profileA.education[0].school.includes('Stanford'), 'Person A education school matches');
    assert(profileA.professional.projects.length >= 1, 'Person A projects extracted');
    assert(profileA.professional.certificates.length >= 1, 'Person A certificates extracted');
    assert(profileA.professional.skills.includes('TypeScript'), 'Person A has TypeScript skill');
    assert(profileA.professional.skills.includes('Kubernetes'), 'Person A has Kubernetes skill');

    // -------------------------------------------------------------
    // Step 3: Upload Resume B for Person B
    // Different person with fewer fields (no education, no projects, no certs, no social links, 1 experience)
    // -------------------------------------------------------------
    log('--- Step 3: Upload Resume B for Person B ---');
    const resumeBText = `Bella Brooks
bella.brooks@example.com | 206-555-0188 | Seattle, WA

EXPERIENCE
Backend Developer | Acme Cloud | Feb 2022 - Present
- Building high-throughput streaming pipelines.

SKILLS
Go, Rust
`;

    const resumeBBuffer = await createDocxBuffer(resumeBText);
    const resultB = await importResumeBuffer('resume_bella.docx', resumeBBuffer, testDataDir);
    assert(resultB.success === true, 'Resume B imported successfully');

    // -------------------------------------------------------------
    // Step 4: Confirm profile contains ONLY Person B's extracted information
    // -------------------------------------------------------------
    log('--- Step 4: Confirm profile contains only Person B data ---');
    const profileB = loadProfile(testDataDir);
    assert(isMinimalProfile(profileB), 'Profile B matches MinimalProfile schema');
    assert(profileB.user_info.first_name === 'Bella', 'Person B first_name is Bella');
    assert(profileB.user_info.last_name === 'Brooks', 'Person B last_name is Brooks');
    assert(profileB.user_info.email === 'bella.brooks@example.com', 'Person B email is bella.brooks@example.com');
    assert(profileB.user_info.phone_number.includes('206-555-0188') || profileB.user_info.phone_number.includes('2065550188'), 'Person B phone matches');
    assert(profileB.user_info.city === 'Seattle', 'Person B city is Seattle');
    assert(profileB.experience.length === 1, `Person B has exactly 1 experience entry (found ${profileB.experience.length})`);
    assert(profileB.experience[0].company === 'Acme Cloud', 'Person B company is Acme Cloud');
    assert(profileB.professional.skills.includes('Go'), 'Person B has Go skill');
    assert(profileB.professional.skills.includes('Rust'), 'Person B has Rust skill');

    // -------------------------------------------------------------
    // Step 5: Confirm NO Person A data remains unless in Resume B
    // -------------------------------------------------------------
    log('--- Step 5: Confirm NO Person A records remain ---');
    assert(profileB.user_info.first_name !== 'Alexander', 'Person A first_name does NOT remain');
    assert(profileB.user_info.last_name !== 'Armstrong', 'Person A last_name does NOT remain');
    assert(!profileB.professional.skills.includes('TypeScript'), 'Person A skill "TypeScript" does NOT remain');
    assert(!profileB.professional.skills.includes('Kubernetes'), 'Person A skill "Kubernetes" does NOT remain');
    assert(!profileB.professional.skills.includes('Python'), 'Person A skill "Python" does NOT remain');
    assert(!profileB.experience.some((e) => e.company === 'TechCorp'), 'Person A company "TechCorp" does NOT remain');
    assert(!profileB.experience.some((e) => e.company === 'NextGen Systems'), 'Person A company "NextGen Systems" does NOT remain');
    assert(!profileB.education.some((e) => e.school.includes('Stanford')), 'Person A education "Stanford" does NOT remain');
    assert(!profileB.social_media.linkedin_profile.includes('alexander'), 'Person A LinkedIn does NOT remain');
    assert(!profileB.social_media.github_link.includes('alexander'), 'Person A GitHub does NOT remain');

    // -------------------------------------------------------------
    // Step 6: Confirm missing fields use empty schema defaults ("", [], null)
    // -------------------------------------------------------------
    log('--- Step 6: Confirm missing fields use empty defaults ---');
    assert(Array.isArray(profileB.education) && profileB.education.length === 0, 'Missing education is []');
    assert(Array.isArray(profileB.professional.projects) && profileB.professional.projects.length === 0, 'Missing projects is []');
    assert(Array.isArray(profileB.professional.certificates) && profileB.professional.certificates.length === 0, 'Missing certificates is []');
    assert(profileB.social_media.linkedin_profile === '', 'Missing linkedin_profile is ""');
    assert(profileB.social_media.github_link === '', 'Missing github_link is ""');
    assert(profileB.social_media.portfolio_link === '', 'Missing portfolio_link is ""');
    assert(profileB.user_info.middle_name === '', 'Missing middle_name is ""');
    assert(profileB.user_info.street_address === '', 'Missing street_address is ""');
    assert(profileB.user_info.zip_code === '', 'Missing zip_code is ""');
    assert(profileB.work_preference.expected_annual_salary_lpa === null, 'expected_annual_salary_lpa is null');
    assert(profileB.work_preference.current_annual_salary === null, 'current_annual_salary is null');

    // -------------------------------------------------------------
    // Step 7: Confirm only one master resume remains in data/resumes/
    // -------------------------------------------------------------
    log('--- Step 7: Confirm only one master resume remains in data/resumes/ ---');
    const resumeFiles = fs.readdirSync(locations.resumesDir);
    assert(resumeFiles.length === 1, `Exactly one master resume in data/resumes/ (Found: ${resumeFiles.join(', ')})`);
    assert(resumeFiles[0] === 'master-resume.docx', 'Master resume file is master-resume.docx');
    const status = getMasterResumeStatus(testDataDir);
    assert(status.exists === true, 'Status indicates master resume exists');
    assert(status.filename === 'master-resume.docx', 'Status filename is master-resume.docx');

    // -------------------------------------------------------------
    // Step 8: Restart simulation: verify persisted profile and master resume
    // -------------------------------------------------------------
    log('--- Step 8: Confirm persistence across application restart ---');
    const reloadedProfile = loadProfile(testDataDir);
    const reloadedStatus = getMasterResumeStatus(testDataDir);
    assert(reloadedProfile.user_info.first_name === 'Bella', 'Persisted first name is Bella');
    assert(reloadedProfile.experience.length === 1, 'Persisted experience count is 1');
    assert(reloadedStatus.exists === true && reloadedStatus.filename === 'master-resume.docx', 'Persisted master resume is master-resume.docx');

    // -------------------------------------------------------------
    // Step 9: Test invalid / unreadable resume preserves existing resume and profile
    // -------------------------------------------------------------
    log('--- Step 9: Test invalid resume does not corrupt existing data ---');
    const corruptBuffer = Buffer.from('NOT_A_VALID_DOCX_OR_PDF_CORRUPT_BYTES');
    let threwError = false;
    try {
      await importResumeBuffer('bad_file.docx', corruptBuffer, testDataDir);
    } catch {
      threwError = true;
    }
    assert(threwError === true, 'Corrupt resume upload threw an error');

    // Check that existing profile and resume remain untouched
    const untouchedProfile = loadProfile(testDataDir);
    const untouchedStatus = getMasterResumeStatus(testDataDir);
    const resumeFilesAfterBad = fs.readdirSync(locations.resumesDir);

    assert(untouchedProfile.user_info.first_name === 'Bella', 'Profile still belongs to Bella after failed upload');
    assert(untouchedStatus.filename === 'master-resume.docx', 'Master resume is still master-resume.docx after failed upload');
    assert(
      resumeFilesAfterBad.length === 1 && resumeFilesAfterBad[0] === 'master-resume.docx',
      'No temporary or corrupt files left behind in data/resumes/'
    );

    log('🎉 All replacement scenario verification checks passed perfectly!');
  } finally {
    // Restore original master resume if backed up
    if (originalMasterBackup && originalMasterName) {
      log('Restoring original master resume...');
      const target = path.join(locations.resumesDir, originalMasterName);
      // clean resumes dir
      for (const f of fs.readdirSync(locations.resumesDir)) {
        fs.unlinkSync(path.join(locations.resumesDir, f));
      }
      fs.writeFileSync(target, originalMasterBackup);
      // re-import original master resume to restore original profile
      await importResumeBuffer(originalMasterName, originalMasterBackup, testDataDir);
      log('Original master resume and profile restored.');
    }
  }

  app.quit();
}

app.whenReady().then(runReplacementTests).catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
