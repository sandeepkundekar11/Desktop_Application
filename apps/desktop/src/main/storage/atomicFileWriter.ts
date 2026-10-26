import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// In-memory mutex map to serialize concurrent operations targeting the same file
const fileMutexMap = new Map<string, Promise<unknown>>();

export const withFileLock = async <T>(
  filePath: string,
  operation: () => Promise<T> | T
): Promise<T> => {
  const normalizedKey = path.resolve(filePath).toLowerCase();
  const previousLock = fileMutexMap.get(normalizedKey) || Promise.resolve();

  let resolveCurrent: () => void;
  const currentLock = new Promise<void>((resolve) => {
    resolveCurrent = resolve;
  });

  fileMutexMap.set(normalizedKey, currentLock);

  try {
    await previousLock;
    return await operation();
  } finally {
    resolveCurrent!();
    if (fileMutexMap.get(normalizedKey) === currentLock) {
      fileMutexMap.delete(normalizedKey);
    }
  }
};

export const writeJsonAtomic = <T>(
  filePath: string,
  data: T,
  pretty: boolean = true
): void => {
  const targetPath = path.resolve(filePath);
  const targetDir = path.dirname(targetPath);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const jsonContent = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  const tempPath = path.join(targetDir, `.${path.basename(targetPath)}.tmp.${crypto.randomUUID()}`);

  try {
    const fd = fs.openSync(tempPath, 'w');
    try {
      fs.writeSync(fd, jsonContent, 0, 'utf-8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }

    fs.renameSync(tempPath, targetPath);
  } catch (err) {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
      // Ignore cleanup error
    }
    throw new Error(`Failed to atomically write JSON to "${targetPath}": ${err instanceof Error ? err.message : String(err)}`);
  }
};

export const readJsonSafe = <T>(
  filePath: string,
  fallback: T,
  validator?: (data: unknown) => data is T
): T => {
  const targetPath = path.resolve(filePath);

  if (!fs.existsSync(targetPath)) {
    return fallback;
  }

  try {
    const content = fs.readFileSync(targetPath, 'utf-8');
    const parsed = JSON.parse(content) as unknown;

    if (validator && !validator(parsed)) {
      console.warn(`[storage] Validation warning: Content in "${targetPath}" failed schema check. Using fallback.`);
      return fallback;
    }

    return parsed as T;
  } catch (err) {
    console.warn(`[storage] Error reading JSON from "${targetPath}": ${err instanceof Error ? err.message : String(err)}. Using fallback.`);
    return fallback;
  }
};
