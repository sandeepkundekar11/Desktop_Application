import fs from 'node:fs';
import { ipcMain } from 'electron';
import { StorageStatus } from '../storage/types.js';
import { resolveStorageRoot } from '../storage/storageRootResolver.js';
import { getTargetStorageLocations } from '../storage/targetStorageLocations.js';

export const IPC_CHANNELS = {
  GET_STATUS: 'storage:get-status',
} as const;

export const getJsonStorageStatus = (overrideRoot?: string): StorageStatus => {
  const resolution = resolveStorageRoot();
  const root = overrideRoot || resolution.root;
  const locations = getTargetStorageLocations(root);
  const isInitialized = fs.existsSync(locations.profileFile);

  return {
    isInitialized,
    databasePath: 'portable-json',
    schemaVersion: 1,
    dataRoot: root,
    storageMode: resolution.mode,
  };
};

export const registerStorageIpcHandlers = (): void => {
  ipcMain.handle(IPC_CHANNELS.GET_STATUS, async (): Promise<StorageStatus> => {
    return getJsonStorageStatus();
  });
};
