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

export interface EducationStartEnd {
  month: string;
  year: string;
}

export interface EducationRecord {
  school: string;
  degree: string;
  major: string;
  marks_cgpa: string;
  start: EducationStartEnd;
  end: EducationStartEnd;
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

export interface MasterResumeStatus {
  readonly exists: boolean;
  readonly filename: string | null;
  readonly relativeUrl: string | null;
  readonly fileSize: number;
  readonly updatedAt: string | null;
}

export interface ImportResumeResult {
  readonly success: boolean;
  readonly error?: string;
  readonly profile?: MinimalProfile;
  readonly originalFilename?: string;
  readonly masterResumeUrl?: string;
}

export interface StorageStatus {
  readonly isInitialized: boolean;
  readonly databasePath: string;
  readonly schemaVersion: number;
  readonly dataRoot?: string;
  readonly storageMode?: string;
}

export interface ApplyPilotResumeAPI {
  readonly selectAndImport: () => Promise<ImportResumeResult>;
  readonly getMasterStatus: () => Promise<MasterResumeStatus>;
}

export interface ApplyPilotProfileAPI {
  readonly get: () => Promise<MinimalProfile>;
  readonly save: (profile: MinimalProfile) => Promise<boolean>;
  readonly merge: (profile: MinimalProfile) => Promise<MinimalProfile>;
}

export interface ApplyPilotStorageAPI {
  readonly getStatus: () => Promise<StorageStatus>;
}

export interface ConnectorSettings {
  readonly locationPreference: string;
  readonly refreshIntervalHours: number;
  readonly fetchLimit: number;
  readonly workplaceType?: string;
  readonly targetKeywords?: readonly string[];
  readonly easyApplyOnly?: boolean;
}

export type ConnectorId =
  | 'hiringcafe'
  | 'naukri'
  | 'indeed'
  | 'linkedin'
  | 'wellfound'
  | 'instahyre'
  | 'hirist';

export type ConnectorState =
  | 'planned'
  | 'requires_setup'
  | 'configured'
  | 'available'
  | 'connected'
  | 'unavailable';

export type ConnectorImplementationStatus =
  | 'planned'
  | 'requires_setup'
  | 'configured'
  | 'available'
  | 'unavailable';

export type ConnectorConnectionStatus =
  | 'not_tested'
  | 'not_configured'
  | 'check_unavailable'
  | 'not_connected'
  | 'connected'
  | 'error';

export interface ConnectorConfig {
  readonly id: ConnectorId;
  readonly name: string;
  readonly description: string;
  readonly isEnabled: boolean;
  readonly state: ConnectorState;
  readonly implementationStatus: ConnectorImplementationStatus;
  readonly connectionStatus: ConnectorConnectionStatus;
  readonly lastCheckedAt: string | null;
  readonly statusMessage: string;
  readonly settings: ConnectorSettings;
}

export interface ConnectorsFileSchema {
  readonly version: number;
  readonly updatedAt: string;
  readonly connectors: readonly ConnectorConfig[];
}

export interface ApplyPilotConnectorsAPI {
  readonly getAll: () => Promise<ConnectorsFileSchema>;
  readonly update: (
    id: ConnectorId,
    updates: { isEnabled?: boolean; settings?: Partial<ConnectorSettings> }
  ) => Promise<ConnectorsFileSchema>;
  readonly testConnection: (id: ConnectorId) => Promise<ConnectorConfig>;
}

export interface ApplyPilotAPI {
  readonly resume: ApplyPilotResumeAPI;
  readonly profile: ApplyPilotProfileAPI;
  readonly storage: ApplyPilotStorageAPI;
  readonly connectors: ApplyPilotConnectorsAPI;
}

declare global {
  interface Window {
    readonly applyPilotAPI?: ApplyPilotAPI;
  }
}

