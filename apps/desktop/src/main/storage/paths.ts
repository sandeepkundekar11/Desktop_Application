import path from 'node:path';
import fs from 'node:fs';
import { StorageArea } from './types.js';
import { getActiveStorageRoot, setCustomDataRoot } from './storageRootResolver.js';

export interface StorageLocations {
  readonly root: string;
  readonly databaseDir: string;
  readonly databasePath: string;
  readonly resumes: string;
  readonly jobs: string;
  readonly applications: string;
  readonly documents: string;
  readonly exports: string;
  readonly backups: string;
  readonly logs: string;
}

export const setDataRoot = (newRoot: string | null): void => {
  setCustomDataRoot(newRoot);
};

export const resolveDataRoot = (): string => {
  return getActiveStorageRoot();
};

export const getStorageLocations = (): StorageLocations => {
  const root = resolveDataRoot();
  const databaseDir = path.join(root, 'database');

  return {
    root,
    databaseDir,
    databasePath: path.join(databaseDir, 'applypilot.sqlite'),
    resumes: path.join(root, 'resumes'),
    jobs: path.join(root, 'jobs'),
    applications: path.join(root, 'applications'),
    documents: path.join(root, 'documents'),
    exports: path.join(root, 'exports'),
    backups: path.join(root, 'backups'),
    logs: path.join(root, 'logs'),
  };
};

export const resolveStorageAreaPath = (area: StorageArea): string => {
  const locations = getStorageLocations();
  switch (area) {
    case 'resumes':
    case 'resumes_master':
    case 'resumes_original':
    case 'resumes_originals':
      return locations.resumes;
    case 'jobs':
      return locations.jobs;
    case 'applications':
      return locations.applications;
    case 'documents':
      return locations.documents;
    case 'exports':
      return locations.exports;
    case 'backups':
      return locations.backups;
    case 'logs':
      return locations.logs;
    default:
      throw new Error(`Unsupported storage area: "${String(area)}"`);
  }
};

export const ensureDirectoryExists = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

export const initStorageDirectories = (): void => {
  const locations = getStorageLocations();
  ensureDirectoryExists(locations.databaseDir);
  ensureDirectoryExists(locations.resumes);
  ensureDirectoryExists(locations.jobs);
  ensureDirectoryExists(locations.applications);
  ensureDirectoryExists(locations.documents);
  ensureDirectoryExists(locations.exports);
  ensureDirectoryExists(locations.backups);
  ensureDirectoryExists(locations.logs);
};

