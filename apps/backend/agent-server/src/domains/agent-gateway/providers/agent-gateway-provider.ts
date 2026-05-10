import type { GatewayRelayRequest, GatewayRelayResponse } from '@agent/core';

export const AGENT_GATEWAY_PROVIDERS = Symbol('AGENT_GATEWAY_PROVIDERS');

export interface AgentGatewayProvider {
  readonly providerId: string;
  complete(request: GatewayRelayRequest): Promise<Omit<GatewayRelayResponse, 'id' | 'providerId' | 'logId'>>;
}
