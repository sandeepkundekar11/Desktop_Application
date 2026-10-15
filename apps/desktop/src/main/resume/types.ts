import { SupportedResumeFormat } from '../extraction/types.js';

export interface ResumeMetadata {
  readonly id: string;
  readonly originalFilename: string;
  readonly fileFormat: SupportedResumeFormat;
  readonly fileSize: number;
  readonly createdAt: string;
  readonly characterCount: number;
  readonly wordCount: number;
  readonly preview: string;
}

export interface ResumeDetails {
  readonly metadata: ResumeMetadata;
  readonly extractedText: string;
}

export interface ImportResumeResult {
  readonly success: boolean;
  readonly isDuplicate?: boolean;
  readonly metadata?: ResumeMetadata;
  readonly extractedText?: string;
  readonly error?: string;
}
