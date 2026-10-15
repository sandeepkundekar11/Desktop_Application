import mammoth from 'mammoth';
import { normalizeResumeText } from './normalizer.js';
import { ExtractionResult } from './types.js';

export const extractTextFromDocx = async (buffer: Buffer): Promise<ExtractionResult> => {
  if (!buffer || buffer.length === 0) {
    throw new Error('Cannot extract text from an empty DOCX buffer.');
  }

  try {
    const result = await mammoth.extractRawText({ buffer });
    const rawText = result && typeof result.value === 'string' ? result.value : '';
    const normalized = normalizeResumeText(rawText);

    if (normalized.characterCount === 0) {
      throw new Error('DOCX document contains no extractable text.');
    }

    return normalized;
  } catch (error) {
    if (error instanceof Error && error.message.includes('DOCX document contains no extractable text')) {
      throw error;
    }
    throw new Error(`Failed to extract text from DOCX: ${error instanceof Error ? error.message : String(error)}`);
  }
};
