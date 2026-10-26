import { ipcMain } from 'electron';
import {
  loadConnectors,
  updateConnector,
  testConnectorConnection,
} from '../storage/jsonConnectorRepository.js';
import {
  ConnectorConfig,
  ConnectorsFileSchema,
  isConnectorId,
  isConnectorSettings,
  isPartialConnectorSettings,
  hasSensitiveKeys,
} from '../storage/connectorSchema.js';

export const CONNECTORS_IPC_CHANNELS = {
  GET_ALL: 'connectors:get-all',
  UPDATE: 'connectors:update',
  TEST_CONNECTION: 'connectors:test-connection',
} as const;

export const registerConnectorsIpcHandlers = (): void => {
  // 1. Get all connectors configuration and status
  ipcMain.handle(
    CONNECTORS_IPC_CHANNELS.GET_ALL,
    async (): Promise<ConnectorsFileSchema> => {
      return loadConnectors();
    }
  );

  // 2. Update a connector's enabled status or settings
  ipcMain.handle(
    CONNECTORS_IPC_CHANNELS.UPDATE,
    async (_event, payload: unknown): Promise<ConnectorsFileSchema> => {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('Invalid update payload: expected an object.');
      }

      if (hasSensitiveKeys(payload)) {
        throw new Error('Disallowed sensitive keys detected in connector update.');
      }

      const p = payload as Record<string, unknown>;
      if (!isConnectorId(p.id)) {
        throw new Error(`Invalid connector ID provided: "${String(p.id)}"`);
      }

      if (p.isEnabled !== undefined && typeof p.isEnabled !== 'boolean') {
        throw new Error('Invalid isEnabled value: must be a boolean.');
      }

      if (p.settings !== undefined && !isPartialConnectorSettings(p.settings)) {
        throw new Error('Invalid connector settings provided.');
      }

      return updateConnector(p.id, {
        isEnabled: p.isEnabled as boolean | undefined,
        settings: p.settings as any,
      });
    }
  );

  // 3. Test connection for a connector
  ipcMain.handle(
    CONNECTORS_IPC_CHANNELS.TEST_CONNECTION,
    async (_event, payload: unknown): Promise<ConnectorConfig> => {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('Invalid test-connection payload: expected an object.');
      }

      const p = payload as Record<string, unknown>;
      if (!isConnectorId(p.id)) {
        throw new Error(`Invalid connector ID provided: "${String(p.id)}"`);
      }

      return testConnectorConnection(p.id);
    }
  );
};
