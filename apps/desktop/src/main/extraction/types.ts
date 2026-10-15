export type SupportedResumeFormat = 'pdf' | 'docx';

export interface ExtractionResult {
  readonly text: string;
  readonly characterCount: number;
  readonly wordCount: number;
}
