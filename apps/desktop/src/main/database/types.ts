import { DatabaseSync } from 'node:sqlite';

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly up: (db: DatabaseSync) => void;
}

export interface AppliedMigrationRecord {
  readonly version: number;
  readonly migration_name: string;
  readonly checksum: string;
  readonly applied_at: string;
}
