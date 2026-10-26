import {
  ConnectorConfig,
  ConnectorConnectionStatus,
  ConnectorsFileSchema,
  ConnectorImplementationStatus,
  deriveSetupStatus,
  isConnectorSetupComplete,
  isConnectorSettings,
} from './connectorSchema.js';

export const createDefaultConnectors = (): ConnectorsFileSchema => {
  const timestamp = new Date().toISOString();
  return {
    version: 1,
    updatedAt: timestamp,
    connectors: [
      {
        id: 'hiringcafe',
        name: 'HiringCafe',
        description: 'Direct employer career board aggregator specializing in tech and remote roles.',
        isEnabled: false,
        state: 'configured',
        implementationStatus: 'configured',
        connectionStatus: 'not_tested',
        lastCheckedAt: null,
        statusMessage: 'Not tested — external job search client scheduled in future chunk.',
        settings: {
          locationPreference: 'Remote',
          refreshIntervalHours: 6,
          fetchLimit: 25,
          workplaceType: 'remote',
          targetKeywords: [],
        },
      },
      {
        id: 'naukri',
        name: 'Naukri',
        description: 'Leading job portal for India and APAC tech, engineering, and enterprise opportunities.',
        isEnabled: false,
        state: 'configured',
        implementationStatus: 'configured',
        connectionStatus: 'not_tested',
        lastCheckedAt: null,
        statusMessage: 'Not tested — portal search client scheduled in future chunk.',
        settings: {
          locationPreference: 'India',
          refreshIntervalHours: 12,
          fetchLimit: 25,
          workplaceType: 'any',
          targetKeywords: [],
        },
      },
      {
        id: 'indeed',
        name: 'Indeed',
        description: 'Comprehensive global job portal indexing enterprise and startup openings worldwide.',
        isEnabled: false,
        state: 'configured',
        implementationStatus: 'configured',
        connectionStatus: 'not_tested',
        lastCheckedAt: null,
        statusMessage: 'Not tested — feed indexing client scheduled in future chunk.',
        settings: {
          locationPreference: 'Worldwide',
          refreshIntervalHours: 12,
          fetchLimit: 25,
          workplaceType: 'any',
          targetKeywords: [],
        },
      },
      {
        id: 'linkedin',
        name: 'LinkedIn',
        description: 'Global professional network featuring verified company job listings and talent posts.',
        isEnabled: false,
        state: 'requires_setup',
        implementationStatus: 'requires_setup',
        connectionStatus: 'not_tested',
        lastCheckedAt: null,
        statusMessage: 'Setup required — location preference must be configured in Configure before testing.',
        settings: {
          locationPreference: '',
          refreshIntervalHours: 12,
          fetchLimit: 25,
          workplaceType: 'any',
          targetKeywords: [],
          easyApplyOnly: false,
        },
      },
      {
        id: 'wellfound',
        name: 'Wellfound',
        description: 'Startup recruitment platform connecting engineers with seed-to-scale ventures.',
        isEnabled: false,
        state: 'requires_setup',
        implementationStatus: 'requires_setup',
        connectionStatus: 'not_tested',
        lastCheckedAt: null,
        statusMessage: 'Setup required — location preference must be configured in Configure before testing.',
        settings: {
          locationPreference: '',
          refreshIntervalHours: 12,
          fetchLimit: 25,
          workplaceType: 'remote',
          targetKeywords: [],
        },
      },
      {
        id: 'instahyre',
        name: 'Instahyre',
        description: 'AI-curated recruitment platform focusing on premium tech and product jobs in India.',
        isEnabled: false,
        state: 'requires_setup',
        implementationStatus: 'requires_setup',
        connectionStatus: 'not_tested',
        lastCheckedAt: null,
        statusMessage: 'Setup required — location preference must be configured in Configure before testing.',
        settings: {
          locationPreference: '',
          refreshIntervalHours: 24,
          fetchLimit: 25,
          workplaceType: 'any',
          targetKeywords: [],
        },
      },
      {
        id: 'hirist',
        name: 'Hirist',
        description: 'Specialized tech careers portal for software engineering, cloud, and data leadership.',
        isEnabled: false,
        state: 'configured',
        implementationStatus: 'configured',
        connectionStatus: 'not_tested',
        lastCheckedAt: null,
        statusMessage: 'Not tested — tech job feed connector scheduled for subsequent chunk.',
        settings: {
          locationPreference: 'India',
          refreshIntervalHours: 12,
          fetchLimit: 25,
          workplaceType: 'any',
          targetKeywords: [],
        },
      },
    ],
  };
};

export const reconcileConnectors = (raw: unknown): ConnectorsFileSchema => {
  const defaults = createDefaultConnectors();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return defaults;
  }

  const rawObj = raw as Record<string, unknown>;
  const rawList = Array.isArray(rawObj.connectors) ? rawObj.connectors : [];
  const existingMap = new Map<string, unknown>();

  for (const item of rawList) {
    if (item && typeof item === 'object' && 'id' in item && typeof item.id === 'string') {
      existingMap.set(item.id, item);
    }
  }

  const validConnectionStatuses: readonly ConnectorConnectionStatus[] = [
    'not_tested',
    'not_configured',
    'check_unavailable',
    'not_connected',
    'connected',
    'error',
  ];

  const reconciledList: ConnectorConfig[] = defaults.connectors.map((def) => {
    const existing = existingMap.get(def.id) as Record<string, unknown> | undefined;
    if (!existing) {
      return def;
    }

    const isEnabled = typeof existing.isEnabled === 'boolean' ? existing.isEnabled : def.isEnabled;
    const settings = isConnectorSettings(existing.settings)
      ? existing.settings
      : def.settings;

    // Dynamically derive setup status based on whether required configuration is genuinely missing
    const isSetupComplete = isConnectorSetupComplete(settings);
    const implementationStatus: ConnectorImplementationStatus = deriveSetupStatus(settings);

    // If lastCheckedAt is null, connection status is always not_tested
    const lastCheckedAt = typeof existing.lastCheckedAt === 'string' ? existing.lastCheckedAt : null;
    let connectionStatus: ConnectorConnectionStatus = 'not_tested';
    if (lastCheckedAt !== null && typeof existing.connectionStatus === 'string') {
      if (validConnectionStatuses.includes(existing.connectionStatus as ConnectorConnectionStatus)) {
        connectionStatus = existing.connectionStatus as ConnectorConnectionStatus;
      } else {
        connectionStatus = 'not_configured';
      }
    }

    let statusMessage = typeof existing.statusMessage === 'string' ? existing.statusMessage : def.statusMessage;
    if (isSetupComplete && lastCheckedAt === null) {
      if (statusMessage.includes('Setup required') || statusMessage.includes('location preference must be configured')) {
        statusMessage = 'Configuration saved. Connection not tested — click Check Connection to test.';
      }
    } else if (!isSetupComplete && lastCheckedAt === null) {
      statusMessage = 'Setup required — location preference must be configured in Configure before testing.';
    }

    return {
      ...def,
      isEnabled,
      state: implementationStatus,
      implementationStatus,
      connectionStatus,
      lastCheckedAt,
      statusMessage,
      settings,
    };
  });

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    connectors: reconciledList,
  };
};
