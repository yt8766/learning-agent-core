import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { AgentGatewayController } from '../../src/api/agent-gateway/agent-gateway.controller';
import { AgentGatewayService } from '../../src/domains/agent-gateway/services/agent-gateway.service';
import { AgentGatewayRelayService } from '../../src/domains/agent-gateway/runtime/agent-gateway-relay.service';
import { AgentGatewayOAuthService } from '../../src/domains/agent-gateway/oauth/agent-gateway-oauth.service';
import { AgentGatewayConnectionService } from '../../src/domains/agent-gateway/management/agent-gateway-connection.service';
import { AgentGatewayConfigFileService } from '../../src/domains/agent-gateway/config/agent-gateway-config-file.service';
import { AgentGatewayApiKeyService } from '../../src/domains/agent-gateway/api-keys/agent-gateway-api-key.service';
import { AgentGatewayLogService } from '../../src/domains/agent-gateway/logs/agent-gateway-log.service';
import { AgentGatewayQuotaDetailService } from '../../src/domains/agent-gateway/quotas/agent-gateway-quota-detail.service';
import { AgentGatewaySystemService } from '../../src/domains/agent-gateway/system/agent-gateway-system.service';
import { MemoryAgentGatewayRepository } from '../../src/domains/agent-gateway/repositories/memory-agent-gateway.repository';
import { MemoryAgentGatewaySecretVault } from '../../src/domains/agent-gateway/secrets/agent-gateway-secret-vault';
import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';
import { MockAgentGatewayProvider } from '../../src/domains/agent-gateway/providers/mock-agent-gateway-provider';

function createFullController() {
  const repository = new MemoryAgentGatewayRepository();
  const secretVault = new MemoryAgentGatewaySecretVault();
  const managementClient = new MemoryAgentGatewayManagementClient();
  return new AgentGatewayController(
    new AgentGatewayService(repository, secretVault),
    new AgentGatewayRelayService(repository, [new MockAgentGatewayProvider()]),
    new AgentGatewayOAuthService(repository, () => new Date('2026-05-08T00:00:00.000Z')),
    new AgentGatewayConnectionService(managementClient),
    new AgentGatewayConfigFileService(managementClient),
    new AgentGatewayApiKeyService(managementClient),
    new AgentGatewayLogService(managementClient),
    new AgentGatewayQuotaDetailService(managementClient),
    new AgentGatewaySystemService(managementClient)
  );
}

function createMinimalController() {
  const repository = new MemoryAgentGatewayRepository();
  const secretVault = new MemoryAgentGatewaySecretVault();
  return new AgentGatewayController(new AgentGatewayService(repository, secretVault));
}

