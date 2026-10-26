export interface AIProvider {
  readonly id: string;
  readonly name: string;
  readonly providerType: string;
  readonly baseUrl: string | null;
  readonly authType: string;
  readonly credentialReference: string | null;
  readonly isEnabled: boolean;
  readonly configurationJson: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AIModel {
  readonly id: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly displayName: string | null;
  readonly capabilitiesJson: string;
  readonly modelConfigurationJson: string;
  readonly isEnabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AIFeatureSetting {
  readonly id: string;
  readonly featureKey: 'resume_optimization' | 'resume_tailoring' | 'application_answers' | 'chatbot' | string;
  readonly modelId: string | null;
  readonly isEnabled: boolean;
  readonly configurationJson: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
