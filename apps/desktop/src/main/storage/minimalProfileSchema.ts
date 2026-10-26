export interface UserInfo {
  first_name: string;
  last_name: string;
  middle_name: string;
  email: string;
  country_code: string;
  phone_number: string;
  country: string;
  state: string;
  city: string;
  street_address: string;
  zip_code: string;
  language: string[];
}

export interface ProjectRecord {
  name: string;
  description: string;
  url: string;
}

export interface ProfessionalInfo {
  professional_heading: string;
  professional_summary: string;
  experience: string;
  skills: string[];
  certificates: string[];
  projects: ProjectRecord[];
}

export interface MonthYearDate {
  month: string;
  year: string;
}

export interface EducationRecord {
  school: string;
  degree: string;
  major: string;
  marks_cgpa: string;
  start: MonthYearDate;
  end: MonthYearDate;
  location: string;
}

export interface EmploymentRecord {
  job_title: string;
  company: string;
  location: string;
  start_date: string;
  end_date: string;
  description: string;
}

export interface ResumeInfo {
  master_resume_url: string;
}

export interface WorkPreference {
  expected_annual_salary_lpa: number | null;
  current_annual_salary: number | null;
  currency: string;
  nationality: string;
  notice_period: string;
  preferred_job_titles: string[];
  preferred_locations: string[];
}

export interface SocialMedia {
  linkedin_profile: string;
  github_link: string;
  portfolio_link: string;
}

export interface MinimalProfile {
  user_info: UserInfo;
  professional: ProfessionalInfo;
  education: EducationRecord[];
  experience: EmploymentRecord[];
  resume: ResumeInfo;
  work_preference: WorkPreference;
  social_media: SocialMedia;
}

export const createDefaultProfile = (): MinimalProfile => ({
  user_info: {
    first_name: '',
    last_name: '',
    middle_name: '',
    email: '',
    country_code: '',
    phone_number: '',
    country: '',
    state: '',
    city: '',
    street_address: '',
    zip_code: '',
    language: [],
  },
  professional: {
    professional_heading: '',
    professional_summary: '',
    experience: '',
    skills: [],
    certificates: [],
    projects: [],
  },
  education: [],
  experience: [],
  resume: {
    master_resume_url: '',
  },
  work_preference: {
    expected_annual_salary_lpa: null,
    current_annual_salary: null,
    currency: '',
    nationality: '',
    notice_period: '',
    preferred_job_titles: [],
    preferred_locations: [],
  },
  social_media: {
    linkedin_profile: '',
    github_link: '',
    portfolio_link: '',
  },
});

export const isMinimalProfile = (val: unknown): val is MinimalProfile => {
  if (!val || typeof val !== 'object') return false;
  const p = val as Record<string, unknown>;
  return (
    typeof p.user_info === 'object' &&
    p.user_info !== null &&
    typeof p.professional === 'object' &&
    p.professional !== null &&
    Array.isArray(p.education) &&
    Array.isArray(p.experience) &&
    typeof p.resume === 'object' &&
    p.resume !== null &&
    typeof p.work_preference === 'object' &&
    p.work_preference !== null &&
    typeof p.social_media === 'object' &&
    p.social_media !== null
  );
};
