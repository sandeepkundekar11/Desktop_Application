import React, { FC, useState } from 'react';
import { Button } from '@applypilot/ui';
import { ConnectorConfig, ConnectorSettings, ConnectorImplementationStatus } from '../../types';
import { getConnectorMetadata } from './connectorMetadata';
import { ConnectorConfigModal } from './ConnectorConfigModal';

export interface ConnectorCardProps {
  readonly connector: ConnectorConfig;
  readonly onToggleEnable: (id: ConnectorConfig['id'], isEnabled: boolean) => Promise<void>;
  readonly onSaveSettings: (id: ConnectorConfig['id'], settings: ConnectorSettings) => Promise<void>;
  readonly onTestConnection: (id: ConnectorConfig['id']) => Promise<void>;
}

const getSetupStatusLabel = (status: ConnectorImplementationStatus): string => {
  switch (status) {
    case 'requires_setup':
      return 'Requires Setup';
    case 'configured':
      return 'Configured';
    case 'available':
      return 'Available';
    case 'unavailable':
      return 'Unavailable';
    case 'planned':
    default:
      return 'Planned';
  }
};

const getConnectionStatusLabel = (status?: string, lastCheckedAt?: string | null): string => {
  if (!lastCheckedAt) {
    return 'Not tested';
  }
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'not_configured':
      return 'Not configured';
    case 'check_unavailable':
      return 'Check unavailable';
    case 'not_connected':
      return 'Not connected';
    case 'error':
      return 'Error';
    case 'unavailable':
      return 'Unavailable';
    case 'not_tested':
    default:
      return 'Not tested';
  }
};

export const ConnectorCard: FC<ConnectorCardProps> = ({
  connector,
  onToggleEnable,
  onSaveSettings,
  onTestConnection,
}) => {
  const metadata = getConnectorMetadata(connector.id);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const handleToggle = async () => {
    await onToggleEnable(connector.id, !connector.isEnabled);
  };

  const handleTest = async () => {
    try {
      setIsTesting(true);
      await onTestConnection(connector.id);
    } finally {
      setIsTesting(false);
    }
  };

  const formattedLastCheck = connector.lastCheckedAt
    ? new Date(connector.lastCheckedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'Never tested';

  const setupLabel = getSetupStatusLabel(connector.implementationStatus);
  const connectionLabel = getConnectionStatusLabel(connector.connectionStatus, connector.lastCheckedAt);
  const connectionChipModifier = !connector.lastCheckedAt
    ? 'not-tested'
    : (connector.connectionStatus || 'not-tested').replace(/_/g, '-');

  return (
    <>
      <article
        className={`connector-card ${connector.isEnabled ? 'connector-card--enabled' : ''}`}
        id={`connector-card-${connector.id}`}
        aria-label={`${connector.name} connector card`}
      >
        <div className="connector-card__body">
          {/* Header with Title and Enable Toggle */}
          <div className="connector-card__header">
            <div className="connector-card__title-group">
              <div className="connector-card__icon" aria-hidden="true">
                {connector.name.charAt(0)}
              </div>
              <div>
                <h3 className="connector-card__name">{connector.name}</h3>
                <span className="connector-card__badge">{metadata.badge}</span>
              </div>
            </div>

            {/* Enable/Disable Toggle - distinct from setup and connection status */}
            <div
              className="connector-toggle-wrapper"
              onClick={handleToggle}
              role="switch"
              aria-checked={connector.isEnabled}
              aria-label={`Toggle ${connector.name} enabled state`}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleToggle();
                }
              }}
            >
              <div
                className={`connector-switch ${
                  connector.isEnabled ? 'connector-switch--checked' : ''
                }`}
              >
                <div className="connector-switch__thumb" />
              </div>
              <span className="connector-toggle-label">
                {connector.isEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          {/* Description */}
          <p className="connector-card__description">{connector.description}</p>

          {/* Status Badges: Distinct Setup Status, Connection Verification, and Coverage */}
          <div className="connector-status-row">
            {/* Single Setup Status Indicator */}
            <span
              className={`status-chip status-chip--${(connector.implementationStatus || 'planned').replace(/_/g, '-')}`}
              title={`Setup status: ${setupLabel}`}
            >
              <span className="status-chip__dot" aria-hidden="true" />
              <span>{setupLabel}</span>
            </span>

            {/* Connection Verification Status */}
            <span
              className={`status-chip status-chip--${connectionChipModifier}`}
              title={`Connection check result: ${connectionLabel}`}
            >
              <span className="status-chip__dot" aria-hidden="true" />
              <span>{connectionLabel}</span>
            </span>

            {/* Coverage Tag */}
            <span
              className="status-chip status-chip--coverage"
              title={`Geographic coverage: ${metadata.coverage}`}
            >
              <span>{metadata.coverage}</span>
            </span>
          </div>

          {/* Non-sensitive settings summary */}
          <div className="connector-settings-summary">
            <div className="connector-settings-summary__title">
              Configuration Parameters
            </div>
            <div className="connector-settings-summary__list">
              <div className="connector-settings-item">
                <span className="connector-settings-item__key">Location:</span>
                <span
                  className="connector-settings-item__val"
                  title={connector.settings.locationPreference || 'Not configured'}
                >
                  {connector.settings.locationPreference || 'Not configured'}
                </span>
              </div>
              <div className="connector-settings-item">
                <span className="connector-settings-item__key">Workplace:</span>
                <span className="connector-settings-item__val" title={connector.settings.workplaceType || 'Any'}>
                  {connector.settings.workplaceType || 'Any'}
                </span>
              </div>
              <div className="connector-settings-item">
                <span className="connector-settings-item__key">Sync Interval:</span>
                <span className="connector-settings-item__val">
                  {connector.settings.refreshIntervalHours}h
                </span>
              </div>
              <div className="connector-settings-item">
                <span className="connector-settings-item__key">Fetch Limit:</span>
                <span className="connector-settings-item__val">
                  {connector.settings.fetchLimit} jobs
                </span>
              </div>
              {connector.id === 'linkedin' && (
                <div className="connector-settings-item">
                  <span className="connector-settings-item__key">Easy Apply:</span>
                  <span className="connector-settings-item__val">
                    {connector.settings.easyApplyOnly ? 'Prioritized' : 'All Listings'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Diagnostic status message */}
          <div className="connector-diagnostic-banner">
            <div className="connector-diagnostic-text">
              <strong>Diagnostic:</strong> {connector.statusMessage}
            </div>
            <div className="connector-diagnostic-time">
              Last checked: {formattedLastCheck}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="connector-card__actions">
          <Button
            variant="secondary"
            onClick={() => setIsConfigOpen(true)}
            aria-label={`Configure ${connector.name}`}
          >
            Configure
          </Button>

          <Button
            variant="secondary"
            onClick={handleTest}
            disabled={isTesting}
            aria-label={`Test connection for ${connector.name}`}
          >
            {isTesting ? 'Testing...' : 'Check Connection'}
          </Button>
        </div>
      </article>

      {/* Configuration Modal */}
      <ConnectorConfigModal
        connector={connector}
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onSave={async (newSettings) => {
          await onSaveSettings(connector.id, newSettings);
        }}
      />
    </>
  );
};
