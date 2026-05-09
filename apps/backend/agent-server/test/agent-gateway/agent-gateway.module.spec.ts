import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { AgentGatewayModule } from '../../src/domains/agent-gateway/agent-gateway.module';
import { AGENT_GATEWAY_MANAGEMENT_CLIENT } from '../../src/domains/agent-gateway/management/agent-gateway-management-client';
import { CliProxyManagementClient } from '../../src/domains/agent-gateway/management/cli-proxy-management-client';
import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';
import { AgentGatewayOAuthService } from '../../src/domains/agent-gateway/oauth/agent-gateway-oauth.service';

describe('AgentGatewayModule', () => {
  it('resolves the OAuth service through Nest dependency injection', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AgentGatewayModule] }).compile();

    expect(moduleRef.get(AgentGatewayOAuthService)).toBeInstanceOf(AgentGatewayOAuthService);
  });

  it('uses memory management client by default and CLI Proxy client when configured', async () => {
    const memoryModule = await Test.createTestingModule({ imports: [AgentGatewayModule] }).compile();
    expect(memoryModule.get(AGENT_GATEWAY_MANAGEMENT_CLIENT)).toBeInstanceOf(MemoryAgentGatewayManagementClient);

    process.env.AGENT_GATEWAY_MANAGEMENT_MODE = 'cli-proxy';
    process.env.AGENT_GATEWAY_MANAGEMENT_API_BASE = 'https://router.example.com';
    process.env.AGENT_GATEWAY_MANAGEMENT_KEY = 'mgmt-secret';
    try {
      const cliModule = await Test.createTestingModule({ imports: [AgentGatewayModule] }).compile();
      expect(cliModule.get(AGENT_GATEWAY_MANAGEMENT_CLIENT)).toBeInstanceOf(CliProxyManagementClient);
    } finally {
      delete process.env.AGENT_GATEWAY_MANAGEMENT_MODE;
      delete process.env.AGENT_GATEWAY_MANAGEMENT_API_BASE;
      delete process.env.AGENT_GATEWAY_MANAGEMENT_KEY;
    }
  });
});
