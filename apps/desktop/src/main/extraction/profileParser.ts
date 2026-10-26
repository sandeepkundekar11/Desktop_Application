import { extractContactInfo } from './contactParser.js';
import { splitResumeSections } from './sectionParser.js';
import { parseWorkExperiences, parseEducationRecords } from './experienceParser.js';
import { parseProjects } from './projectParser.js';
import { parseCertificates } from './certificationParser.js';
import {
  MinimalProfile,
  createDefaultProfile,
} from '../storage/minimalProfileSchema.js';

export interface ProfileExtractionResult {
  readonly profile: MinimalProfile;
  readonly confidenceScore: number;
  readonly fieldsExtracted: readonly string[];
  readonly missingFields: readonly string[];
}

const COMMON_SKILLS = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin',
  'React', 'Next.js', 'Vue.js', 'Angular', 'Node.js', 'Express', 'Django', 'Flask', 'Spring Boot', '.NET',
  'SQL', 'PostgreSQL', 'MySQL', 'SQLite', 'MongoDB', 'Redis', 'GraphQL', 'REST API', 'Electron',
  'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'CI/CD', 'Git', 'GitHub', 'Linux', 'Tailwind CSS',
  'Machine Learning', 'AI', 'NLP', 'Data Analysis', 'Agile', 'Scrum', 'HTML', 'CSS', 'Redux', 'Playwright',
];

export const extractSkills = (skillsText: string | null, fullText: string): string[] => {
  const foundSkills = new Set<string>();
  const searchSource = (skillsText ? `${skillsText}\n${fullText}` : fullText).toLowerCase();

  for (const skill of COMMON_SKILLS) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9_#+])${escaped}(?:$|[^a-zA-Z0-9_#+])`, 'i');
    if (regex.test(searchSource)) {
      foundSkills.add(skill);
    }
  }

  if (skillsText) {
    const tokens = skillsText.split(/[,•|*\n]/).map((s) => s.trim()).filter((s) => s.length > 1 && s.length < 35);
    for (const token of tokens) {
      if (!/skills|technical|experience|proficient|competencies/i.test(token)) {
        foundSkills.add(token);
      }
    }
  }

  return Array.from(foundSkills);
};

export const parseCandidateProfileFromText = (
  text: string,
  masterResumeUrl: string = ''
): ProfileExtractionResult => {
  const defaultProfile = createDefaultProfile();
  const contact = extractContactInfo(text);
  const sections = splitResumeSections(text);

  const skills = extractSkills(sections.skillsText, text);
  const experience = parseWorkExperiences(sections.experienceText);
  const education = parseEducationRecords(sections.educationText);
  const projects = parseProjects(sections.projectsText);
  const certificates = parseCertificates(sections.certificationsText);

  const heading = experience[0]?.job_title || '';
  const experienceSummary = experience.length > 0 ? `${experience.length} roles documented` : '';

  const fieldsExtracted: string[] = [];
  const missingFields: string[] = [];

  if (contact.name.firstName) fieldsExtracted.push('first_name'); else missingFields.push('first_name');
  if (contact.name.lastName) fieldsExtracted.push('last_name'); else missingFields.push('last_name');
  if (contact.email) fieldsExtracted.push('email'); else missingFields.push('email');
  if (contact.phone.phoneNumber) fieldsExtracted.push('phone_number'); else missingFields.push('phone_number');
  if (contact.location.city) fieldsExtracted.push('city'); else missingFields.push('city');
  if (skills.length > 0) fieldsExtracted.push('skills'); else missingFields.push('skills');
  if (experience.length > 0) fieldsExtracted.push('experience'); else missingFields.push('experience');
  if (education.length > 0) fieldsExtracted.push('education'); else missingFields.push('education');
  if (projects.length > 0) fieldsExtracted.push('projects'); else missingFields.push('projects');
  if (certificates.length > 0) fieldsExtracted.push('certificates'); else missingFields.push('certificates');

  const confidenceScore = Number(
    (fieldsExtracted.length / (fieldsExtracted.length + missingFields.length || 1)).toFixed(2)
  );

  const profile: MinimalProfile = {
    user_info: {
      first_name: contact.name.firstName,
      last_name: contact.name.lastName,
      middle_name: contact.name.middleName,
      email: contact.email,
      country_code: contact.phone.countryCode,
      phone_number: contact.phone.phoneNumber,
      country: contact.location.country,
      state: contact.location.state,
      city: contact.location.city,
      street_address: contact.location.streetAddress,
      zip_code: contact.location.zipCode,
      language: contact.languages,
    },
    professional: {
      professional_heading: heading,
      professional_summary: sections.summaryText || '',
      experience: experienceSummary,
      skills,
      certificates,
      projects,
    },
    education,
    experience,
    resume: {
      master_resume_url: masterResumeUrl,
    },
    work_preference: {
      ...defaultProfile.work_preference,
    },
    social_media: {
      linkedin_profile: contact.linkedinUrl,
      github_link: contact.githubUrl,
      portfolio_link: contact.portfolioUrl,
    },
  };

  return {
    profile,
    confidenceScore,
    fieldsExtracted,
    missingFields,
  };
};
