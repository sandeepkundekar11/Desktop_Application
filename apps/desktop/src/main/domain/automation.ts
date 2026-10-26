export interface AutomationSession {
  readonly id: string;
  readonly applicationId: string;
  readonly sourceId: string;
  readonly status: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly errorCode: string | null;
  readonly summary: string | null;
  readonly metadataJson: string;
}

export interface AutomationEvent {
  readonly id: string;
  readonly sessionId: string;
  readonly eventType: string;
  readonly message: string | null;
  readonly detailsJson: string;
  readonly createdAt: string;
}

export interface SiteCapability {
  readonly id: string;
  readonly sourceId: string;
  readonly capabilityKey: string;
  readonly supported: boolean;
  readonly verificationStatus: string;
  readonly notes: string | null;
  readonly lastVerifiedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
