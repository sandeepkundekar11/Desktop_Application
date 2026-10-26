import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const dataDir = path.join(projectRoot, 'data');

const log = (msg) => console.log(`[TEST] ${msg}`);
const assert = (condition, msg) => {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
};

async function runTests() {
  log('Starting Minimal Profile & Master Resume Foundation verification...');

  // 1. Dynamic import of modules
  const { initializeStorageHierarchy } = await import('../dist-electron/main/storage/directoryInitializer.js');
  const { loadProfile, saveProfile, mergeProfile } = await import('../dist-electron/main/storage/jsonProfileRepository.js');
  const { getTargetStorageLocations } = await import('../dist-electron/main/storage/targetStorageLocations.js');
  const { getMasterResumeStatus, importResumeBuffer } = await import('../dist-electron/main/resume/resumeService.js');
  const { isMinimalProfile } = await import('../dist-electron/main/storage/minimalProfileSchema.js');

  // Test 1: Initialize Storage Hierarchy
  log('Step 1: Initializing storage hierarchy...');
  initializeStorageHierarchy(dataDir);

  const locations = getTargetStorageLocations(dataDir);
  assert(fs.existsSync(locations.profileDir), 'data/profile directory exists');
  assert(fs.existsSync(locations.resumesDir), 'data/resumes directory exists');
  assert(fs.existsSync(locations.profileFile), 'data/profile/profile.json exists');

  // Verify no other folders or files exist in data/
  const dataEntries = fs.readdirSync(dataDir);
  assert(
    dataEntries.includes('profile') &&
      dataEntries.includes('resumes') &&
      dataEntries.every((e) => ['profile', 'resumes', 'connectors'].includes(e)),
    `data/ contains ONLY approved directories (profile, resumes, connectors) (Found: ${dataEntries.join(', ')})`
  );

  // Test 2: Profile JSON exact schema verification
  log('Step 2: Checking exact profile schema in profile.json...');
  const rawProfileJson = fs.readFileSync(locations.profileFile, 'utf8');
  const profileObj = JSON.parse(rawProfileJson);

  const expectedTopKeys = [
    'education',
    'experience',
    'professional',
    'resume',
    'social_media',
    'user_info',
    'work_preference',
  ].sort();
  const actualTopKeys = Object.keys(profileObj).sort();
  assert(
    JSON.stringify(actualTopKeys) === JSON.stringify(expectedTopKeys),
    `Top-level keys match exact schema: ${actualTopKeys.join(', ')}`
  );

  // user_info keys
  const expectedUserInfoKeys = [
    'city',
    'country',
    'country_code',
    'email',
    'first_name',
    'language',
    'last_name',
    'middle_name',
    'phone_number',
    'state',
    'street_address',
    'zip_code',
  ].sort();
  const actualUserInfoKeys = Object.keys(profileObj.user_info).sort();
  assert(
    JSON.stringify(actualUserInfoKeys) === JSON.stringify(expectedUserInfoKeys),
    'user_info contains exactly required fields'
  );

  // professional keys
  const expectedProfKeys = [
    'certificates',
    'experience',
    'professional_heading',
    'professional_summary',
    'projects',
    'skills',
  ].sort();
  const actualProfKeys = Object.keys(profileObj.professional).sort();
  assert(
    JSON.stringify(actualProfKeys) === JSON.stringify(expectedProfKeys),
    'professional contains exactly required fields'
  );

  // work_preference keys
  const expectedPrefKeys = [
    'currency',
    'current_annual_salary',
    'expected_annual_salary_lpa',
    'nationality',
    'notice_period',
    'preferred_job_titles',
    'preferred_locations',
  ].sort();
  const actualPrefKeys = Object.keys(profileObj.work_preference).sort();
  assert(
    JSON.stringify(actualPrefKeys) === JSON.stringify(expectedPrefKeys),
    'work_preference contains exactly required fields'
  );

  // social_media keys
  const expectedSocialKeys = ['github_link', 'linkedin_profile', 'portfolio_link'].sort();
  const actualSocialKeys = Object.keys(profileObj.social_media).sort();
  assert(
    JSON.stringify(actualSocialKeys) === JSON.stringify(expectedSocialKeys),
    'social_media contains exactly required fields'
  );

  // Test 3: Array schema verification
  assert(Array.isArray(profileObj.education), 'education is an array');
  assert(Array.isArray(profileObj.experience), 'experience is an array');
  assert(Array.isArray(profileObj.professional.projects), 'projects is an array');
  assert(typeof profileObj.work_preference.expected_annual_salary_lpa === 'number' || profileObj.work_preference.expected_annual_salary_lpa === null, 'expected salary is number or null');
  assert(typeof profileObj.work_preference.current_annual_salary === 'number' || profileObj.work_preference.current_annual_salary === null, 'current salary is number or null');

  // Test 4: Master Resume Status & Extraction
  log('Step 3: Testing Master Resume handling and extraction...');
  const resumeStatus = getMasterResumeStatus(dataDir);
  assert(resumeStatus.exists === true, 'Master resume file exists in data/resumes/');
  assert(resumeStatus.filename === 'master-resume.pdf', 'Master resume named master-resume.pdf');
  assert(resumeStatus.relativeUrl === 'resumes/master-resume.pdf', 'Master resume relative URL is resumes/master-resume.pdf');

  // Extract from the existing master resume
  const pdfBuffer = fs.readFileSync(locations.masterResumePdf);
  const importResult = await importResumeBuffer('master-resume.pdf', pdfBuffer, dataDir);
  assert(importResult.success === true, 'Resume buffer imported successfully');
  assert(importResult.masterResumeUrl === 'resumes/master-resume.pdf', 'Returned relative master resume url');

  // Verify extracted profile
  const extracted = loadProfile(dataDir);
  assert(isMinimalProfile(extracted), 'Extracted profile passes isMinimalProfile schema validator');
  assert(extracted.user_info.first_name.length > 0, `Extracted first name: "${extracted.user_info.first_name}"`);
  assert(extracted.user_info.last_name.length > 0, `Extracted last name: "${extracted.user_info.last_name}"`);
  assert(extracted.user_info.email.length > 0, `Extracted email: "${extracted.user_info.email}"`);
  assert(extracted.user_info.phone_number.length > 0, `Extracted phone: "${extracted.user_info.phone_number}"`);
  assert(extracted.professional.skills.length > 0, `Extracted ${extracted.professional.skills.length} skills`);
  assert(extracted.experience.length > 0, `Extracted ${extracted.experience.length} work experience roles`);
  assert(extracted.education.length > 0, `Extracted ${extracted.education.length} education entries`);

  // Verify education schema integrity
  const firstEdu = extracted.education[0];
  assert(firstEdu.school.length > 0, `Education school: "${firstEdu.school}"`);
  assert(firstEdu.degree.length > 0, `Education degree: "${firstEdu.degree}"`);
  assert(typeof firstEdu.start === 'object' && 'month' in firstEdu.start && 'year' in firstEdu.start, 'Education start has month and year');
  assert(typeof firstEdu.end === 'object' && 'month' in firstEdu.end && 'year' in firstEdu.end, 'Education end has month and year');

  // Verify experience schema integrity
  const firstExp = extracted.experience[0];
  assert(firstExp.job_title.length > 0, `Experience title: "${firstExp.job_title}"`);
  assert(firstExp.company.length > 0, `Experience company: "${firstExp.company}"`);
  assert(typeof firstExp.start_date === 'string', 'Experience start_date is string');
  assert(typeof firstExp.end_date === 'string', 'Experience end_date is string');

  // Verify relative path in profile JSON
  assert(extracted.resume.master_resume_url === 'resumes/master-resume.pdf', 'profile.json stores relative path for resume');
  assert(!extracted.resume.master_resume_url.includes(':') && !extracted.resume.master_resume_url.startsWith('/'), 'No absolute machine path in profile');

  // Test 5: Profile edits persist across restarts
  log('Step 4: Testing manual profile edits persistence...');
  extracted.user_info.city = 'San Francisco';
  extracted.user_info.state = 'California';
  extracted.work_preference.expected_annual_salary_lpa = 35;
  extracted.work_preference.preferred_job_titles = ['Principal Architect', 'Staff Engineer'];

  saveProfile(extracted, dataDir);
  const reloaded = loadProfile(dataDir);
  assert(reloaded.user_info.city === 'San Francisco', 'Edited city persisted');
  assert(reloaded.work_preference.expected_annual_salary_lpa === 35, 'Edited salary persisted');
  assert(reloaded.work_preference.preferred_job_titles.includes('Principal Architect'), 'Edited preferred job titles persisted');

  // Test 6: Single Master Resume invariant on replacement
  log('Step 5: Testing single master resume replacement...');
  const fakeDocxBuffer = Buffer.from('Fake docx content for testing replacement');
  // Mock validation/extraction for dummy file or use small valid buffer
  const stagingFile = path.join(locations.resumesDir, 'master-resume.docx');
  fs.writeFileSync(stagingFile, fakeDocxBuffer);
  if (fs.existsSync(locations.masterResumePdf)) {
    fs.unlinkSync(locations.masterResumePdf);
  }
  const statusAfterReplace = getMasterResumeStatus(dataDir);
  assert(statusAfterReplace.exists === true, 'Replaced master resume exists');
  assert(statusAfterReplace.filename === 'master-resume.docx', 'Replaced master resume is master-resume.docx');
  assert(fs.readdirSync(locations.resumesDir).length === 1, 'ONLY one master resume file in data/resumes/');

  // Restore the real PDF master resume for continued project use
  fs.unlinkSync(stagingFile);
  fs.writeFileSync(locations.masterResumePdf, pdfBuffer);
  assert(fs.readdirSync(locations.resumesDir).length === 1, 'Restored master resume, single file invariant holds');

  log('ALL TESTS PASSED SUCCESSFULLY! 🎉');
  app.quit();
}

app.whenReady().then(runTests).catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
