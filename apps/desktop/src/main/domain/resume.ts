export type ResumeDocumentType =
  | 'original_resume'
  | 'optimized_resume'
  | 'tailored_resume'
  | 'cover_letter'
  | 'other';

export interface ResumeDocument {
  readonly id: string;
  readonly profileId: string;
  readonly documentType: ResumeDocumentType;
  readonly originalFilename: string;
  readonly relativeFilePath: string;
  readonly mimeType: string;
  readonly fileExtension: string;
  readonly fileSizeBytes: number;
  readonly fileHash: string;
  readonly documentStatus: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ResumeVersion {
  readonly id: string;
  readonly documentId: string;
  readonly versionNumber: number;
  readonly parentVersionId: string | null;
  readonly versionType: string;
  readonly versionStatus: string;
  readonly extractedText: string | null;
  readonly extractedTextPath: string | null;
  readonly extractionStatus: string;
  readonly extractionError: string | null;
  readonly sourceJobId: string | null;
  readonly sourceModelId: string | null;
  readonly contentHash: string | null;
  readonly metadataJson: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ResumeOptimization {
  readonly id: string;
  readonly sourceVersionId: string;
  readonly resultVersionId: string | null;
  readonly modelId: string | null;
  readonly status: string;
  readonly instructions: string | null;
  readonly changeSummary: string | null;
  readonly errorCode: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt: string | null;
}

export interface ResumeApproval {
  readonly id: string;
  readonly versionId: string;
  readonly status: string;
  readonly reviewerNote: string | null;
  readonly reviewedAt: string | null;
  readonly createdAt: string;
}
