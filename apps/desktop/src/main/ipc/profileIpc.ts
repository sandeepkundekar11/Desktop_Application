import { ipcMain } from 'electron';
import {
  loadProfile,
  saveProfile,
  mergeProfile,
} from '../storage/jsonProfileRepository.js';
import { MinimalProfile, isMinimalProfile } from '../storage/minimalProfileSchema.js';

export const PROFILE_IPC_CHANNELS = {
  GET: 'profile:get',
  SAVE: 'profile:save',
  MERGE: 'profile:merge',
} as const;

export const registerProfileIpcHandlers = (): void => {
  // 1. Get current candidate profile
  ipcMain.handle(PROFILE_IPC_CHANNELS.GET, async (): Promise<MinimalProfile> => {
    return loadProfile();
  });

  // 2. Save complete candidate profile
  ipcMain.handle(
    PROFILE_IPC_CHANNELS.SAVE,
    async (_event, profile: unknown): Promise<boolean> => {
      if (!isMinimalProfile(profile)) {
        throw new Error('Invalid profile schema provided');
      }
      saveProfile(profile);
      return true;
    }
  );

  // 3. Merge candidate profile
  ipcMain.handle(
    PROFILE_IPC_CHANNELS.MERGE,
    async (_event, profile: unknown): Promise<MinimalProfile> => {
      if (!isMinimalProfile(profile)) {
        throw new Error('Invalid profile payload provided for merge');
      }
      const existing = loadProfile();
      const result = mergeProfile(existing, profile);
      return result.merged;
    }
  );
};
