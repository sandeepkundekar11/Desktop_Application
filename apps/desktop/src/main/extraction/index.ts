import { extractTextFromPdf } from './pdfExtractor.js';
import { extractTextFromDocx } from './docxExtractor.js';
import { SupportedResumeFormat, ExtractionResult } from './types.js';

export * from './types.js';
export * from './normalizer.js';
export * from './pdfExtractor.js';
export * from './docxExtractor.js';
export * from './contactParser.js';
export * from './sectionParser.js';
export * from './experienceParser.js';
export * from './projectParser.js';
export * from './certificationParser.js';
export * from './profileParser.js';

export const extractResumeText = async (
  format: SupportedResumeFormat,
  buffer: Buffer
): Promise<ExtractionResult> => {
  switch (format) {
    case 'pdf':
      return extractTextFromPdf(buffer);
    case 'docx':
      return extractTextFromDocx(buffer);
    default:
      throw new Error(`Unsupported document format for text extraction: "${String(format)}"`);
  }
};
