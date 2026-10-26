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
  readonly dataRoot?: string;
  readonly storageMode?: string;
}

export interface ApplyPilotStorageAPI {
  readonly getStatus: () => Promise<StorageStatus>;
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
  readonly profile?: unknown;
  readonly originalFilename?: string;
  readonly masterResumeUrl?: string;
}

export interface ApplyPilotResumeAPI {
  readonly selectAndImport: () => Promise<ImportResumeResult>;
  readonly getMasterStatus: () => Promise<MasterResumeStatus>;
}

export interface ApplyPilotProfileAPI {
  readonly get: () => Promise<unknown>;
  readonly save: (profile: unknown) => Promise<boolean>;
  readonly merge: (profile: unknown) => Promise<unknown>;
}

export interface ConnectorSettings {
  readonly locationPreference: string;
  readonly refreshIntervalHours: number;
  readonly fetchLimit: number;
  readonly workplaceType?: string;
  readonly targetKeywords?: readonly string[];
  readonly easyApplyOnly?: boolean;
}

export interface ConnectorConfig {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly isEnabled: boolean;
  readonly state?: string;
  readonly implementationStatus: string;
  readonly connectionStatus: string;
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
    id: string,
    updates: { isEnabled?: boolean; settings?: Partial<ConnectorSettings> }
  ) => Promise<ConnectorsFileSchema>;
  readonly testConnection: (id: string) => Promise<ConnectorConfig>;
}

export interface ApplyPilotAPI {
  readonly getAppInfo: () => AppInfo;
  readonly storage: ApplyPilotStorageAPI;
  readonly resume: ApplyPilotResumeAPI;
  readonly profile: ApplyPilotProfileAPI;
  readonly connectors: ApplyPilotConnectorsAPI;
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
  },
  resume: {
    selectAndImport: (): Promise<ImportResumeResult> =>
      ipcRenderer.invoke('resume:select-and-import'),
    getMasterStatus: (): Promise<MasterResumeStatus> =>
      ipcRenderer.invoke('resume:get-master-status'),
  },
  profile: {
    get: (): Promise<unknown> => ipcRenderer.invoke('profile:get'),
    save: (profile: unknown): Promise<boolean> => ipcRenderer.invoke('profile:save', profile),
    merge: (profile: unknown): Promise<unknown> => ipcRenderer.invoke('profile:merge', profile),
  },
  connectors: {
    getAll: (): Promise<ConnectorsFileSchema> => ipcRenderer.invoke('connectors:get-all'),
    update: (
      id: string,
      updates: { isEnabled?: boolean; settings?: Partial<ConnectorSettings> }
    ): Promise<ConnectorsFileSchema> =>
      ipcRenderer.invoke('connectors:update', { id, ...updates }),
    testConnection: (id: string): Promise<ConnectorConfig> =>
      ipcRenderer.invoke('connectors:test-connection', { id }),
  },
};

contextBridge.exposeInMainWorld('applyPilotAPI', safeApi);
