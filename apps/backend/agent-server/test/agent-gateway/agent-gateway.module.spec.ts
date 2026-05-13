import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentGatewayModule } from '../../src/domains/agent-gateway/agent-gateway.module';
import { AGENT_GATEWAY_MANAGEMENT_CLIENT } from '../../src/domains/agent-gateway/management/agent-gateway-management-client';
import { CliProxyManagementClient } from '../../src/domains/agent-gateway/management/cli-proxy-management-client';
import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';
import { AgentGatewayOAuthService } from '../../src/domains/agent-gateway/oauth/agent-gateway-oauth.service';
import { AGENT_GATEWAY_CLIENT_REPOSITORY } from '../../src/domains/agent-gateway/clients/agent-gateway-client.repository';
import { AGENT_GATEWAY_REPOSITORY } from '../../src/domains/agent-gateway/repositories/agent-gateway.repository';
import {
  PostgresAgentGatewayClientRepository,
  PostgresAgentGatewayRepository,
  PostgresAgentGatewaySecretVault
} from '../../src/domains/agent-gateway/persistence/postgres-agent-gateway.repository';
import { AGENT_GATEWAY_SECRET_VAULT } from '../../src/domains/agent-gateway/secrets/agent-gateway-secret-vault';

describe('AgentGatewayModule', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

  it('uses postgres persistence and secret vault when configured', async () => {
    vi.stubEnv('AGENT_GATEWAY_PERSISTENCE', 'postgres');
    vi.stubEnv('AGENT_GATEWAY_DATABASE_URL', 'postgres://gateway');

    const moduleRef = await Test.createTestingModule({ imports: [AgentGatewayModule] }).compile();

    expect(moduleRef.get(AGENT_GATEWAY_REPOSITORY)).toBeInstanceOf(PostgresAgentGatewayRepository);
    expect(moduleRef.get(AGENT_GATEWAY_CLIENT_REPOSITORY)).toBeInstanceOf(PostgresAgentGatewayClientRepository);
    expect(moduleRef.get(AGENT_GATEWAY_SECRET_VAULT)).toBeInstanceOf(PostgresAgentGatewaySecretVault);
  });
});
