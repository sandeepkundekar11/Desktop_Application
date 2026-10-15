import { initDatabase } from '../storage/database.js';
import { ResumeMetadata, ResumeDetails } from './types.js';
import { SupportedResumeFormat } from '../extraction/types.js';

export interface ResumeDatabaseRecord {
  readonly id: string;
  readonly originalFilename: string;
  readonly fileFormat: SupportedResumeFormat;
  readonly fileSize: number;
  readonly fileHash: string;
  readonly storageFilename: string;
  readonly extractedText: string;
  readonly characterCount: number;
  readonly wordCount: number;
  readonly preview: string;
  readonly createdAt: string;
}

interface RawResumeRow {
  id: string;
  original_filename: string;
  file_format: string;
  file_size: number;
  file_hash: string;
  storage_filename: string;
  extracted_text: string;
  character_count: number;
  word_count: number;
  preview: string;
  created_at: string;
}

const mapRowToMetadata = (row: RawResumeRow): ResumeMetadata => ({
  id: row.id,
  originalFilename: row.original_filename,
  fileFormat: row.file_format as SupportedResumeFormat,
  fileSize: row.file_size,
  createdAt: row.created_at,
  characterCount: row.character_count,
  wordCount: row.word_count,
  preview: row.preview,
});

export const ensureResumeTable = (): void => {
  const db = initDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS resumes (
      id TEXT PRIMARY KEY,
      original_filename TEXT NOT NULL,
      file_format TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_hash TEXT NOT NULL UNIQUE,
      storage_filename TEXT NOT NULL,
      extracted_text TEXT NOT NULL,
      character_count INTEGER NOT NULL,
      word_count INTEGER NOT NULL,
      preview TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_resumes_hash ON resumes(file_hash);
    CREATE INDEX IF NOT EXISTS idx_resumes_created ON resumes(created_at DESC);
  `);
};

export const insertResumeRecord = (record: ResumeDatabaseRecord): void => {
  ensureResumeTable();
  const db = initDatabase();
  const stmt = db.prepare(`
    INSERT INTO resumes (
      id, original_filename, file_format, file_size, file_hash,
      storage_filename, extracted_text, character_count, word_count,
      preview, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    record.id,
    record.originalFilename,
    record.fileFormat,
    record.fileSize,
    record.fileHash,
    record.storageFilename,
    record.extractedText,
    record.characterCount,
    record.wordCount,
    record.preview,
    record.createdAt
  );
};

export const findResumeByHash = (fileHash: string): ResumeMetadata | null => {
  ensureResumeTable();
  const db = initDatabase();
  const query = db.prepare('SELECT * FROM resumes WHERE file_hash = ?');
  const row = query.get(fileHash) as unknown as RawResumeRow | undefined;
  return row ? mapRowToMetadata(row) : null;
};

export const listAllResumes = (): readonly ResumeMetadata[] => {
  ensureResumeTable();
  const db = initDatabase();
  const query = db.prepare('SELECT * FROM resumes ORDER BY created_at DESC');
  const rows = query.all() as unknown as RawResumeRow[];
  return rows.map(mapRowToMetadata);
};

export const getResumeDetailsById = (id: string): ResumeDetails | null => {
  ensureResumeTable();
  const db = initDatabase();
  const query = db.prepare('SELECT * FROM resumes WHERE id = ?');
  const row = query.get(id) as unknown as RawResumeRow | undefined;

  if (!row) {
    return null;
  }

  return {
    metadata: mapRowToMetadata(row),
    extractedText: row.extracted_text,
  };
};
