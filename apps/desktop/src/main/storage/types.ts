export const ALLOWLISTED_SETTING_KEYS = [
  'theme',
  'telemetry_enabled',
  'test_setting',
  'app_language',
  'default_profile_id',
] as const;

export type AllowlistedSettingKey = typeof ALLOWLISTED_SETTING_KEYS[number];

export const isAllowlistedSettingKey = (key: unknown): key is AllowlistedSettingKey => {
  return typeof key === 'string' && (ALLOWLISTED_SETTING_KEYS as readonly string[]).includes(key);
};

export type StorageArea =
  | 'resumes'
  | 'resumes_master'
  | 'resumes_original'
  | 'resumes_originals'
  | 'jobs'
  | 'applications'
  | 'documents'
  | 'exports'
  | 'backups'
  | 'logs';

export interface StorageStatus {
  readonly isInitialized: boolean;
  readonly databasePath: string;
  readonly schemaVersion: number;
  readonly dataRoot?: string;
  readonly storageMode?: string;
}

export interface StorageVerificationResult {
  readonly success: boolean;
  readonly message: string;
  readonly testKey: string;
  readonly testValue: string;
  readonly retrievedValue: string | null;
}
