import { contextBridge } from 'electron';

export interface AppInfo {
  readonly name: string;
  readonly version: string;
  readonly isInitialized: boolean;
  readonly environment: 'development' | 'production';
}

export interface ApplyPilotAPI {
  readonly getAppInfo: () => AppInfo;
}

const safeApi: ApplyPilotAPI = {
  getAppInfo: (): AppInfo => ({
    name: 'ApplyPilot',
    version: '0.1.0',
    isInitialized: true,
    environment: process.env.NODE_ENV === 'development' ? 'development' : 'production',
  }),
};

// Expose safe, restricted bridge adhering strictly to security defaults
contextBridge.exposeInMainWorld('applyPilotAPI', safeApi);
