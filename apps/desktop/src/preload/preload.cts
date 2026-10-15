import { contextBridge, ipcRenderer } from 'electron';

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

const safeApi: ApplyPilotAPI = {
  getAppInfo: (): AppInfo => ({
    name: 'ApplyPilot',
    version: '0.1.0',
    isInitialized: true,
    environment: process.env.NODE_ENV === 'development' ? 'development' : 'production',
  }),
  storage: {
    getStatus: (): Promise<StorageStatus> => ipcRenderer.invoke('storage:get-status'),
    saveSetting: (key: string, value: string): Promise<boolean> =>
      ipcRenderer.invoke('storage:set-setting', key, value),
    getSetting: (key: string): Promise<string | null> =>
      ipcRenderer.invoke('storage:get-setting', key),
    verify: (): Promise<StorageVerificationResult> =>
      ipcRenderer.invoke('storage:verify'),
  },
};

// Expose safe, restricted bridge adhering strictly to security defaults
contextBridge.exposeInMainWorld('applyPilotAPI', safeApi);
