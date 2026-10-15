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

export interface ApplyPilotAPI {
  readonly getAppInfo: () => AppInfo;
  readonly storage: ApplyPilotStorageAPI;
}

declare global {
  interface Window {
    readonly applyPilotAPI?: ApplyPilotAPI;
  }
}
