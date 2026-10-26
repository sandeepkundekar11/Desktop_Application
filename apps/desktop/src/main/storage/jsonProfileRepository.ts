import { getTargetStorageLocations } from './targetStorageLocations.js';
import { readJsonSafe, writeJsonAtomic } from './atomicFileWriter.js';
import {
  MinimalProfile,
  createDefaultProfile,
  isMinimalProfile,
  EmploymentRecord,
  EducationRecord,
  ProjectRecord,
} from './minimalProfileSchema.js';

export interface ProfileMergeResult {
  readonly merged: MinimalProfile;
  readonly conflicts: readonly string[];
}

export const loadProfile = (overrideRoot?: string): MinimalProfile => {
  const locations = getTargetStorageLocations(overrideRoot);
  const data = readJsonSafe<unknown>(locations.profileFile, null);
  if (isMinimalProfile(data)) {
    return data;
  }
  return createDefaultProfile();
};

export const saveProfile = (
  profile: MinimalProfile,
  overrideRoot?: string
): void => {
  const locations = getTargetStorageLocations(overrideRoot);
  writeJsonAtomic(locations.profileFile, profile);
};

export const mergeProfile = (
  existing: MinimalProfile,
  extracted: MinimalProfile,
  overrideRoot?: string
): ProfileMergeResult => {
  const conflicts: string[] = [];

  const mergeScalar = (ex: string, ext: string, fieldName: string): string => {
    if (ex && ex.trim().length > 0) {
      if (ext && ext.trim().length > 0 && ext.trim() !== ex.trim()) {
        conflicts.push(fieldName);
      }
      return ex;
    }
    return ext || '';
  };

  const merged: MinimalProfile = {
    user_info: {
      first_name: mergeScalar(existing.user_info.first_name, extracted.user_info.first_name, 'first_name'),
      last_name: mergeScalar(existing.user_info.last_name, extracted.user_info.last_name, 'last_name'),
      middle_name: mergeScalar(existing.user_info.middle_name, extracted.user_info.middle_name, 'middle_name'),
      email: mergeScalar(existing.user_info.email, extracted.user_info.email, 'email'),
      country_code: mergeScalar(existing.user_info.country_code, extracted.user_info.country_code, 'country_code'),
      phone_number: mergeScalar(existing.user_info.phone_number, extracted.user_info.phone_number, 'phone_number'),
      country: mergeScalar(existing.user_info.country, extracted.user_info.country, 'country'),
      state: mergeScalar(existing.user_info.state, extracted.user_info.state, 'state'),
      city: mergeScalar(existing.user_info.city, extracted.user_info.city, 'city'),
      street_address: mergeScalar(existing.user_info.street_address, extracted.user_info.street_address, 'street_address'),
      zip_code: mergeScalar(existing.user_info.zip_code, extracted.user_info.zip_code, 'zip_code'),
      language: existing.user_info.language.length > 0 ? existing.user_info.language : extracted.user_info.language,
    },
    professional: {
      professional_heading: mergeScalar(
        existing.professional.professional_heading,
        extracted.professional.professional_heading,
        'professional_heading'
      ),
      professional_summary: mergeScalar(
        existing.professional.professional_summary,
        extracted.professional.professional_summary,
        'professional_summary'
      ),
      experience: mergeScalar(
        existing.professional.experience,
        extracted.professional.experience,
        'experience_summary'
      ),
      skills: Array.from(new Set([...existing.professional.skills, ...extracted.professional.skills])),
      certificates: Array.from(new Set([...existing.professional.certificates, ...extracted.professional.certificates])),
      projects: mergeProjects(existing.professional.projects, extracted.professional.projects),
    },
    education: mergeEducation(existing.education, extracted.education),
    experience: mergeExperience(existing.experience, extracted.experience),
    resume: {
      master_resume_url: extracted.resume.master_resume_url || existing.resume.master_resume_url || '',
    },
    work_preference: {
      expected_annual_salary_lpa:
        existing.work_preference.expected_annual_salary_lpa ?? extracted.work_preference.expected_annual_salary_lpa,
      current_annual_salary:
        existing.work_preference.current_annual_salary ?? extracted.work_preference.current_annual_salary,
      currency: mergeScalar(existing.work_preference.currency, extracted.work_preference.currency, 'currency'),
      nationality: mergeScalar(existing.work_preference.nationality, extracted.work_preference.nationality, 'nationality'),
      notice_period: mergeScalar(existing.work_preference.notice_period, extracted.work_preference.notice_period, 'notice_period'),
      preferred_job_titles: Array.from(
        new Set([...existing.work_preference.preferred_job_titles, ...extracted.work_preference.preferred_job_titles])
      ),
      preferred_locations: Array.from(
        new Set([...existing.work_preference.preferred_locations, ...extracted.work_preference.preferred_locations])
      ),
    },
    social_media: {
      linkedin_profile: mergeScalar(existing.social_media.linkedin_profile, extracted.social_media.linkedin_profile, 'linkedin_profile'),
      github_link: mergeScalar(existing.social_media.github_link, extracted.social_media.github_link, 'github_link'),
      portfolio_link: mergeScalar(existing.social_media.portfolio_link, extracted.social_media.portfolio_link, 'portfolio_link'),
    },
  };

  saveProfile(merged, overrideRoot);
  return { merged, conflicts };
};

const mergeExperience = (
  existing: readonly EmploymentRecord[],
  extracted: readonly EmploymentRecord[]
): EmploymentRecord[] => {
  const merged: EmploymentRecord[] = [...existing];
  const keys = new Set(existing.map((e) => `${e.company.toLowerCase().trim()}:${e.job_title.toLowerCase().trim()}`));

  for (const exp of extracted) {
    const key = `${exp.company.toLowerCase().trim()}:${exp.job_title.toLowerCase().trim()}`;
    if (!keys.has(key)) {
      merged.push({ ...exp });
      keys.add(key);
    }
  }
  return merged;
};

const mergeEducation = (
  existing: readonly EducationRecord[],
  extracted: readonly EducationRecord[]
): EducationRecord[] => {
  const merged: EducationRecord[] = [...existing];
  const keys = new Set(existing.map((e) => `${e.school.toLowerCase().trim()}:${e.degree.toLowerCase().trim()}`));

  for (const edu of extracted) {
    const key = `${edu.school.toLowerCase().trim()}:${edu.degree.toLowerCase().trim()}`;
    if (!keys.has(key)) {
      merged.push({ ...edu });
      keys.add(key);
    }
  }
  return merged;
};

const mergeProjects = (
  existing: readonly ProjectRecord[],
  extracted: readonly ProjectRecord[]
): ProjectRecord[] => {
  const merged: ProjectRecord[] = [...existing];
  const keys = new Set(existing.map((p) => p.name.toLowerCase().trim()));

  for (const proj of extracted) {
    const key = proj.name.toLowerCase().trim();
    if (key && !keys.has(key)) {
      merged.push({ ...proj });
      keys.add(key);
    }
  }
  return merged;
};
