import path from 'node:path';
import { SupportedResumeFormat } from '../extraction/types.js';

export const MAX_RESUME_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit

// PDF starts with %PDF- (hex: 25 50 44 46 2D)
const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d];

// DOCX is a zip archive starting with PK\x03\x04 (hex: 50 4B 03 04)
const ZIP_MAGIC_BYTES = [0x50, 0x4b, 0x03, 0x04];

const matchesMagicBytes = (buffer: Buffer, magic: number[]): boolean => {
  if (buffer.length < magic.length) {
    return false;
  }
  for (let i = 0; i < magic.length; i++) {
    if (buffer[i] !== magic[i]) {
      return false;
    }
  }
  return true;
};

export const detectFileFormat = (buffer: Buffer): SupportedResumeFormat => {
  if (matchesMagicBytes(buffer, PDF_MAGIC_BYTES)) {
    return 'pdf';
  }
  if (matchesMagicBytes(buffer, ZIP_MAGIC_BYTES)) {
    return 'docx';
  }
  throw new Error('Unsupported or unrecognized file format. Only valid PDF and DOCX files are allowed.');
};

export const validateResumeFile = (
  filename: string,
  buffer: Buffer
): { format: SupportedResumeFormat; size: number } => {
  // 1. Check size
  const size = buffer.length;
  if (size === 0) {
    throw new Error('The selected file is empty (0 bytes).');
  }
  if (size > MAX_RESUME_SIZE_BYTES) {
    const sizeMb = (size / (1024 * 1024)).toFixed(1);
    throw new Error(`File size (${sizeMb}MB) exceeds the maximum allowed limit of 10MB.`);
  }

  // 2. Check extension
  const ext = path.extname(filename).toLowerCase();
  if (ext !== '.pdf' && ext !== '.docx') {
    throw new Error(`Unsupported file extension "${ext}". Allowed formats are .pdf and .docx.`);
  }

  // 3. Check actual file signature (magic bytes)
  const format = detectFileFormat(buffer);

  // 4. Verify extension matches signature
  if (ext === '.pdf' && format !== 'pdf') {
    throw new Error('File extension is .pdf but content is not a valid PDF document.');
  }
  if (ext === '.docx' && format !== 'docx') {
    throw new Error('File extension is .docx but content is not a valid DOCX document.');
  }

  return { format, size };
};
