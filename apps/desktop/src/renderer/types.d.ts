export interface AppInfo {
  readonly name: string;
  readonly version: string;
  readonly isInitialized: boolean;
  readonly environment: 'development' | 'production';
}

export interface StorageStatus {
  readonly isInitialized: boolean;
  readonly databasePath: string;
  readonly schemaVersion: number;
}

export interface StorageVerificationResult {
  readonly success: boolean;
  readonly message: string;
  readonly testKey: string;
  readonly testValue: string;
  readonly retrievedValue: string | null;
}

export interface ApplyPilotStorageAPI {
  readonly getStatus: () => Promise<StorageStatus>;
  readonly saveSetting: (key: string, value: string) => Promise<boolean>;
  readonly getSetting: (key: string) => Promise<string | null>;
  readonly verify: () => Promise<StorageVerificationResult>;
}

export interface ResumeMetadata {
  readonly id: string;
  readonly originalFilename: string;
  readonly fileFormat: 'pdf' | 'docx';
  readonly fileSize: number;
  readonly createdAt: string;
  readonly characterCount: number;
  readonly wordCount: number;
  readonly preview: string;
}

export interface ImportResumeResult {
  readonly success: boolean;
  readonly isDuplicate?: boolean;
  readonly metadata?: ResumeMetadata;
  readonly extractedText?: string;
  readonly error?: string;
}

export interface ApplyPilotResumeAPI {
  readonly selectAndImport: () => Promise<ImportResumeResult>;
  readonly list: () => Promise<readonly ResumeMetadata[]>;
  readonly getExtractedText: (id: string) => Promise<{ id: string; extractedText: string } | null>;
}

export interface ApplyPilotAPI {
  readonly getAppInfo: () => AppInfo;
  readonly storage: ApplyPilotStorageAPI;
  readonly resume: ApplyPilotResumeAPI;
}

declare global {
  interface Window {
    readonly applyPilotAPI?: ApplyPilotAPI;
  }
}
