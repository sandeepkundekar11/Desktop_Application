import { getTargetStorageLocations } from './targetStorageLocations.js';
import { readJsonSafe, writeJsonAtomic, withFileLock } from './atomicFileWriter.js';
import {
  ConnectorId,
  ConnectorConfig,
  ConnectorConnectionStatus,
  ConnectorsFileSchema,
  ConnectorSettings,
  createDefaultConnectors,
  isConnectorsFileSchema,
  reconcileConnectors,
  isConnectorId,
  hasSensitiveKeys,
  deriveSetupStatus,
  isConnectorSetupComplete,
} from './connectorSchema.js';

export const loadConnectors = (overrideRoot?: string): ConnectorsFileSchema => {
  const locations = getTargetStorageLocations(overrideRoot);
  const data = readJsonSafe<unknown>(locations.connectorsFile, null);

  if (isConnectorsFileSchema(data)) {
    return data;
  }

  // Reconcile and safely heal or initialize
  const reconciled = reconcileConnectors(data);
  writeJsonAtomic(locations.connectorsFile, reconciled);
  return reconciled;
};

export const saveConnectors = (
  data: ConnectorsFileSchema,
  overrideRoot?: string
): void => {
  if (hasSensitiveKeys(data)) {
    throw new Error('Disallowed sensitive keys detected in connector payload.');
  }

  if (!isConnectorsFileSchema(data)) {
    throw new Error('Invalid connectors file schema provided.');
  }

  const locations = getTargetStorageLocations(overrideRoot);
  writeJsonAtomic(locations.connectorsFile, data);
};

export interface ConnectorUpdateParams {
  readonly isEnabled?: boolean;
  readonly settings?: Partial<ConnectorSettings>;
}

export const updateConnector = async (
  id: ConnectorId,
  updates: ConnectorUpdateParams,
  overrideRoot?: string
): Promise<ConnectorsFileSchema> => {
  if (!isConnectorId(id)) {
    throw new Error(`Invalid connector ID: "${String(id)}"`);
  }

  if (hasSensitiveKeys(updates)) {
    throw new Error('Disallowed sensitive fields detected in update payload.');
  }

  const locations = getTargetStorageLocations(overrideRoot);

  return withFileLock(locations.connectorsFile, async () => {
    const current = loadConnectors(overrideRoot);
    const existingIndex = current.connectors.findIndex((c) => c.id === id);

    const existing = current.connectors[existingIndex];
    if (!existing) {
      throw new Error(`Connector with ID "${id}" not found.`);
    }

    const updatedSettings: ConnectorSettings = {
      ...existing.settings,
      ...(updates.settings || {}),
    };

    const isSetupComplete = isConnectorSetupComplete(updatedSettings);
    const setupStatus = deriveSetupStatus(updatedSettings);

    // A valid saved location clears the location-specific setup diagnostic
    let statusMessage = existing.statusMessage;
    if (isSetupComplete) {
      if (
        !statusMessage ||
        statusMessage.includes('Setup required') ||
        statusMessage.includes('location preference must be configured')
      ) {
        statusMessage = existing.lastCheckedAt
          ? existing.statusMessage
          : 'Configuration saved. Connection not tested — click Check Connection to test.';
      }
    } else {
      statusMessage = 'Setup required — location preference must be configured in Configure before testing.';
    }

    const updatedConnector: ConnectorConfig = {
      id: existing.id,
      name: existing.name,
      description: existing.description,
      state: setupStatus,
      implementationStatus: setupStatus,
      connectionStatus: existing.connectionStatus,
      lastCheckedAt: existing.lastCheckedAt,
      statusMessage,
      isEnabled: typeof updates.isEnabled === 'boolean' ? updates.isEnabled : existing.isEnabled,
      settings: updatedSettings,
    };

    const nextConnectors = [...current.connectors];
    nextConnectors[existingIndex] = updatedConnector;

    const nextFile: ConnectorsFileSchema = {
      version: current.version,
      updatedAt: new Date().toISOString(),
      connectors: nextConnectors,
    };

    saveConnectors(nextFile, overrideRoot);
    return nextFile;
  });
};

export const testConnectorConnection = async (
  id: ConnectorId,
  overrideRoot?: string
): Promise<ConnectorConfig> => {
  if (!isConnectorId(id)) {
    throw new Error(`Invalid connector ID: "${String(id)}"`);
  }

  const locations = getTargetStorageLocations(overrideRoot);

  return withFileLock(locations.connectorsFile, async () => {
    const current = loadConnectors(overrideRoot);
    const existingIndex = current.connectors.findIndex((c) => c.id === id);

    const existing = current.connectors[existingIndex];
    if (!existing) {
      throw new Error(`Connector with ID "${id}" not found.`);
    }

    const timestamp = new Date().toISOString();
    const timeStr = new Date(timestamp).toLocaleTimeString();

    // 1. Genuine check of local configuration completeness
    const isConfigComplete = isConnectorSetupComplete(existing.settings);
    const setupStatus = deriveSetupStatus(existing.settings);

    let connectionStatus: ConnectorConnectionStatus;
    let statusMsg: string;

    if (!isConfigComplete) {
      connectionStatus = 'not_configured';
      statusMsg = `Checked at ${timeStr}: Configuration incomplete. A valid location preference must be saved in Configure before testing connection.`;
    } else if (['linkedin', 'wellfound', 'instahyre'].includes(id)) {
      // 2. Integration & authentication prerequisites check
      connectionStatus = 'not_configured';
      statusMsg = `Checked at ${timeStr}: Authentication required. ${existing.name} requires an authenticated user session or API credentials, which are not yet implemented or configured.`;
    } else {
      // 3. Planned external search feed platforms
      connectionStatus = 'check_unavailable';
      statusMsg = `Checked at ${timeStr}: Configuration valid (${existing.settings.locationPreference}, ${existing.settings.refreshIntervalHours}h sync). Integration search client is planned in future phase; connection check is unavailable.`;
    }

    const testedConnector: ConnectorConfig = {
      id: existing.id,
      name: existing.name,
      description: existing.description,
      isEnabled: existing.isEnabled,
      state: setupStatus,
      implementationStatus: setupStatus,
      connectionStatus,
      lastCheckedAt: timestamp,
      statusMessage: statusMsg,
      settings: existing.settings,
    };

    const nextConnectors = [...current.connectors];
    nextConnectors[existingIndex] = testedConnector;

    const nextFile: ConnectorsFileSchema = {
      version: current.version,
      updatedAt: timestamp,
      connectors: nextConnectors,
    };

    saveConnectors(nextFile, overrideRoot);
    return testedConnector;
  });
};
