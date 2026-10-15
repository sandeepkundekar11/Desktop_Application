import fs from 'node:fs';
import path from 'node:path';
import { StorageArea } from './types.js';
import { resolveStorageAreaPath, ensureDirectoryExists } from './paths.js';

const SAFE_FILENAME_REGEX = /^[a-zA-Z0-9_\-\.]+$/;

export const validateFileName = (fileName: string): string => {
  const trimmed = fileName.trim();
  if (!trimmed || !SAFE_FILENAME_REGEX.test(trimmed) || trimmed === '.' || trimmed === '..') {
    throw new Error(`Invalid file name: "${fileName}". Must contain only alphanumeric characters, dashes, underscores, or dots.`);
  }
  return trimmed;
};

export const saveStorageFile = (
  area: StorageArea,
  fileName: string,
  content: string | Buffer,
  overwrite: boolean = false
): string => {
  const safeName = validateFileName(fileName);
  const targetDir = resolveStorageAreaPath(area);
  ensureDirectoryExists(targetDir);

  const destinationPath = path.join(targetDir, safeName);

  if (fs.existsSync(destinationPath) && !overwrite) {
    throw new Error(`File already exists: "${safeName}". Overwrite flag must be explicitly enabled.`);
  }

  fs.writeFileSync(destinationPath, content);
  return destinationPath;
};

export const readStorageFile = (area: StorageArea, fileName: string): Buffer => {
  const safeName = validateFileName(fileName);
  const targetDir = resolveStorageAreaPath(area);
  const targetPath = path.join(targetDir, safeName);

  if (!fs.existsSync(targetPath)) {
    throw new Error(`File not found: "${safeName}" in ${area}`);
  }

  return fs.readFileSync(targetPath);
};

export const storageFileExists = (area: StorageArea, fileName: string): boolean => {
  const safeName = validateFileName(fileName);
  const targetDir = resolveStorageAreaPath(area);
  const targetPath = path.join(targetDir, safeName);
  return fs.existsSync(targetPath);
};

export const listStorageFiles = (area: StorageArea): readonly string[] => {
  const targetDir = resolveStorageAreaPath(area);
  if (!fs.existsSync(targetDir)) {
    return [];
  }
  return fs.readdirSync(targetDir);
};
