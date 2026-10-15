export interface AppInfo {
  readonly name: string;
  readonly version: string;
  readonly isInitialized: boolean;
  readonly environment: 'development' | 'production';
}

export interface ApplyPilotAPI {
  readonly getAppInfo: () => AppInfo;
}

declare global {
  interface Window {
    readonly applyPilotAPI?: ApplyPilotAPI;
  }
}
