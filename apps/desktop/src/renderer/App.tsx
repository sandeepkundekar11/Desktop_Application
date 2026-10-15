import React, { FC, useState, useEffect, useCallback } from 'react';
import {
  ThemeProvider,
  ThemeToggle,
  Button,
  Card,
} from '@applypilot/ui';
import { ResumeMetadata } from './types';

export const AppContent: FC = () => {
  const [resumes, setResumes] = useState<readonly ResumeMetadata[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [selectedExtractedText, setSelectedExtractedText] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [alertType, setAlertType] = useState<'success' | 'error'>('success');
  const [isLoading, setIsLoading] = useState(false);

  const loadResumes = useCallback(async () => {
    try {
      if (window.applyPilotAPI?.resume) {
        const list = await window.applyPilotAPI.resume.list();
        setResumes(list);
      }
    } catch (err) {
      setAlertType('error');
      setAlertMessage(`Failed to load resumes: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  useEffect(() => {
    loadResumes();
  }, [loadResumes]);

  const handleUploadResume = async () => {
    setIsLoading(true);
    setAlertMessage(null);
    try {
      if (!window.applyPilotAPI?.resume) {
        throw new Error('Resume API bridge is not available');
      }

      const result = await window.applyPilotAPI.resume.selectAndImport();

      if (!result.success) {
        if (result.error !== 'CANCELLED') {
          setAlertType('error');
          setAlertMessage(result.error ?? 'Failed to import resume.');
        }
        return;
      }

      await loadResumes();

      if (result.isDuplicate) {
        setAlertType('success');
        setAlertMessage(`Resume "${result.metadata?.originalFilename}" was already imported (duplicate detected).`);
      } else {
        setAlertType('success');
        setAlertMessage(`Successfully imported and extracted text from "${result.metadata?.originalFilename}".`);
      }
    } catch (err) {
      setAlertType('error');
      setAlertMessage(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleExtractedText = async (id: string) => {
    if (selectedResumeId === id) {
      setSelectedResumeId(null);
      setSelectedExtractedText(null);
      return;
    }

    try {
      if (!window.applyPilotAPI?.resume) return;
      const details = await window.applyPilotAPI.resume.getExtractedText(id);
      if (details) {
        setSelectedResumeId(id);
        setSelectedExtractedText(details.extractedText);
      }
    } catch (err) {
      setAlertType('error');
      setAlertMessage(`Failed to load extracted text: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="demo-layout">
      <header className="demo-header">
        <h1 className="demo-header__title">ApplyPilot</h1>
        <ThemeToggle />
      </header>

      <section className="resume-section-header">
        <div>
          <h2 className="resume-section-title">Resume Management</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            Upload, extract, and verify local resume documents securely.
          </p>
        </div>
        <Button
          variant="primary"
          id="btn-upload-resume"
          onClick={handleUploadResume}
          disabled={isLoading}
        >
          {isLoading ? 'Processing...' : 'Upload Resume'}
        </Button>
      </section>

      {alertMessage && (
        <div
          className={`demo-result demo-result--${alertType}`}
          id="resume-alert-banner"
          role="status"
        >
          {alertMessage}
        </div>
      )}

      <main className="resume-list" id="resume-list-container">
        {resumes.length === 0 ? (
          <Card>
            <div className="empty-state" id="resume-empty-state">
              <p>No resumes imported yet.</p>
              <p style={{ marginTop: 'var(--space-2)' }}>
                Click <strong>Upload Resume</strong> to import a PDF or DOCX document.
              </p>
            </div>
          </Card>
        ) : (
          resumes.map((resume) => {
            const isViewing = selectedResumeId === resume.id;
            return (
              <Card key={resume.id} className="resume-card" id={`resume-card-${resume.id}`}>
                <div className="resume-item-header">
                  <span className="resume-filename">{resume.originalFilename}</span>
                  <span className="resume-badge">{resume.fileFormat}</span>
                </div>

                <div className="resume-meta-row">
                  <span>Size: {formatFileSize(resume.fileSize)}</span>
                  <span>Words: {resume.wordCount}</span>
                  <span>Chars: {resume.characterCount}</span>
                  <span>Imported: {new Date(resume.createdAt).toLocaleDateString()}</span>
                </div>

                {resume.preview && (
                  <p className="resume-preview-snippet">"{resume.preview}..."</p>
                )}

                <div className="demo-actions">
                  <Button
                    variant="secondary"
                    id={`btn-view-text-${resume.id}`}
                    onClick={() => handleToggleExtractedText(resume.id)}
                  >
                    {isViewing ? 'Hide Extracted Text' : 'Review Extracted Text'}
                  </Button>
                </div>

                {isViewing && selectedExtractedText && (
                  <div className="resume-text-viewer" id={`text-viewer-${resume.id}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        Extracted Plain Text Content:
                      </strong>
                    </div>
                    <pre className="resume-text-content">{selectedExtractedText}</pre>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </main>
    </div>
  );
};

export const App: FC = () => {
  return (
    <ThemeProvider defaultTheme="dark">
      <AppContent />
    </ThemeProvider>
  );
};

export default App;
