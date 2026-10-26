import path from 'node:path';
import fs from 'node:fs';
import { dialog, BrowserWindow } from 'electron';
import { validateResumeFile } from './fileValidator.js';
import { extractResumeText } from '../extraction/index.js';
import { parseCandidateProfileFromText } from '../extraction/profileParser.js';
import { getTargetStorageLocations } from '../storage/targetStorageLocations.js';
import { saveProfile } from '../storage/jsonProfileRepository.js';
import { MinimalProfile, isMinimalProfile } from '../storage/minimalProfileSchema.js';

export interface ImportResumeResult {
  readonly success: boolean;
  readonly error?: string;
  readonly profile?: MinimalProfile;
  readonly originalFilename?: string;
  readonly masterResumeUrl?: string;
}

export interface MasterResumeStatus {
  readonly exists: boolean;
  readonly filename: string | null;
  readonly relativeUrl: string | null;
  readonly fileSize: number;
  readonly updatedAt: string | null;
}

export const getMasterResumeStatus = (overrideRoot?: string): MasterResumeStatus => {
  const locations = getTargetStorageLocations(overrideRoot);

  if (fs.existsSync(locations.masterResumePdf)) {
    const stat = fs.statSync(locations.masterResumePdf);
    return {
      exists: true,
      filename: 'master-resume.pdf',
      relativeUrl: 'resumes/master-resume.pdf',
      fileSize: stat.size,
      updatedAt: stat.mtime.toISOString(),
    };
  }

  if (fs.existsSync(locations.masterResumeDocx)) {
    const stat = fs.statSync(locations.masterResumeDocx);
    return {
      exists: true,
      filename: 'master-resume.docx',
      relativeUrl: 'resumes/master-resume.docx',
      fileSize: stat.size,
      updatedAt: stat.mtime.toISOString(),
    };
  }

  return {
    exists: false,
    filename: null,
    relativeUrl: null,
    fileSize: 0,
    updatedAt: null,
  };
};

export const importResumeBuffer = async (
  filename: string,
  buffer: Buffer,
  overrideRoot?: string
): Promise<ImportResumeResult> => {
  const locations = getTargetStorageLocations(overrideRoot);
  let stagingFile: string | null = null;

  try {
    // 1. Validate file format and size
    const { format } = validateResumeFile(filename, buffer);

    // 2. Extract plain text from PDF/DOCX
    const extraction = await extractResumeText(format, buffer);

    // 3. Parse text into a completely fresh MinimalProfile (no merging with old resume)
    const relativeMasterUrl = `resumes/master-resume.${format}`;
    const extractionResult = parseCandidateProfileFromText(extraction.text, relativeMasterUrl);
    const freshProfile = extractionResult.profile;

    if (!isMinimalProfile(freshProfile)) {
      throw new Error('Extracted candidate data does not conform to the required profile schema');
    }

    // 4. Stage the new master file first so we never destroy the old one until validated
    if (!fs.existsSync(locations.resumesDir)) {
      fs.mkdirSync(locations.resumesDir, { recursive: true });
    }

    stagingFile = path.join(locations.resumesDir, `.staging_${Date.now()}.${format}`);
    fs.writeFileSync(stagingFile, buffer);

    // 5. Replace previous profile JSON entirely with the fresh extracted profile
    saveProfile(freshProfile, overrideRoot);

    // 6. Replace master resume file atomically and retain ONLY the new master resume
    const targetFile = format === 'pdf' ? locations.masterResumePdf : locations.masterResumeDocx;
    const alternateFile = format === 'pdf' ? locations.masterResumeDocx : locations.masterResumePdf;

    if (fs.existsSync(targetFile)) {
      fs.unlinkSync(targetFile);
    }
    fs.renameSync(stagingFile, targetFile);
    stagingFile = null;

    if (fs.existsSync(alternateFile)) {
      try {
        fs.unlinkSync(alternateFile);
      } catch {
        // ignore
      }
    }

    return {
      success: true,
      profile: freshProfile,
      originalFilename: path.basename(filename),
      masterResumeUrl: relativeMasterUrl,
    };
  } catch (error) {
    // Clean up staging file on failure to leave existing resume intact
    if (stagingFile && fs.existsSync(stagingFile)) {
      try {
        fs.unlinkSync(stagingFile);
      } catch {
        // ignore
      }
    }
    throw error;
  }
};

export const selectAndImportResume = async (
  targetWindow?: BrowserWindow
): Promise<ImportResumeResult> => {
  const result = await dialog.showOpenDialog(targetWindow ?? (null as unknown as BrowserWindow), {
    title: 'Select Master Resume (PDF or DOCX)',
    properties: ['openFile'],
    filters: [
      { name: 'Supported Resumes (*.pdf, *.docx)', extensions: ['pdf', 'docx'] },
      { name: 'PDF Documents (*.pdf)', extensions: ['pdf'] },
      { name: 'Word Documents (*.docx)', extensions: ['docx'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, error: 'CANCELLED' };
  }

  const selectedPath = result.filePaths[0];
  if (!selectedPath) {
    return { success: false, error: 'CANCELLED' };
  }

  const filename = path.basename(selectedPath);
  const buffer = fs.readFileSync(selectedPath);

  return importResumeBuffer(filename, buffer);
};
