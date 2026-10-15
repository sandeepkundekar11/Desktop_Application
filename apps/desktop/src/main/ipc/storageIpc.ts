import { ipcMain } from 'electron';
import {
  isAllowlistedSettingKey,
  StorageStatus,
  StorageVerificationResult,
} from '../storage/types.js';
import {
  getAppSetting,
  setAppSetting,
  getStorageStatus,
} from '../storage/database.js';

export const IPC_CHANNELS = {
  GET_STATUS: 'storage:get-status',
  GET_SETTING: 'storage:get-setting',
  SET_SETTING: 'storage:set-setting',
  VERIFY_STORAGE: 'storage:verify',
} as const;

export const registerStorageIpcHandlers = (): void => {
  // Read storage status
  ipcMain.handle(IPC_CHANNELS.GET_STATUS, async (): Promise<StorageStatus> => {
    return getStorageStatus();
  });

  // Read allowlisted setting
  ipcMain.handle(
    IPC_CHANNELS.GET_SETTING,
    async (_event, key: unknown): Promise<string | null> => {
      if (!isAllowlistedSettingKey(key)) {
        throw new Error(`Unauthorized or un-allowlisted setting key: "${String(key)}"`);
      }
      return getAppSetting(key);
    }
  );

  // Save allowlisted setting
  ipcMain.handle(
    IPC_CHANNELS.SET_SETTING,
    async (_event, key: unknown, value: unknown): Promise<boolean> => {
      if (!isAllowlistedSettingKey(key)) {
        throw new Error(`Unauthorized or un-allowlisted setting key: "${String(key)}"`);
      }
      if (typeof value !== 'string') {
        throw new Error('Setting value must be a string');
      }
      if (value.length > 32768) {
        throw new Error('Setting value exceeds maximum allowed size (32KB)');
      }

      setAppSetting(key, value);
      return true;
    }
  );

  // Run end-to-end storage persistence verification
  ipcMain.handle(
    IPC_CHANNELS.VERIFY_STORAGE,
    async (): Promise<StorageVerificationResult> => {
      const testKey = 'test_setting';
      const testValue = `verified_${Date.now()}`;

      // 1. Write
      setAppSetting(testKey, testValue);

      // 2. Read back
      const readBack = getAppSetting(testKey);

      if (readBack !== testValue) {
        return {
          success: false,
          message: 'Verification failed: Value read does not match written value',
          testKey,
          testValue,
          retrievedValue: readBack,
        };
      }

      return {
        success: true,
        message: 'SQLite persistence verified successfully',
        testKey,
        testValue,
        retrievedValue: readBack,
      };
    }
  );
};
