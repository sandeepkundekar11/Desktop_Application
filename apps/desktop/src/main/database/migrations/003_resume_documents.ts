import { DatabaseSync } from 'node:sqlite';
import { Migration } from '../types.js';

export const migration003: Migration = {
  version: 3,
  name: 'resume_documents_and_versioning',
  up: (db: DatabaseSync): void => {
    // 1. Resume Documents table
    db.exec(`
      CREATE TABLE IF NOT EXISTS resume_documents (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        document_type TEXT NOT NULL CHECK (document_type IN ('original_resume', 'optimized_resume', 'tailored_resume', 'cover_letter', 'other')),
        original_filename TEXT NOT NULL,
        relative_file_path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_extension TEXT NOT NULL,
        file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes >= 0),
        file_hash TEXT NOT NULL,
        document_status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (profile_id) REFERENCES candidate_profiles(id) ON DELETE RESTRICT
      );
    `);

    // 2. Resume Versions table
    db.exec(`
      CREATE TABLE IF NOT EXISTS resume_versions (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        version_number INTEGER NOT NULL CHECK (version_number > 0),
        parent_version_id TEXT,
        version_type TEXT NOT NULL,
        version_status TEXT NOT NULL,
        extracted_text TEXT,
        extracted_text_path TEXT,
        extraction_status TEXT NOT NULL,
        extraction_error TEXT,
        source_job_id TEXT,
        source_model_id TEXT,
        content_hash TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (document_id) REFERENCES resume_documents(id) ON DELETE RESTRICT,
        FOREIGN KEY (parent_version_id) REFERENCES resume_versions(id) ON DELETE RESTRICT,
        FOREIGN KEY (source_model_id) REFERENCES ai_models(id) ON DELETE RESTRICT,
        UNIQUE (document_id, version_number),
        CHECK (parent_version_id IS NULL OR parent_version_id != id)
      );
    `);

    // 3. Resume Optimizations table
    db.exec(`
      CREATE TABLE IF NOT EXISTS resume_optimizations (
        id TEXT PRIMARY KEY,
        source_version_id TEXT NOT NULL,
        result_version_id TEXT,
        model_id TEXT,
        status TEXT NOT NULL,
        instructions TEXT,
        change_summary TEXT,
        error_code TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        FOREIGN KEY (source_version_id) REFERENCES resume_versions(id) ON DELETE RESTRICT,
        FOREIGN KEY (result_version_id) REFERENCES resume_versions(id) ON DELETE RESTRICT,
        FOREIGN KEY (model_id) REFERENCES ai_models(id) ON DELETE RESTRICT
      );
    `);

    // 4. Resume Approvals table
    db.exec(`
      CREATE TABLE IF NOT EXISTS resume_approvals (
        id TEXT PRIMARY KEY,
        version_id TEXT NOT NULL,
        status TEXT NOT NULL,
        reviewer_note TEXT,
        reviewed_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (version_id) REFERENCES resume_versions(id) ON DELETE RESTRICT
      );
    `);

    // 5. Migrate legacy 'resumes' table records if present
    try {
      const legacyTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='resumes'").get();
      if (legacyTable) {
        const legacyRows = db.prepare('SELECT * FROM resumes').all() as unknown as {
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
        }[];

        const insertDoc = db.prepare(`
          INSERT OR IGNORE INTO resume_documents (
            id, profile_id, document_type, original_filename, relative_file_path,
            mime_type, file_extension, file_size_bytes, file_hash, document_status,
            created_at, updated_at
          ) VALUES (?, 'default-profile', 'original_resume', ?, ?, ?, ?, ?, ?, 'active', ?, ?)
        `);

        const insertVer = db.prepare(`
          INSERT OR IGNORE INTO resume_versions (
            id, document_id, version_number, parent_version_id, version_type,
            version_status, extracted_text, extracted_text_path, extraction_status,
            extraction_error, source_job_id, source_model_id, content_hash,
            metadata_json, created_at, updated_at
          ) VALUES (?, ?, 1, NULL, 'original', 'active', ?, NULL, 'completed', NULL, NULL, NULL, ?, ?, ?, ?)
        `);

        for (const row of legacyRows) {
          const mimeType = row.file_format === 'pdf'
            ? 'application/pdf'
            : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          const relPath = `resumes/originals/${row.storage_filename}`;

          insertDoc.run(
            row.id,
            row.original_filename,
            relPath,
            mimeType,
            row.file_format,
            row.file_size,
            row.file_hash,
            row.created_at,
            row.created_at
          );

          const metaJson = JSON.stringify({
            characterCount: row.character_count,
            wordCount: row.word_count,
            preview: row.preview,
            storageFilename: row.storage_filename,
          });

          insertVer.run(
            `${row.id}-v1`,
            row.id,
            row.extracted_text,
            row.file_hash,
            metaJson,
            row.created_at,
            row.created_at
          );
        }
      }
    } catch {
      // Ignore migration errors on legacy table check
    }
  },
};
