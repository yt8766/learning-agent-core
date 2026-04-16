import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestMock = vi.fn();

vi.mock('@/api/admin-api-core', () => ({
  request: (...args: unknown[]) => requestMock(...args)
}));

import {
  approveSkillInstall,
  compareMemoryVersions,
  clearCapabilityPolicy,
  clearConnectorPolicy,
  closeConnectorSession,
  configureConnector,
  createOrUpdateCounselorSelector,
  disableCompanyAgent,
  disableConnector,
  disableCounselorSelector,
  disableSkill,
  disableSkillSource,
  enableCompanyAgent,
  enableConnector,
  enableCounselorSelector,
  enableSkillSource,
  getMemoryUsageInsights,
  installSkill,
  invalidateMemory,
  invalidateRule,
  promoteSkill,
  patchProfile,
  refreshConnectorDiscovery,
  rejectSkillInstall,
  restoreMemory,
  restoreRule,
  restoreSkill,
  searchMemories,
  retireMemory,
  retireRule,
  retireSkill,
  setCapabilityPolicy,
  setConnectorPolicy,
  setLearningConflictStatus,
  supersedeMemory,
  supersedeRule,
  syncSkillSource
} from '@/api/admin-api-governance';

describe('admin-api-governance', () => {
  beforeEach(() => {
    requestMock.mockReset();
    requestMock.mockResolvedValue({});
  });

  it('builds skill source, company agent and connector governance requests', async () => {
    await installSkill('manifest-1', 'source-1');
    await approveSkillInstall('receipt-1');
    await rejectSkillInstall('receipt-2', 'unsafe');
    await enableSkillSource('source-1');
    await disableSkillSource('source-1');
    await syncSkillSource('source-1');
    await enableCompanyAgent('worker-1');
    await disableCompanyAgent('worker-1');
    await closeConnectorSession('connector-1');
    await refreshConnectorDiscovery('connector-1');
    await enableConnector('connector-1');
    await disableConnector('connector-1');
    await setConnectorPolicy('connector-1', 'require-approval');
    await clearConnectorPolicy('connector-1');
    await setCapabilityPolicy('connector-1', 'browser.open', 'observe');
    await clearCapabilityPolicy('connector-1', 'browser.open');
    await configureConnector({
      templateId: 'github-mcp-template',
      transport: 'http',
      displayName: 'GitHub MCP',
      endpoint: 'https://example.com/mcp',
      apiKey: 'secret'
    });

    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      '/platform/skill-sources-center/install',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ manifestId: 'manifest-1', sourceId: 'source-1', actor: 'agent-admin-user' })
      })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      3,
      '/platform/skill-sources-center/receipts/receipt-2/reject',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ actor: 'agent-admin-user', reason: 'unsafe' })
      })
    );
    expect(requestMock).toHaveBeenNthCalledWith(7, '/platform/company-agents-center/worker-1/enable', {
      method: 'POST'
    });
    expect(requestMock).toHaveBeenNthCalledWith(13, '/platform/connectors-center/connector-1/policy/require-approval', {
      method: 'POST'
    });
    expect(requestMock).toHaveBeenNthCalledWith(
      15,
      '/platform/connectors-center/connector-1/capabilities/browser.open/policy/observe',
      { method: 'POST' }
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      17,
      '/platform/connectors-center/configure',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          templateId: 'github-mcp-template',
          transport: 'http',
          displayName: 'GitHub MCP',
          endpoint: 'https://example.com/mcp',
          apiKey: 'secret',
          actor: 'agent-admin-user',
          enabled: true
        })
      })
    );
  });

  it('builds skill, memory, rule and counselor governance mutations', async () => {
    await promoteSkill('skill-1');
    await disableSkill('skill-1');
    await restoreSkill('skill-1');
    await retireSkill('skill-1');
    await invalidateMemory('mem-1', 'invalidated_from_admin');
    await supersedeMemory('mem-1', 'mem-2', 'superseded_from_admin');
    await restoreMemory('mem-1');
    await retireMemory('mem-1', 'retired_from_admin');
    await invalidateRule('rule-1', 'invalidated_from_admin');
    await supersedeRule('rule-1', 'rule-2', 'superseded_from_admin');
    await restoreRule('rule-1');
    await retireRule('rule-1', 'retired_from_admin');
    await createOrUpdateCounselorSelector({
      selectorId: 'selector-1',
      domain: 'general',
      strategy: 'session-ratio',
      candidateIds: ['a', 'b'],
      weights: [2, 1],
      defaultCounselorId: 'a',
      enabled: true
    });
    await enableCounselorSelector('selector-1');
    await disableCounselorSelector('selector-1');
    await setLearningConflictStatus('conflict:set/1', 'merged', 'mem-2');

    expect(requestMock).toHaveBeenNthCalledWith(1, '/skills/skill-1/promote', { method: 'POST' });
    expect(requestMock).toHaveBeenNthCalledWith(
      5,
      '/memory/mem-1/invalidate',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ reason: 'invalidated_from_admin' }) })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      10,
      '/rules/rule-1/supersede',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ replacementId: 'rule-2', reason: 'superseded_from_admin' })
      })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      13,
      '/platform/learning-center/counselor-selectors',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          selectorId: 'selector-1',
          domain: 'general',
          strategy: 'session-ratio',
          candidateIds: ['a', 'b'],
          weights: [2, 1],
          defaultCounselorId: 'a',
          enabled: true
        })
      })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      16,
      '/platform/learning-center/conflicts/conflict%3Aset%2F1/merged',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ preferredMemoryId: 'mem-2' })
      })
    );
  });

  it('builds structured memory search requests', async () => {
    await searchMemories({
      query: 'deploy preference',
      limit: 8,
      scopeContext: {
        actorRole: 'agent-admin-user',
        scopeType: 'workspace',
        allowedScopeTypes: ['workspace', 'team', 'org']
      },
      memoryTypes: ['preference', 'constraint'],
      includeRules: true,
      includeReflections: false
    });

    expect(requestMock).toHaveBeenCalledWith(
      '/memory/search',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          query: 'deploy preference',
          limit: 8,
          scopeContext: {
            actorRole: 'agent-admin-user',
            scopeType: 'workspace',
            allowedScopeTypes: ['workspace', 'team', 'org']
          },
          memoryTypes: ['preference', 'constraint'],
          includeRules: true,
          includeReflections: false
        })
      })
    );
  });

  it('builds memory insights, compare and profile patch requests', async () => {
    await getMemoryUsageInsights();
    await compareMemoryVersions('mem-1', 2, 5);
    await patchProfile('user-1', {
      communicationStyle: 'concise',
      doNotDo: ['no auto-commit'],
      actor: 'agent-admin-user'
    });

    expect(requestMock).toHaveBeenNthCalledWith(1, '/memory/insights/usage');
    expect(requestMock).toHaveBeenNthCalledWith(2, '/memory/mem-1/compare/2/5');
    expect(requestMock).toHaveBeenNthCalledWith(
      3,
      '/memory/profiles/user-1',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          communicationStyle: 'concise',
          doNotDo: ['no auto-commit'],
          actor: 'agent-admin-user'
        })
      })
    );
  });
});
