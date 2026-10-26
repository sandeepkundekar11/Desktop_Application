import path from 'node:path';
import { getActiveStorageRoot } from './storageRootResolver.js';

export interface TargetStorageLocations {
  readonly root: string;
  readonly profileDir: string;
  readonly profileFile: string;
  readonly resumesDir: string;
  readonly masterResumePdf: string;
  readonly masterResumeDocx: string;
  readonly connectorsDir: string;
  readonly connectorsFile: string;
}

export const getTargetStorageLocations = (overrideRoot?: string): TargetStorageLocations => {
  const root = overrideRoot ? path.resolve(overrideRoot) : getActiveStorageRoot();

  return {
    root,
    profileDir: path.join(root, 'profile'),
    profileFile: path.join(root, 'profile', 'profile.json'),
    resumesDir: path.join(root, 'resumes'),
    masterResumePdf: path.join(root, 'resumes', 'master-resume.pdf'),
    masterResumeDocx: path.join(root, 'resumes', 'master-resume.docx'),
    connectorsDir: path.join(root, 'connectors'),
    connectorsFile: path.join(root, 'connectors', 'connectors.json'),
  };
};

