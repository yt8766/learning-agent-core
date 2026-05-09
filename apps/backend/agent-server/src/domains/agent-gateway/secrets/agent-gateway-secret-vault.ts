import { Injectable } from '@nestjs/common';

export const AGENT_GATEWAY_SECRET_VAULT = Symbol('AGENT_GATEWAY_SECRET_VAULT');

export interface AgentGatewaySecretVault {
  writeProviderSecretRef(providerId: string, secretRef: string): Promise<void>;
  deleteProviderSecretRef(providerId: string): Promise<void>;
  readProviderSecretRef(providerId: string): Promise<string | undefined>;
  writeCredentialFileContent(credentialFileId: string, content: string): Promise<void>;
  deleteCredentialFileContent(credentialFileId: string): Promise<void>;
  readCredentialFileContent(credentialFileId: string): Promise<string | undefined>;
}

@Injectable()
export class MemoryAgentGatewaySecretVault implements AgentGatewaySecretVault {
  private readonly providerSecretRefs = new Map<string, string>();

  private readonly credentialFileContents = new Map<string, string>();

  async writeProviderSecretRef(providerId: string, secretRef: string): Promise<void> {
    this.providerSecretRefs.set(providerId, secretRef);
  }

  async deleteProviderSecretRef(providerId: string): Promise<void> {
    this.providerSecretRefs.delete(providerId);
  }

  async readProviderSecretRef(providerId: string): Promise<string | undefined> {
    return this.providerSecretRefs.get(providerId);
  }

  async writeCredentialFileContent(credentialFileId: string, content: string): Promise<void> {
    this.credentialFileContents.set(credentialFileId, content);
  }

  async deleteCredentialFileContent(credentialFileId: string): Promise<void> {
    this.credentialFileContents.delete(credentialFileId);
  }

  async readCredentialFileContent(credentialFileId: string): Promise<string | undefined> {
    return this.credentialFileContents.get(credentialFileId);
  }
}
