import React, { FC, useState, useEffect, useCallback } from 'react';
import { Button } from '@applypilot/ui';
import { ConnectorConfig, ConnectorId, ConnectorSettings, ConnectorsFileSchema } from '../../types';
import { ConnectorCard } from './ConnectorCard';

export const ConnectorManagementView: FC = () => {
  const [data, setData] = useState<ConnectorsFileSchema | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [alertType, setAlertType] = useState<'success' | 'error'>('success');

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      if (window.applyPilotAPI?.connectors) {
        const result = await window.applyPilotAPI.connectors.getAll();
        setData(result);
      }
    } catch (err) {
      setAlertType('error');
      setAlertMessage(`Failed to load connectors: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleEnable = async (id: ConnectorId, isEnabled: boolean) => {
    try {
      if (!window.applyPilotAPI?.connectors) return;
      const updated = await window.applyPilotAPI.connectors.update(id, { isEnabled });
      setData(updated);
      setAlertType('success');
      setAlertMessage(
        `Connector "${id}" ${isEnabled ? 'enabled' : 'disabled'}. Persisted to data/connectors/connectors.json.`
      );
    } catch (err) {
      setAlertType('error');
      setAlertMessage(`Failed to update connector: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleSaveSettings = async (id: ConnectorId, settings: ConnectorSettings) => {
    try {
      if (!window.applyPilotAPI?.connectors) return;
      const updated = await window.applyPilotAPI.connectors.update(id, { settings });
      setData(updated);
      setAlertType('success');
      setAlertMessage(
        `Configuration for "${id}" saved successfully to data/connectors/connectors.json.`
      );
    } catch (err) {
      setAlertType('error');
      setAlertMessage(`Failed to save settings: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleTestConnection = async (id: ConnectorId) => {
    try {
      if (!window.applyPilotAPI?.connectors) return;
      const tested = await window.applyPilotAPI.connectors.testConnection(id);
      setData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          connectors: prev.connectors.map((c) => (c.id === id ? tested : c)),
        };
      });
      setAlertType('success');
      setAlertMessage(
        `Connection check completed for "${id}": Status accurately recorded as ${tested.connectionStatus}.`
      );
    } catch (err) {
      setAlertType('error');
      setAlertMessage(`Failed to test connection: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const connectors = data?.connectors || [];
  const enabledCount = connectors.filter((c) => c.isEnabled).length;

  return (
    <div className="connectors-view">
      <header className="workspace-hero">
        <div>
          <h1 className="workspace-title">Job Board Connectors</h1>
          <p className="workspace-desc">
            Manage persistent job source configurations. Non-sensitive connector preferences and statuses are persisted locally in <code>data/connectors/connectors.json</code>.
          </p>
        </div>

        <div>
          <Button
            variant="secondary"
            onClick={loadData}
            disabled={isLoading}
            aria-label="Refresh connector list"
          >
            {isLoading ? 'Refreshing...' : 'Refresh List'}
          </Button>
        </div>
      </header>

      {/* Alert Banner */}
      {alertMessage && (
        <div
          className={`demo-result demo-result--${alertType}`}
          id="connector-alert-banner"
          role="status"
        >
          {alertMessage}
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="connectors-stats-grid">
        <div className="connectors-stat-card">
          <span className="connectors-stat-label">Total Sources</span>
          <span className="connectors-stat-value">{connectors.length}</span>
          <span className="connectors-stat-subtext">7 Global & Regional Portals</span>
        </div>

        <div className="connectors-stat-card">
          <span className="connectors-stat-label">Active / Enabled</span>
          <span className="connectors-stat-value" style={{ color: 'var(--color-primary)' }}>
            {enabledCount} of {connectors.length}
          </span>
          <span className="connectors-stat-subtext">Configured for sync</span>
        </div>

        <div className="connectors-stat-card">
          <span className="connectors-stat-label">Storage Backend</span>
          <span className="connectors-stat-value" style={{ fontSize: 'var(--font-size-base)' }}>
            JSON Persistence
          </span>
          <span className="connectors-stat-subtext">data/connectors/connectors.json</span>
        </div>

        <div className="connectors-stat-card">
          <span className="connectors-stat-label">Integration Roadmap</span>
          <span className="connectors-stat-value" style={{ fontSize: 'var(--font-size-base)' }}>
            Foundation Ready
          </span>
          <span className="connectors-stat-subtext">Planned & Requires-Setup</span>
        </div>
      </div>

      {/* Grid of Connectors */}
      <div className="connectors-grid">
        {connectors.map((connector: ConnectorConfig) => (
          <ConnectorCard
            key={connector.id}
            connector={connector}
            onToggleEnable={handleToggleEnable}
            onSaveSettings={handleSaveSettings}
            onTestConnection={handleTestConnection}
          />
        ))}
      </div>
    </div>
  );
};
