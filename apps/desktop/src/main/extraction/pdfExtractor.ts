import { PDFParse } from 'pdf-parse';
import { normalizeResumeText } from './normalizer.js';
import { ExtractionResult } from './types.js';

export const extractTextFromPdf = async (buffer: Buffer): Promise<ExtractionResult> => {
  if (!buffer || buffer.length === 0) {
    throw new Error('Cannot extract text from an empty PDF buffer.');
  }

  const parser = new PDFParse({ data: buffer });
  try {
    const textResult = await parser.getText();
    const rawText = textResult && typeof textResult.text === 'string' ? textResult.text : '';
    const normalized = normalizeResumeText(rawText);

    if (normalized.characterCount === 0) {
      throw new Error('PDF contains no extractable text. The file may be image-only, scanned, or empty.');
    }

    return normalized;
  } catch (error) {
    if (error instanceof Error && error.message.includes('PDF contains no extractable text')) {
      throw error;
    }
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    try {
      await parser.destroy();
    } catch {
      // Ignore cleanup error
    }
  }
};
