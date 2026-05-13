import { Inject, Injectable, Optional } from '@nestjs/common';
import type {
  GatewayCompleteOAuthRequest,
  GatewayCompleteOAuthResponse,
  GatewayStartOAuthRequest,
  GatewayStartOAuthResponse
} from '@agent/core';
import {
  AGENT_GATEWAY_OAUTH_PROVIDERS,
  createDefaultGatewayOAuthProviders,
  type GatewayOAuthFlowStatus,
  type GatewayOAuthProvider,
  type GatewayOAuthProviderCallbackRequest,
  type GatewayOAuthProviderPollResult,
  type GatewayOAuthProviderStartResult
} from '../runtime-engine/oauth';
import type { AgentGatewayRepository } from '../repositories/agent-gateway.repository';
import { AGENT_GATEWAY_REPOSITORY } from '../repositories/agent-gateway.repository';
import {
  AGENT_GATEWAY_SECRET_VAULT,
  MemoryAgentGatewaySecretVault,
  type AgentGatewaySecretVault
} from '../secrets/agent-gateway-secret-vault';

interface AgentGatewayOAuthFlow {
  start: GatewayOAuthProviderStartResult;
  status: GatewayOAuthFlowStatus;
  error?: string;
}

export const AGENT_GATEWAY_NOW = Symbol('AGENT_GATEWAY_NOW');

export interface GatewayOAuthStatusResponse {
  state: string;
  status: GatewayOAuthFlowStatus;
  providerId?: string;
  credentialFileId?: string;
  error?: string;
}

export interface GatewayOAuthCallbackResponse {
  flowId: string;
  providerId: string;
  credentialFileId: string;
  status: 'valid' | 'error';
  completedAt: string;
  credentialFile: GatewayCompleteOAuthResponse['credentialFile'];
  error?: string;
}

@Injectable()
export class AgentGatewayOAuthService {
  private readonly flows = new Map<string, AgentGatewayOAuthFlow>();

  private readonly secretVault: AgentGatewaySecretVault;

  private readonly providers: Map<string, GatewayOAuthProvider>;

  private readonly now: () => Date;

  constructor(
    @Inject(AGENT_GATEWAY_REPOSITORY) private readonly repository: AgentGatewayRepository,
    @Optional()
    @Inject(AGENT_GATEWAY_SECRET_VAULT)
    secretVaultOrNow?: AgentGatewaySecretVault | (() => Date),
    @Optional()
    @Inject(AGENT_GATEWAY_OAUTH_PROVIDERS)
    providers: GatewayOAuthProvider[] = [],
    @Optional()
    @Inject(AGENT_GATEWAY_NOW)
    now?: () => Date
  ) {
    if (typeof secretVaultOrNow === 'function') {
      this.secretVault = new MemoryAgentGatewaySecretVault();
      this.now = secretVaultOrNow;
    } else {
      this.secretVault = secretVaultOrNow ?? new MemoryAgentGatewaySecretVault();
      this.now = now ?? (() => new Date());
    }
    const providerList = providers.length > 0 ? providers : createDefaultGatewayOAuthProviders({ now: this.now });
    this.providers = new Map(providerList.map(provider => [provider.providerId, provider]));
  }

  async start(request: GatewayStartOAuthRequest): Promise<GatewayStartOAuthResponse> {
    const provider = this.provider(request.providerId);
    const start = await provider.start(request);
    this.flows.set(start.flowId, { start, status: 'pending' });
    await this.repository.upsertCredentialFile({
      id: request.credentialFileId,
      provider: request.providerId,
      path: `/agent-gateway/auth-files/${request.credentialFileId}`,
      status: 'missing',
      lastCheckedAt: this.now().toISOString()
    });
    return publicStartResult(start);
  }

  async complete(request: GatewayCompleteOAuthRequest): Promise<GatewayCompleteOAuthResponse> {
    const flow = this.flows.get(request.flowId);
    if (!flow || flow.start.userCode !== request.userCode) throw new Error('Gateway OAuth flow code mismatch');
    if (Date.parse(flow.start.expiresAt) < this.now().getTime()) throw new Error('Gateway OAuth flow expired');

    const response = await this.completeCallback({
      providerId: flow.start.providerId,
      state: request.flowId,
      code: request.userCode
    });
    return {
      flowId: response.flowId,
      providerId: response.providerId,
      credentialFileId: response.credentialFileId,
      status: 'valid',
      completedAt: response.completedAt,
      credentialFile: response.credentialFile
    };
  }

  async completeCallback(request: GatewayOAuthProviderCallbackRequest): Promise<GatewayOAuthCallbackResponse> {
    const flow = this.flows.get(request.state);
    if (!flow) throw new Error(`Gateway OAuth flow not found: ${request.state}`);
    if (flow.start.providerId !== request.providerId) throw new Error('Gateway OAuth provider mismatch');

    const provider = this.provider(request.providerId);
    const credential = await provider.completeCallback(request);
    const credentialFile = await this.persistCredential(provider, credential);

    flow.status = credential.status === 'valid' ? 'completed' : 'error';
    flow.error = credential.error;

    return {
      flowId: request.state,
      providerId: credential.providerId,
      credentialFileId: credential.credentialFileId,
      status: credential.status,
      completedAt: credential.completedAt,
      credentialFile,
      error: credential.error
    };
  }

  async status(state: string): Promise<GatewayOAuthStatusResponse> {
    const flow = this.flows.get(state);
    if (!flow) return { state, status: 'error', error: 'not_found' };
    if (flow.status === 'pending') {
      const provider = this.provider(flow.start.providerId);
      const pollResult = normalizePollResult(await provider.pollStatus(flow.start, this.now()));
      flow.status = pollResult.status;
      flow.error = pollResult.error;
      if (pollResult.credential) await this.persistCredential(provider, pollResult.credential);
    }
    return {
      state,
      status: flow.status,
      providerId: flow.start.providerId,
      credentialFileId: flow.start.credentialFileId,
      error: flow.error
    };
  }

  private provider(providerId: string): GatewayOAuthProvider {
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`Gateway OAuth provider not configured: ${providerId}`);
    return provider;
  }

  private async persistCredential(
    provider: GatewayOAuthProvider,
    credential: Awaited<ReturnType<GatewayOAuthProvider['completeCallback']>>
  ): Promise<GatewayCompleteOAuthResponse['credentialFile']> {
    await this.secretVault.writeCredentialFileContent(
      credential.credentialFileId,
      JSON.stringify(credential.secretPayload)
    );
    await this.secretVault.writeProviderSecretRef(credential.providerId, credential.secretRef);
    return this.repository.upsertCredentialFile(provider.projectAuthFile(credential));
  }
}

function normalizePollResult(
  result: GatewayOAuthFlowStatus | GatewayOAuthProviderPollResult
): GatewayOAuthProviderPollResult {
  return typeof result === 'string' ? { status: result } : result;
}

function publicStartResult(start: GatewayOAuthProviderStartResult): GatewayStartOAuthResponse {
  const { internal: _internal, ...publicResult } = start;
  return publicResult;
}