describe('AgentGatewayController - missing service branches', () => {
  it('throws when connectionService is missing for saveConnectionProfile', () => {
    const controller = createMinimalController();
    expect(() => controller.saveConnectionProfile({ apiBase: 'http://x', managementKey: 'k' })).toThrow(
      BadRequestException
    );
  });

  it('throws when connectionService is missing for checkConnection', () => {
    const controller = createMinimalController();
    expect(() => controller.checkConnection()).toThrow(BadRequestException);
  });

  it('throws when configFileService is missing for rawConfig', () => {
    const controller = createMinimalController();
    expect(() => controller.rawConfig()).toThrow(BadRequestException);
  });

  it('throws when configFileService is missing for diffRawConfig', () => {
    const controller = createMinimalController();
    expect(() => controller.diffRawConfig({ content: 'x' })).toThrow(BadRequestException);
  });

  it('throws when configFileService is missing for saveRawConfig', () => {
    const controller = createMinimalController();
    expect(() => controller.saveRawConfig({ content: 'x' })).toThrow(BadRequestException);
  });

  it('throws when configFileService is missing for reloadConfig', () => {
    const controller = createMinimalController();
    expect(() => controller.reloadConfig()).toThrow(BadRequestException);
  });

  it('throws when apiKeyService is missing for apiKeys', () => {
    const controller = createMinimalController();
    expect(() => controller.apiKeys()).toThrow(BadRequestException);
  });

  it('throws when apiKeyService is missing for replaceApiKeys', () => {
    const controller = createMinimalController();
    expect(() => controller.replaceApiKeys({ keys: [] })).toThrow(BadRequestException);
  });

  it('throws when apiKeyService is missing for updateApiKey', () => {
    const controller = createMinimalController();
    expect(() => controller.updateApiKey('0', { value: 'x' })).toThrow(BadRequestException);
  });

  it('throws when apiKeyService is missing for deleteApiKey', () => {
    const controller = createMinimalController();
    expect(() => controller.deleteApiKey('0')).toThrow(BadRequestException);
  });

  it('throws when quotaDetailService is missing', () => {
    const controller = createMinimalController();
    expect(() => controller.quotaDetails()).toThrow(BadRequestException);
  });

  it('throws when logService is missing for tailLogs', () => {
    const controller = createMinimalController();
    expect(() => controller.tailLogs({})).toThrow(BadRequestException);
  });

  it('throws when logService is missing for searchLogs', () => {
    const controller = createMinimalController();
    expect(() => controller.searchLogs({})).toThrow(BadRequestException);
  });

  it('throws when logService is missing for requestErrorFiles', () => {
    const controller = createMinimalController();
    expect(() => controller.requestErrorFiles()).toThrow(BadRequestException);
  });

  it('throws when logService is missing for clearLogs', () => {
    const controller = createMinimalController();
    expect(() => controller.clearLogs()).toThrow(BadRequestException);
  });

  it('throws when systemService is missing for systemInfo', () => {
    const controller = createMinimalController();
    expect(() => controller.systemInfo()).toThrow(BadRequestException);
  });

  it('throws when systemService is missing for systemModels', () => {
    const controller = createMinimalController();
    expect(() => controller.systemModels()).toThrow(BadRequestException);
  });

  it('throws when relayService is missing', () => {
    const controller = createMinimalController();
    expect(() =>
      controller.relay({ model: 'gpt-4', messages: [{ role: 'user', content: 'hi' }], stream: false })
    ).toThrow(BadRequestException);
  });

  it('throws when oauthService is missing for startOAuth', () => {
    const controller = createMinimalController();
    expect(() => controller.startOAuth({ providerId: 'codex', credentialFileId: 'f1' })).toThrow(BadRequestException);
  });

  it('throws when oauthService is missing for completeOAuth', () => {
    const controller = createMinimalController();
    expect(() => controller.completeOAuth({ flowId: 'f1', userCode: 'c1' })).toThrow(BadRequestException);
  });
});

