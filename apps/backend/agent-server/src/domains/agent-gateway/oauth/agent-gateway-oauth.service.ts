import { Inject, Injectable, Optional } from '@nestjs/common';
import type {
  GatewayCompleteOAuthRequest,
  GatewayCompleteOAuthResponse,
  GatewayStartOAuthRequest,
  GatewayStartOAuthResponse
} from '@agent/core';
import type { AgentGatewayRepository } from '../repositories/agent-gateway.repository';
import { AGENT_GATEWAY_REPOSITORY } from '../repositories/agent-gateway.repository';

interface AgentGatewayOAuthFlow {
  flowId: string;
  providerId: string;
  credentialFileId: string;
  userCode: string;
  expiresAt: string;
}

export const AGENT_GATEWAY_NOW = Symbol('AGENT_GATEWAY_NOW');

@Injectable()
export class AgentGatewayOAuthService {
  private readonly flows = new Map<string, AgentGatewayOAuthFlow>();

  constructor(
    @Inject(AGENT_GATEWAY_REPOSITORY) private readonly repository: AgentGatewayRepository,
    @Optional()
    @Inject(AGENT_GATEWAY_NOW)
    private readonly now: () => Date = () => new Date()
  ) {}

  async start(request: GatewayStartOAuthRequest): Promise<GatewayStartOAuthResponse> {
    const flowId = this.flowId(request.providerId, request.credentialFileId);
    const flow = {
      flowId,
      providerId: request.providerId,
      credentialFileId: request.credentialFileId,
      userCode: this.userCode(request.providerId, request.credentialFileId),
      expiresAt: new Date(this.now().getTime() + 15 * 60 * 1000).toISOString()
    };
    this.flows.set(flowId, flow);
    return {
      ...flow,
      verificationUri: `https://gateway.local/oauth/verify/${flowId}`
    };
  }

  async complete(request: GatewayCompleteOAuthRequest): Promise<GatewayCompleteOAuthResponse> {
    const flow = this.flows.get(request.flowId);
    if (!flow || flow.userCode !== request.userCode) throw new Error('Gateway OAuth flow code mismatch');
    if (Date.parse(flow.expiresAt) < this.now().getTime()) throw new Error('Gateway OAuth flow expired');

    const current = (await this.repository.listCredentialFiles()).find(file => file.id === flow.credentialFileId);
    if (!current) throw new Error(`Gateway credential file not found: ${flow.credentialFileId}`);

    const completedAt = this.now().toISOString();
    const credentialFile = await this.repository.upsertCredentialFile({
      ...current,
      status: 'valid',
      lastCheckedAt: completedAt
    });
    this.flows.delete(request.flowId);

    return {
      flowId: flow.flowId,
      providerId: flow.providerId,
      credentialFileId: flow.credentialFileId,
      status: 'valid',
      completedAt,
      credentialFile
    };
  }

  private flowId(providerId: string, credentialFileId: string): string {
    return `oauth-${providerId}-${credentialFileId}`;
  }

  private userCode(providerId: string, credentialFileId: string): string {
    return `CODE-${providerId}-${credentialFileId}`;
  }
}
