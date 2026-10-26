import React, { FC, useState, useEffect } from 'react';
import { Button } from '@applypilot/ui';
import { ConnectorConfig, ConnectorSettings } from '../../types';

export interface ConnectorConfigModalProps {
  readonly connector: ConnectorConfig;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSave: (settings: ConnectorSettings) => Promise<void>;
}

const SUPPORTED_LOCATIONS = [
  'Remote',
  'Worldwide',
  'United States',
  'India',
  'United Kingdom',
  'European Union',
  'Canada',
] as const;

export const ConnectorConfigModal: FC<ConnectorConfigModalProps> = ({
  connector,
  isOpen,
  onClose,
  onSave,
}) => {
  if (!isOpen) return null;

  const [locationPreference, setLocationPreference] = useState(
    connector.settings.locationPreference || ''
  );
  const [refreshIntervalHours, setRefreshIntervalHours] = useState(
    connector.settings.refreshIntervalHours || 12
  );
  const [fetchLimit, setFetchLimit] = useState(connector.settings.fetchLimit || 25);
  const [workplaceType, setWorkplaceType] = useState(
    connector.settings.workplaceType || 'any'
  );
  const [targetKeywordsText, setTargetKeywordsText] = useState(
    (connector.settings.targetKeywords || []).join(', ')
  );
  const [easyApplyOnly, setEasyApplyOnly] = useState(
    Boolean(connector.settings.easyApplyOnly)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setLocationPreference(connector.settings.locationPreference || '');
    setRefreshIntervalHours(connector.settings.refreshIntervalHours || 12);
    setFetchLimit(connector.settings.fetchLimit || 25);
    setWorkplaceType(connector.settings.workplaceType || 'any');
    setTargetKeywordsText((connector.settings.targetKeywords || []).join(', '));
    setEasyApplyOnly(Boolean(connector.settings.easyApplyOnly));
    setErrorMessage(null);
  }, [connector.id, connector.settings, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedLocation = locationPreference.trim();
    if (!trimmedLocation) {
      setErrorMessage('Location preference is required. Please select or enter a location.');
      return;
    }

    const interval = Number(refreshIntervalHours);
    if (isNaN(interval) || interval <= 0) {
      setErrorMessage('Refresh interval must be a positive number.');
      return;
    }

    const limit = Number(fetchLimit);
    if (isNaN(limit) || limit <= 0 || limit > 200) {
      setErrorMessage('Fetch limit must be between 1 and 200.');
      return;
    }

    const keywords = targetKeywordsText
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    const nextSettings: ConnectorSettings = {
      locationPreference: trimmedLocation,
      refreshIntervalHours: interval,
      fetchLimit: limit,
      workplaceType: workplaceType.trim(),
      targetKeywords: keywords,
      easyApplyOnly: connector.id === 'linkedin' ? easyApplyOnly : undefined,
    };

    try {
      setIsSaving(true);
      await onSave(nextSettings);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connector-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog">
        <header className="modal-header">
          <h2 id="connector-modal-title" className="modal-title">
            Configure {connector.name}
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close configuration modal"
          >
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errorMessage && (
              <div
                className="demo-result demo-result--error"
                role="alert"
                style={{ marginBottom: 'var(--space-2)' }}
              >
                {errorMessage}
              </div>
            )}

            <div className="ui-input-group">
              <label htmlFor={`cfg-location-${connector.id}`} className="ui-label">
                Location Preference
              </label>
              <input
                id={`cfg-location-${connector.id}`}
                list={`cfg-locations-${connector.id}`}
                type="text"
                className="ui-input"
                placeholder="e.g. Remote, Worldwide, United States, India"
                value={locationPreference}
                onChange={(e) => setLocationPreference(e.target.value)}
              />
              <datalist id={`cfg-locations-${connector.id}`}>
                {SUPPORTED_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc} />
                ))}
              </datalist>

              <div className="location-options-container">
                <span className="location-options-label">Select location:</span>
                <div className="location-chips">
                  {SUPPORTED_LOCATIONS.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      className={`location-chip ${locationPreference === loc ? 'location-chip--selected' : ''}`}
                      onClick={() => setLocationPreference(loc)}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </div>

              <span className="ui-helper-text">
                Target geographic filter passed to job search queries.
              </span>
            </div>

            <div className="ui-input-group">
              <label htmlFor={`cfg-workplace-${connector.id}`} className="ui-label">
                Workplace Mode
              </label>
              <select
                id={`cfg-workplace-${connector.id}`}
                className="ui-input"
                value={workplaceType}
                onChange={(e) => setWorkplaceType(e.target.value)}
              >
                <option value="any">Any (Remote, Hybrid, On-site)</option>
                <option value="remote">Remote Only</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-site Only</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div className="ui-input-group">
                <label htmlFor={`cfg-interval-${connector.id}`} className="ui-label">
                  Sync Interval (Hours)
                </label>
                <input
                  id={`cfg-interval-${connector.id}`}
                  type="number"
                  min="1"
                  max="168"
                  className="ui-input"
                  value={refreshIntervalHours}
                  onChange={(e) => setRefreshIntervalHours(Number(e.target.value))}
                />
              </div>

              <div className="ui-input-group">
                <label htmlFor={`cfg-limit-${connector.id}`} className="ui-label">
                  Fetch Limit (Jobs)
                </label>
                <input
                  id={`cfg-limit-${connector.id}`}
                  type="number"
                  min="1"
                  max="200"
                  className="ui-input"
                  value={fetchLimit}
                  onChange={(e) => setFetchLimit(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="ui-input-group">
              <label htmlFor={`cfg-keywords-${connector.id}`} className="ui-label">
                Target Keywords (Optional)
              </label>
              <input
                id={`cfg-keywords-${connector.id}`}
                type="text"
                className="ui-input"
                placeholder="e.g. React, TypeScript, Full Stack (comma separated)"
                value={targetKeywordsText}
                onChange={(e) => setTargetKeywordsText(e.target.value)}
              />
              <span className="ui-helper-text">
                Comma-separated keywords to prioritize for this source.
              </span>
            </div>

            {connector.id === 'linkedin' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                <input
                  id={`cfg-easy-apply-${connector.id}`}
                  type="checkbox"
                  checked={easyApplyOnly}
                  onChange={(e) => setEasyApplyOnly(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                />
                <label htmlFor={`cfg-easy-apply-${connector.id}`} className="ui-label" style={{ cursor: 'pointer', margin: 0 }}>
                  Prioritize LinkedIn Easy Apply listings
                </label>
              </div>
            )}
          </div>

          <footer className="modal-footer">
            <Button variant="secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </footer>
        </form>
      </div>
    </div>
  );
};
