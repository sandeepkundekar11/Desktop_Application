export interface AppMetadata {
  readonly key: string;
  readonly value: string;
  readonly updatedAt: string;
}

export interface SchemaMigration {
  readonly version: number;
  readonly migrationName: string;
  readonly checksum: string | null;
  readonly appliedAt: string;
}

export interface AppSetting {
  readonly key: string;
  readonly valueJson: string;
  readonly updatedAt: string;
}
