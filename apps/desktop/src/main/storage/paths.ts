import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { StorageArea } from './types.js';

export interface StorageLocations {
  readonly root: string;
  readonly databaseDir: string;
  readonly databasePath: string;
  readonly resumesOriginal: string;
  readonly resumesOptimized: string;
  readonly resumesTailored: string;
  readonly exports: string;
  readonly logs: string;
}

export const getStorageLocations = (): StorageLocations => {
  const root = app.getPath('userData');
  const databaseDir = path.join(root, 'database');

  return {
    root,
    databaseDir,
    databasePath: path.join(databaseDir, 'applypilot.db'),
    resumesOriginal: path.join(root, 'resumes', 'original'),
    resumesOptimized: path.join(root, 'resumes', 'optimized'),
    resumesTailored: path.join(root, 'resumes', 'tailored'),
    exports: path.join(root, 'exports'),
    logs: path.join(root, 'logs'),
  };
};

export const resolveStorageAreaPath = (area: StorageArea): string => {
  const locations = getStorageLocations();
  switch (area) {
    case 'resumes_original':
      return locations.resumesOriginal;
    case 'resumes_optimized':
      return locations.resumesOptimized;
    case 'resumes_tailored':
      return locations.resumesTailored;
    case 'exports':
      return locations.exports;
    case 'logs':
      return locations.logs;
    default:
      throw new Error(`Unsupported storage area: ${area}`);
  }
};

export const ensureDirectoryExists = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};
