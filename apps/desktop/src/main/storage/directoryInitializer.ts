import fs from 'node:fs';
import path from 'node:path';
import { getTargetStorageLocations, TargetStorageLocations } from './targetStorageLocations.js';
import { resolveStorageRoot } from './storageRootResolver.js';
import { writeJsonAtomic, readJsonSafe } from './atomicFileWriter.js';
import { createDefaultProfile, MinimalProfile, isMinimalProfile } from './minimalProfileSchema.js';
import {
  createDefaultConnectors,
  isConnectorsFileSchema,
  reconcileConnectors,
} from './connectorSchema.js';

export interface StorageInitResult {
  readonly initialized: boolean;
  readonly dataRoot: string;
  readonly storageMode: string;
  readonly createdDirectories: readonly string[];
  readonly initializedFiles: readonly string[];
}

const OBSOLETE_DIRECTORIES = [
  'ai',
  'applications',
  'automation',
  'backups',
  'database',
  'documents',
  'indexes',
  'jobs',
  'logs',
  'preferences',
  'settings',
];

const OBSOLETE_FILES = ['manifest.json'];

const cleanupObsoleteDataFolders = (locations: TargetStorageLocations): void => {
  // 1. Remove obsolete root directories
  for (const dirName of OBSOLETE_DIRECTORIES) {
    const fullPath = path.join(locations.root, dirName);
    if (fs.existsSync(fullPath)) {
      try {
        fs.rmSync(fullPath, { recursive: true, force: true });
      } catch (err) {
        console.warn(`[StorageInitializer] Could not remove obsolete directory ${fullPath}: ${String(err)}`);
      }
    }
  }

  // 2. Remove obsolete root files
  for (const fileName of OBSOLETE_FILES) {
    const fullPath = path.join(locations.root, fileName);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch {
        // ignore
      }
    }
  }

  // 3. Remove obsolete profile files in data/profile/
  const obsoleteProfileFiles = [
    'candidate-profile.json',
    'skills.json',
    'work-experiences.json',
    'education-records.json',
    'projects.json',
    'certifications.json',
    'settings.json',
    'job-preferences.json',
  ];
  for (const f of obsoleteProfileFiles) {
    const fp = path.join(locations.profileDir, f);
    if (fs.existsSync(fp)) {
      try {
        fs.unlinkSync(fp);
      } catch {
        // ignore
      }
    }
  }

  // 4. Clean up non-master resume files in data/resumes/
  if (fs.existsSync(locations.resumesDir)) {
    const entries = fs.readdirSync(locations.resumesDir);
    for (const ent of entries) {
      if (ent !== 'master-resume.pdf' && ent !== 'master-resume.docx') {
        const full = path.join(locations.resumesDir, ent);
        try {
          if (fs.statSync(full).isDirectory()) {
            fs.rmSync(full, { recursive: true, force: true });
          } else {
            // If master-resume doesn't exist yet and this is a pdf/docx, preserve as master-resume
            const hasMaster = fs.existsSync(locations.masterResumePdf) || fs.existsSync(locations.masterResumeDocx);
            if (!hasMaster && (ent.endsWith('.pdf') || ent.endsWith('.docx'))) {
              const ext = path.extname(ent);
              const dest = path.join(locations.resumesDir, `master-resume${ext}`);
              fs.copyFileSync(full, dest);
            }
            fs.unlinkSync(full);
          }
        } catch {
          // ignore
        }
      }
    }
  }

  // 5. Clean up non-connectors files in data/connectors/
  if (fs.existsSync(locations.connectorsDir)) {
    const entries = fs.readdirSync(locations.connectorsDir);
    for (const ent of entries) {
      if (ent !== 'connectors.json') {
        const full = path.join(locations.connectorsDir, ent);
        try {
          if (fs.statSync(full).isDirectory()) {
            fs.rmSync(full, { recursive: true, force: true });
          } else {
            fs.unlinkSync(full);
          }
        } catch {
          // ignore
        }
      }
    }
  }
};

export const initializeStorageHierarchy = (overrideRoot?: string): StorageInitResult => {
  const resolution = resolveStorageRoot();
  const root = overrideRoot ? path.resolve(overrideRoot) : resolution.root;
  const locations = getTargetStorageLocations(root);

  // 1. Create allowed directories
  const requiredDirs: readonly string[] = [
    locations.profileDir,
    locations.resumesDir,
    locations.connectorsDir,
  ];
  const createdDirectories: string[] = [];

  for (const dir of requiredDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      createdDirectories.push(dir);
    }
  }

  // 2. Clean up any obsolete directories/files under data/
  cleanupObsoleteDataFolders(locations);

  // 3. Initialize data/profile/profile.json if not present or corrupt
  const initializedFiles: string[] = [];
  if (!fs.existsSync(locations.profileFile)) {
    const defaultProfile = createDefaultProfile();
    // If master resume exists, set its URL
    if (fs.existsSync(locations.masterResumePdf)) {
      defaultProfile.resume.master_resume_url = 'resumes/master-resume.pdf';
    } else if (fs.existsSync(locations.masterResumeDocx)) {
      defaultProfile.resume.master_resume_url = 'resumes/master-resume.docx';
    }
    writeJsonAtomic(locations.profileFile, defaultProfile);
    initializedFiles.push(locations.profileFile);
  } else {
    // Validate existing profile
    const existing = readJsonSafe<unknown>(locations.profileFile, null);
    if (!isMinimalProfile(existing)) {
      // Reconcile and fix missing schema fields
      const defaultProfile = createDefaultProfile();
      const reconciled = {
        ...defaultProfile,
        ...(typeof existing === 'object' && existing !== null ? existing : {}),
      };
      writeJsonAtomic(locations.profileFile, reconciled);
    }
  }

  // 4. Initialize data/connectors/connectors.json if not present or corrupt
  if (!fs.existsSync(locations.connectorsFile)) {
    const defaultConnectors = createDefaultConnectors();
    writeJsonAtomic(locations.connectorsFile, defaultConnectors);
    initializedFiles.push(locations.connectorsFile);
  } else {
    const existing = readJsonSafe<unknown>(locations.connectorsFile, null);
    if (!isConnectorsFileSchema(existing)) {
      const reconciled = reconcileConnectors(existing);
      writeJsonAtomic(locations.connectorsFile, reconciled);
    }
  }

  return {
    initialized: true,
    dataRoot: root,
    storageMode: resolution.mode,
    createdDirectories,
    initializedFiles,
  };
};
