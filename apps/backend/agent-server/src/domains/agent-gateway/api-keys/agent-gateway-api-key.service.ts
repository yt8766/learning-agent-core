import { Inject, Injectable } from '@nestjs/common';
import type {
  GatewayApiKeyListResponse,
  GatewayDeleteApiKeyRequest,
  GatewayReplaceApiKeysRequest,
  GatewayUpdateApiKeyRequest
} from '@agent/core';
import type { AgentGatewayManagementClient } from '../management/agent-gateway-management-client';
import { AGENT_GATEWAY_MANAGEMENT_CLIENT } from '../management/agent-gateway-management-client';

@Injectable()
export class AgentGatewayApiKeyService {
  constructor(
    @Inject(AGENT_GATEWAY_MANAGEMENT_CLIENT) private readonly managementClient: AgentGatewayManagementClient
  ) {}

  list(): Promise<GatewayApiKeyListResponse> {
    return this.managementClient.listApiKeys();
  }

  replace(request: GatewayReplaceApiKeysRequest): Promise<GatewayApiKeyListResponse> {
    return this.managementClient.replaceApiKeys(request);
  }

  update(request: GatewayUpdateApiKeyRequest): Promise<GatewayApiKeyListResponse> {
    return this.managementClient.updateApiKey(request);
  }

  delete(request: GatewayDeleteApiKeyRequest): Promise<GatewayApiKeyListResponse> {
    return this.managementClient.deleteApiKey(request);
  }
}
