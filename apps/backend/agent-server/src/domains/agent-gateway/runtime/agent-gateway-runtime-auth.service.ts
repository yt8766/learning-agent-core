import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { GatewayClient } from '@agent/core';
import { hashSecret } from '../clients/agent-gateway-client-api-key.service';
import type { AgentGatewayClientRepository, StoredGatewayClientApiKey } from '../clients/agent-gateway-client.repository';
import { AGENT_GATEWAY_CLIENT_REPOSITORY } from '../clients/agent-gateway-client.repository';
import { openAIError } from './agent-gateway-openai-error';

export type GatewayRuntimeScope = 'models.read' | 'chat.completions';

export interface GatewayRuntimePrincipal {
  client: GatewayClient;
  apiKey: StoredGatewayClientApiKey;
}

@Injectable()
export class AgentGatewayRuntimeAuthService {
  constructor(@Inject(AGENT_GATEWAY_CLIENT_REPOSITORY) private readonly repository: AgentGatewayClientRepository) {}

  async authenticate(authorization: string | undefined, scope: GatewayRuntimeScope): Promise<GatewayRuntimePrincipal> {
    const secret = readBearerSecret(authorization);
    if (!secret) {
      throw new UnauthorizedException(openAIError('invalid_api_key', 'Missing proxy API key', 'authentication_error'));
    }

    const apiKey = await this.repository.findApiKeyByHash(hashSecret(secret));
    if (!apiKey || apiKey.status === 'revoked') {
      throw new UnauthorizedException(openAIError('invalid_api_key', 'Invalid proxy API key', 'authentication_error'));
    }
    if (apiKey.status !== 'active') {
      throw new ForbiddenException(openAIError('api_key_disabled', 'Proxy API key is disabled', 'permission_error'));
    }
    if (apiKey.expiresAt && Date.parse(apiKey.expiresAt) <= Date.now()) {
      throw new UnauthorizedException(openAIError('invalid_api_key', 'Proxy API key expired', 'authentication_error'));
    }
    if (!apiKey.scopes.includes(scope)) {
      throw new ForbiddenException(openAIError('insufficient_scope', 'Proxy API key scope is insufficient', 'permission_error'));
    }

    const client = await this.repository.findClient(apiKey.clientId);
    if (!client || client.status !== 'active') {
      throw new ForbiddenException(openAIError('client_disabled', 'Gateway client is disabled', 'permission_error'));
    }

    return { client, apiKey };
  }
}

function readBearerSecret(authorization: string | undefined): string {
  if (!authorization?.startsWith('Bearer ')) return '';
  return authorization.slice('Bearer '.length).trim();
}
