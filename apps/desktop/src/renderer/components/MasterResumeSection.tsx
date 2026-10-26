import React, { FC, useState, useEffect, useCallback } from 'react';
import { Button } from '@applypilot/ui';
import { MasterResumeStatus, ResumeInfo, MinimalProfile } from '../types';

export interface MasterResumeSectionProps {
  readonly resume: ResumeInfo;
  readonly onChange: (updated: ResumeInfo) => void;
  readonly onProfileExtracted?: (newProfile: MinimalProfile) => void;
}

export const MasterResumeSection: FC<MasterResumeSectionProps> = ({
  resume,
  onChange,
  onProfileExtracted,
}) => {
  const [status, setStatus] = useState<MasterResumeStatus | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      if (window.applyPilotAPI?.resume) {
        const s = await window.applyPilotAPI.resume.getMasterStatus();
        setStatus(s);
        if (s.relativeUrl && s.relativeUrl !== resume.master_resume_url) {
          onChange({ master_resume_url: s.relativeUrl });
        }
      }
    } catch {
      // ignore
    }
  }, [onChange, resume.master_resume_url]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleUploadOrReplace = async () => {
    setIsUploading(true);
    setMessage(null);
    try {
      if (!window.applyPilotAPI?.resume) {
        throw new Error('Resume API bridge not available');
      }

      const result = await window.applyPilotAPI.resume.selectAndImport();
      if (!result.success) {
        if (result.error !== 'CANCELLED') {
          setMessage({
            text: result.error || 'Failed to upload master resume.',
            isError: true,
          });
        }
        return;
      }

      await fetchStatus();
      if (result.masterResumeUrl) {
        onChange({ master_resume_url: result.masterResumeUrl });
      }
      if (result.profile && onProfileExtracted) {
        onProfileExtracted(result.profile);
      }

      setMessage({
        text: `Master resume updated successfully from "${result.originalFilename}". Profile extracted below.`,
        isError: false,
      });
    } catch (err) {
      setMessage({
        text: `Upload failed: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <section className="master-resume-section" aria-label="Master Resume Upload" id="master-resume-upload-section">
      <div className="master-resume-card">
        <div className="master-resume-card__header">
          <div className="master-resume-card__info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="master-resume-card__icon" aria-hidden="true">📄</span>
              <h3 className="master-resume-card__title">Master Resume</h3>
              {status?.exists && (
                <span className="badge-tag badge-tag--accent" style={{ height: '22px', fontSize: '11px' }}>
                  Active Master
                </span>
              )}
            </div>
            <p className="master-resume-card__desc">
              Your primary resume source for candidate profile extraction and applications.
            </p>
          </div>

          <div className="master-resume-card__actions">
            <Button
              variant="primary"
              id="upload-master-resume-btn"
              onClick={handleUploadOrReplace}
              disabled={isUploading}
            >
              {isUploading
                ? 'Processing Resume...'
                : status?.exists
                ? 'Replace Master Resume'
                : 'Upload Master Resume'}
            </Button>
          </div>
        </div>

        {message && (
          <div
            className={`demo-result demo-result--${message.isError ? 'error' : 'success'}`}
            style={{ marginTop: '12px', marginBottom: '8px' }}
            role="status"
          >
            {message.text}
          </div>
        )}

        <div className="master-resume-details">
          {status?.exists ? (
            <div className="master-resume-file-info">
              <div className="master-resume-file-row">
                <span className="master-resume-file-name">{status.filename}</span>
                <span className="format-badge format-badge--pdf">
                  {status.filename?.endsWith('.docx') ? 'DOCX' : 'PDF'}
                </span>
                <span className="master-resume-file-size">{formatFileSize(status.fileSize)}</span>
              </div>
              <div className="master-resume-file-meta">
                <span>Stored at: <code>{status.relativeUrl || resume.master_resume_url}</code></span>
                {status.updatedAt && (
                  <span>• Last modified: {new Date(status.updatedAt).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="master-resume-empty">
              <p>No master resume currently saved. Click "Upload Master Resume" to select a PDF or DOCX file.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