describe('AgentGatewayController - Zod validation failure branches', () => {
  it('rejects invalid saveConnectionProfile body', () => {
    const controller = createFullController();
    expect(() => controller.saveConnectionProfile({})).toThrow(BadRequestException);
    expect(() => controller.saveConnectionProfile(null)).toThrow(BadRequestException);
    expect(() => controller.saveConnectionProfile('invalid')).toThrow(BadRequestException);
    expect(() => controller.saveConnectionProfile([1, 2])).toThrow(BadRequestException);
  });

  it('rejects invalid raw config write body', () => {
    const controller = createFullController();
    expect(() => controller.diffRawConfig({})).toThrow(BadRequestException);
    expect(() => controller.saveRawConfig({})).toThrow(BadRequestException);
  });

  it('rejects invalid replaceApiKeys body', () => {
    const controller = createFullController();
    expect(() => controller.replaceApiKeys({})).toThrow(BadRequestException);
  });

  it('rejects invalid updateApiKey index', () => {
    const controller = createFullController();
    expect(() => controller.updateApiKey('abc', { value: 'name' })).toThrow(BadRequestException);
    expect(() => controller.updateApiKey('-1', { value: 'name' })).toThrow(BadRequestException);
  });

  it('rejects invalid updateApiKey body', () => {
    const controller = createFullController();
    expect(() => controller.updateApiKey('0', null)).toThrow(BadRequestException);
    expect(() => controller.updateApiKey('0', 'invalid')).toThrow(BadRequestException);
    expect(() => controller.updateApiKey('0', [1])).toThrow(BadRequestException);
  });

  it('rejects invalid deleteApiKey index', () => {
    const controller = createFullController();
    expect(() => controller.deleteApiKey('abc')).toThrow(BadRequestException);
    expect(() => controller.deleteApiKey('-1')).toThrow(BadRequestException);
  });

  it('rejects invalid tailLogs query', () => {
    const controller = createFullController();
    expect(() => controller.tailLogs(null)).toThrow(BadRequestException);
    expect(() => controller.tailLogs('invalid')).toThrow(BadRequestException);
    expect(() => controller.tailLogs([1])).toThrow(BadRequestException);
  });

  it('rejects invalid searchLogs body', () => {
    const controller = createFullController();
    expect(() => controller.searchLogs(null)).toThrow(BadRequestException);
  });

  it('rejects invalid updateConfig body', () => {
    const controller = createFullController();
    expect(() => controller.updateConfig('invalid')).toThrow(BadRequestException);
  });

  it('rejects invalid upsertProvider body', () => {
    const controller = createFullController();
    expect(() => controller.upsertProvider('p1', {})).toThrow(BadRequestException);
  });

  it('rejects invalid deleteProvider param', () => {
    const controller = createFullController();
    expect(() => controller.deleteProvider('')).toThrow(BadRequestException);
  });

  it('rejects invalid upsertCredentialFile body', () => {
    const controller = createFullController();
    expect(() => controller.upsertCredentialFile('cf1', {})).toThrow(BadRequestException);
  });

  it('rejects invalid deleteCredentialFile param', () => {
    const controller = createFullController();
    expect(() => controller.deleteCredentialFile('')).toThrow(BadRequestException);
  });

  it('rejects invalid updateQuota body', () => {
    const controller = createFullController();
    expect(() => controller.updateQuota('q1', {})).toThrow(BadRequestException);
  });

  it('rejects invalid probe body', () => {
    const controller = createFullController();
    expect(() => controller.probe({ providerId: '' })).toThrow(BadRequestException);
  });

  it('rejects invalid tokenCount body', () => {
    const controller = createFullController();
    expect(() => controller.tokenCount({})).toThrow(BadRequestException);
    expect(() => controller.tokenCount('invalid')).toThrow(BadRequestException);
  });

  it('rejects invalid preprocess body', () => {
    const controller = createFullController();
    expect(() => controller.preprocess({})).toThrow(BadRequestException);
  });

  it('rejects invalid accounting body', () => {
    const controller = createFullController();
    expect(() => controller.accounting({})).toThrow(BadRequestException);
  });

  it('rejects invalid relay body', () => {
    const controller = createFullController();
    expect(() => controller.relay({})).toThrow(BadRequestException);
  });

  it('rejects invalid startOAuth body', () => {
    const controller = createFullController();
    expect(() => controller.startOAuth({})).toThrow(BadRequestException);
  });

  it('rejects invalid completeOAuth body', () => {
    const controller = createFullController();
    expect(() => controller.completeOAuth({})).toThrow(BadRequestException);
  });
});

describe('AgentGatewayController - parseLogSearch branches', () => {
  it('parses hideManagementTraffic string "true"', async () => {
    const controller = createFullController();
    const result = await controller.searchLogs({ hideManagementTraffic: 'true', limit: '5' });
    expect(result).toBeDefined();
  });

  it('parses query with limit as number', async () => {
    const controller = createFullController();
    const result = await controller.tailLogs({ limit: 10 });
    expect(result).toBeDefined();
  });

  it('handles usage with parsed limit', async () => {
    const controller = createFullController();
    const result = await controller.usage({ limit: '5' });
    expect(result).toBeDefined();
  });

  it('handles usage with invalid limit', async () => {
    const controller = createFullController();
    const result = await controller.usage({});
    expect(result).toBeDefined();
  });
});
