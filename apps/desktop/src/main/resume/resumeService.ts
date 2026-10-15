import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { dialog, BrowserWindow } from 'electron';
import { validateResumeFile } from './fileValidator.js';
import { extractResumeText } from '../extraction/index.js';
import { saveStorageFile } from '../storage/fileStorage.js';
import {
  insertResumeRecord,
  findResumeByHash,
  listAllResumes,
  getResumeDetailsById,
} from './resumeRepository.js';
import { ImportResumeResult, ResumeMetadata, ResumeDetails } from './types.js';

const PREVIEW_MAX_LENGTH = 160;

export const importResumeBuffer = async (
  filename: string,
  buffer: Buffer
): Promise<ImportResumeResult> => {
  // 1. Validate size, extension, and magic signatures
  const { format, size } = validateResumeFile(filename, buffer);

  // 2. Compute SHA-256 hash for duplicate detection
  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

  // 3. Duplicate check
  const existingMetadata = findResumeByHash(fileHash);
  if (existingMetadata) {
    const existingDetails = getResumeDetailsById(existingMetadata.id);
    return {
      success: true,
      isDuplicate: true,
      metadata: existingMetadata,
      extractedText: existingDetails?.extractedText,
    };
  }

  // 4. Extract readable text
  const extraction = await extractResumeText(format, buffer);

  // 5. Generate unique identifier and store original file safely
  const resumeId = crypto.randomUUID();
  const storageFilename = `${resumeId}.${format}`;
  saveStorageFile('resumes_original', storageFilename, buffer, false);

  // 6. Generate preview string
  const preview = extraction.text.slice(0, PREVIEW_MAX_LENGTH).replace(/\s+/g, ' ').trim();
  const createdAt = new Date().toISOString();

  // 7. Persist metadata and extracted text in SQLite
  const metadata: ResumeMetadata = {
    id: resumeId,
    originalFilename: path.basename(filename),
    fileFormat: format,
    fileSize: size,
    createdAt,
    characterCount: extraction.characterCount,
    wordCount: extraction.wordCount,
    preview,
  };

  insertResumeRecord({
    id: resumeId,
    originalFilename: metadata.originalFilename,
    fileFormat: format,
    fileSize: size,
    fileHash,
    storageFilename,
    extractedText: extraction.text,
    characterCount: extraction.characterCount,
    wordCount: extraction.wordCount,
    preview,
    createdAt,
  });

  return {
    success: true,
    isDuplicate: false,
    metadata,
    extractedText: extraction.text,
  };
};

export const selectAndImportResume = async (
  targetWindow?: BrowserWindow
): Promise<ImportResumeResult> => {
  const result = await dialog.showOpenDialog(targetWindow ?? null as unknown as BrowserWindow, {
    title: 'Select Resume (PDF or DOCX)',
    properties: ['openFile'],
    filters: [
      { name: 'Resumes (*.pdf, *.docx)', extensions: ['pdf', 'docx'] },
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

export const listSavedResumes = (): readonly ResumeMetadata[] => {
  return listAllResumes();
};

export const getResumeTextById = (id: string): ResumeDetails | null => {
  if (!id || typeof id !== 'string') {
    throw new Error('Invalid resume ID specified');
  }
  return getResumeDetailsById(id);
};
