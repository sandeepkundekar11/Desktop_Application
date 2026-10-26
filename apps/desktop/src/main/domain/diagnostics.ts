export interface DataTransfer {
  readonly id: string;
  readonly transferType: 'export' | 'import' | 'backup' | 'restore' | string;
  readonly status: string;
  readonly filePath: string | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly errorCode: string | null;
  readonly summaryJson: string;
}

export interface DiagnosticEvent {
  readonly id: string;
  readonly eventType: string;
  readonly severity: 'debug' | 'info' | 'warn' | 'error' | 'fatal' | string;
  readonly errorCode: string | null;
  readonly message: string | null;
  readonly contextJson: string;
  readonly createdAt: string;
}
