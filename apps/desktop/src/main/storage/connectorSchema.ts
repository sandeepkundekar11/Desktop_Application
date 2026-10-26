export type ConnectorId =
  | 'hiringcafe'
  | 'naukri'
  | 'indeed'
  | 'linkedin'
  | 'wellfound'
  | 'instahyre'
  | 'hirist';

export const SUPPORTED_CONNECTOR_IDS: readonly ConnectorId[] = [
  'hiringcafe',
  'naukri',
  'indeed',
  'linkedin',
  'wellfound',
  'instahyre',
  'hirist',
] as const;

export type ConnectorState =
  | 'planned'
  | 'requires_setup'
  | 'configured'
  | 'available'
  | 'connected'
  | 'unavailable';

export type ConnectorImplementationStatus =
  | 'planned'
  | 'requires_setup'
  | 'configured'
  | 'available'
  | 'unavailable';

export type ConnectorConnectionStatus =
  | 'not_tested'
  | 'not_configured'
  | 'check_unavailable'
  | 'not_connected'
  | 'connected'
  | 'error';

export const isConnectorSetupComplete = (settings: unknown): boolean => {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return false;
  const s = settings as Record<string, unknown>;
  const loc = typeof s.locationPreference === 'string' ? s.locationPreference.trim() : '';
  const interval = typeof s.refreshIntervalHours === 'number' ? s.refreshIntervalHours : 0;
  const limit = typeof s.fetchLimit === 'number' ? s.fetchLimit : 0;
  return loc.length > 0 && interval > 0 && limit > 0;
};

export const deriveSetupStatus = (settings: unknown): ConnectorImplementationStatus => {
  return isConnectorSetupComplete(settings) ? 'configured' : 'requires_setup';
};

export interface ConnectorSettings {
  readonly locationPreference: string;
  readonly refreshIntervalHours: number;
  readonly fetchLimit: number;
  readonly workplaceType?: string;
  readonly targetKeywords?: readonly string[];
  readonly easyApplyOnly?: boolean;
}

export interface ConnectorConfig {
  readonly id: ConnectorId;
  readonly name: string;
  readonly description: string;
  readonly isEnabled: boolean;
  readonly state: ConnectorState;
  readonly implementationStatus: ConnectorImplementationStatus;
  readonly connectionStatus: ConnectorConnectionStatus;
  readonly lastCheckedAt: string | null;
  readonly statusMessage: string;
  readonly settings: ConnectorSettings;
}

export interface ConnectorsFileSchema {
  readonly version: number;
  readonly updatedAt: string;
  readonly connectors: readonly ConnectorConfig[];
}

const DISALLOWED_SENSITIVE_KEY_PATTERN = /(password|secret|token|cookie|auth|api_key|credential|private_key)/i;

export const hasSensitiveKeys = (obj: unknown): boolean => {
  if (!obj || typeof obj !== 'object') return false;
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (DISALLOWED_SENSITIVE_KEY_PATTERN.test(key)) {
      return true;
    }
    if (typeof val === 'object' && val !== null && hasSensitiveKeys(val)) {
      return true;
    }
  }
  return false;
};

export const isConnectorId = (val: unknown): val is ConnectorId => {
  return typeof val === 'string' && (SUPPORTED_CONNECTOR_IDS as readonly string[]).includes(val);
};

export const isConnectorSettings = (val: unknown): val is ConnectorSettings => {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
  if (hasSensitiveKeys(val)) return false;
  const s = val as Record<string, unknown>;

  if (typeof s.locationPreference !== 'string') return false;
  if (typeof s.refreshIntervalHours !== 'number' || s.refreshIntervalHours <= 0) return false;
  if (typeof s.fetchLimit !== 'number' || s.fetchLimit <= 0) return false;
  if (s.workplaceType !== undefined && typeof s.workplaceType !== 'string') return false;
  if (s.easyApplyOnly !== undefined && typeof s.easyApplyOnly !== 'boolean') return false;
  if (s.targetKeywords !== undefined) {
    if (!Array.isArray(s.targetKeywords) || !s.targetKeywords.every((k) => typeof k === 'string')) {
      return false;
    }
  }
  return true;
};

export const isPartialConnectorSettings = (val: unknown): boolean => {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
  if (hasSensitiveKeys(val)) return false;
  const s = val as Record<string, unknown>;

  if (s.locationPreference !== undefined && typeof s.locationPreference !== 'string') return false;
  if (s.refreshIntervalHours !== undefined && (typeof s.refreshIntervalHours !== 'number' || s.refreshIntervalHours <= 0)) {
    return false;
  }
  if (s.fetchLimit !== undefined && (typeof s.fetchLimit !== 'number' || s.fetchLimit <= 0)) {
    return false;
  }
  if (s.workplaceType !== undefined && typeof s.workplaceType !== 'string') return false;
  if (s.easyApplyOnly !== undefined && typeof s.easyApplyOnly !== 'boolean') return false;
  if (s.targetKeywords !== undefined) {
    if (!Array.isArray(s.targetKeywords) || !s.targetKeywords.every((k) => typeof k === 'string')) {
      return false;
    }
  }
  return true;
};

export const isConnectorConfig = (val: unknown): val is ConnectorConfig => {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
  const c = val as Record<string, unknown>;

  return (
    isConnectorId(c.id) &&
    typeof c.name === 'string' &&
    typeof c.description === 'string' &&
    typeof c.isEnabled === 'boolean' &&
    typeof c.implementationStatus === 'string' &&
    typeof c.connectionStatus === 'string' &&
    (c.lastCheckedAt === null || typeof c.lastCheckedAt === 'string') &&
    typeof c.statusMessage === 'string' &&
    isConnectorSettings(c.settings)
  );
};

export const isConnectorsFileSchema = (val: unknown): val is ConnectorsFileSchema => {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
  const f = val as Record<string, unknown>;

  if (typeof f.version !== 'number' || typeof f.updatedAt !== 'string') {
    return false;
  }
  if (!Array.isArray(f.connectors)) {
    return false;
  }
  if (!f.connectors.every(isConnectorConfig)) {
    return false;
  }

  // Ensure all 7 connectors are present
  const ids = new Set(f.connectors.map((c: ConnectorConfig) => c.id));
  return SUPPORTED_CONNECTOR_IDS.every((id) => ids.has(id));
};

export { createDefaultConnectors, reconcileConnectors } from './connectorDefaults.js';
