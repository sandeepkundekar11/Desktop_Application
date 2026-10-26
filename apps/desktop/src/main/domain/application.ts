export interface Application {
  readonly id: string;
  readonly jobId: string;
  readonly candidateProfileId: string;
  readonly resumeVersionId: string | null;
  readonly status: string;
  readonly applicationUrl: string | null;
  readonly startedAt: string | null;
  readonly submittedAt: string | null;
  readonly submissionVerifiedAt: string | null;
  readonly externalApplicationId: string | null;
  readonly failureCode: string | null;
  readonly failureMessage: string | null;
  readonly metadataJson: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ApplicationEvent {
  readonly id: string;
  readonly applicationId: string;
  readonly eventType: string;
  readonly message: string | null;
  readonly detailsJson: string;
  readonly createdAt: string;
}

export interface ApplicationAnswer {
  readonly id: string;
  readonly applicationId: string;
  readonly questionText: string;
  readonly questionKey: string | null;
  readonly answerText: string | null;
  readonly answerSource: string;
  readonly confidence: number | null;
  readonly reviewStatus: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ApplicationArtifact {
  readonly id: string;
  readonly applicationId: string;
  readonly artifactType: string;
  readonly relativeFilePath: string;
  readonly fileHash: string | null;
  readonly metadataJson: string;
  readonly createdAt: string;
}
