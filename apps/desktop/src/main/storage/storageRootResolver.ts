import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type StorageMode = 'portable' | 'development' | 'installed' | 'custom';

export interface StorageRootResolution {
  readonly root: string;
  readonly mode: StorageMode;
  readonly isWritable: boolean;
  readonly warning: string | null;
}

let customDataRoot: string | null = null;
let hasLoggedDiagnostics = false;

export const setCustomDataRoot = (newRoot: string | null): void => {
  customDataRoot = newRoot;
};

export const findProjectRoot = (startDir: string): string | null => {
  let current = path.resolve(startDir);
  while (true) {
    const pkgPath = path.join(current, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const raw = fs.readFileSync(pkgPath, 'utf8');
        const parsed = JSON.parse(raw) as { name?: string; workspaces?: unknown };
        if (
          parsed.name === 'applypilot' ||
          (Array.isArray(parsed.workspaces) && fs.existsSync(path.join(current, 'apps', 'desktop')))
        ) {
          return current;
        }
      } catch {
        // Continue traversing parent directories on parse failure
      }
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return null;
};

const testDirectoryWritability = (dirPath: string): boolean => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    const testFile = path.join(dirPath, `.write_test_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    return true;
  } catch {
    return false;
  }
};

export const resolveStorageRoot = (): StorageRootResolution => {
  // 1. In-memory custom override (for tests or explicit runtime configuration)
  if (customDataRoot) {
    const isWritable = testDirectoryWritability(customDataRoot);
    return {
      root: path.resolve(customDataRoot),
      mode: 'custom',
      isWritable,
      warning: isWritable ? null : `Configured custom storage root is not writable: "${customDataRoot}"`,
    };
  }

  // 2. Explicit environment variable override
  if (process.env.APPLYPILOT_DATA_ROOT) {
    const envRoot = path.resolve(process.env.APPLYPILOT_DATA_ROOT);
    const isWritable = testDirectoryWritability(envRoot);
    return {
      root: envRoot,
      mode: 'custom',
      isWritable,
      warning: isWritable ? null : `Environment override APPLYPILOT_DATA_ROOT is not writable: "${envRoot}"`,
    };
  }

  const isPackaged = Boolean(app && app.isPackaged);

  // 3. Packaged Mode: Sibling 'data' directory beside executable (e.g. ApplyPilot/data beside ApplyPilot.exe)
  if (isPackaged) {
    const exeDir = path.dirname(process.execPath);
    const portableData = path.join(exeDir, 'data');
    const isWritable = testDirectoryWritability(portableData);

    if (isWritable) {
      return {
        root: portableData,
        mode: 'portable',
        isWritable: true,
        warning: null,
      };
    }

    const fallbackDir = app && typeof app.getPath === 'function'
      ? app.getPath('userData')
      : path.resolve(process.cwd(), '.applypilot-data');

    return {
      root: fallbackDir,
      mode: 'installed',
      isWritable: testDirectoryWritability(fallbackDir),
      warning: `Portable directory beside executable "${portableData}" is not writable. Falling back to persistent user-data directory at "${fallbackDir}".`,
    };
  }

  // 4. Development Mode: Sibling 'data' directory inside project root (Desktop_Application/data)
  let projectRoot = process.env.APPLYPILOT_PROJECT_ROOT
    ? findProjectRoot(process.env.APPLYPILOT_PROJECT_ROOT) || path.resolve(process.env.APPLYPILOT_PROJECT_ROOT)
    : null;

  if (!projectRoot) {
    projectRoot = findProjectRoot(__dirname);
  }

  if (!projectRoot) {
    projectRoot = findProjectRoot(process.cwd()) || path.resolve(process.cwd());
  }

  const devDataDir = path.join(projectRoot, 'data');
  const isWritable = testDirectoryWritability(devDataDir);

  if (isWritable) {
    return {
      root: devDataDir,
      mode: 'development',
      isWritable: true,
      warning: null,
    };
  }

  const fallbackDir = app && typeof app.getPath === 'function'
    ? app.getPath('userData')
    : path.resolve(projectRoot, '.applypilot-data');

  return {
    root: fallbackDir,
    mode: 'installed',
    isWritable: testDirectoryWritability(fallbackDir),
    warning: `Development data directory "${devDataDir}" is not writable. Falling back to "${fallbackDir}".`,
  };
};

export const getActiveStorageRoot = (): string => {
  return resolveStorageRoot().root;
};

export const logStorageDiagnostics = (resolution: StorageRootResolution): void => {
  if (!hasLoggedDiagnostics) {
    hasLoggedDiagnostics = true;
    console.log(
      `[StorageResolver] Storage root resolved: "${resolution.root}" (mode: ${resolution.mode}, writable: ${resolution.isWritable})`
    );
    if (resolution.warning) {
      console.warn(`[StorageResolver] WARNING: ${resolution.warning}`);
    }
  }
};
