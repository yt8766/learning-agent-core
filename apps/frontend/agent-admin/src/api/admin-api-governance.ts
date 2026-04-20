import type { PlatformConsoleRecord, SkillRecord } from '@/types/admin';
import { request } from './admin-api-core';

export * from './admin-api-memory';

interface ConnectorTemplateConfigParams {
  templateId: 'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template';
  transport: 'stdio' | 'http';
  displayName?: string;
  endpoint?: string;
  command?: string;
  args?: string[];
  apiKey?: string;
}

export async function installSkill(manifestId: string, sourceId?: string) {
  return request<PlatformConsoleRecord['skillSources']['receipts'][number]>('/platform/skill-sources-center/install', {
    method: 'POST',
    body: JSON.stringify({ manifestId, sourceId, actor: 'agent-admin-user' })
  });
}

export async function approveSkillInstall(receiptId: string) {
  return request<PlatformConsoleRecord['skillSources']['receipts'][number]>(
    `/platform/skill-sources-center/receipts/${receiptId}/approve`,
    { method: 'POST', body: JSON.stringify({ actor: 'agent-admin-user' }) }
  );
}

export async function rejectSkillInstall(receiptId: string, reason?: string) {
  return request<PlatformConsoleRecord['skillSources']['receipts'][number]>(
    `/platform/skill-sources-center/receipts/${receiptId}/reject`,
    { method: 'POST', body: JSON.stringify({ actor: 'agent-admin-user', reason }) }
  );
}

export async function enableSkillSource(sourceId: string) {
  return request<PlatformConsoleRecord['skillSources']['sources'][number]>(
    `/platform/skill-sources-center/${sourceId}/enable`,
    { method: 'POST' }
  );
}

export async function disableSkillSource(sourceId: string) {
  return request<PlatformConsoleRecord['skillSources']['sources'][number]>(
    `/platform/skill-sources-center/${sourceId}/disable`,
    { method: 'POST' }
  );
}

export async function syncSkillSource(sourceId: string) {
  return request<PlatformConsoleRecord['skillSources']['sources'][number]>(
    `/platform/skill-sources-center/${sourceId}/sync`,
    { method: 'POST' }
  );
}

export async function enableCompanyAgent(workerId: string) {
  return request<PlatformConsoleRecord['companyAgents'][number]>(`/platform/company-agents-center/${workerId}/enable`, {
    method: 'POST'
  });
}

export async function disableCompanyAgent(workerId: string) {
  return request<PlatformConsoleRecord['companyAgents'][number]>(
    `/platform/company-agents-center/${workerId}/disable`,
    { method: 'POST' }
  );
}

export async function closeConnectorSession(connectorId: string) {
  return request<{ connectorId: string; closed: boolean }>(`/platform/connectors-center/${connectorId}/close-session`, {
    method: 'POST'
  });
}

export async function refreshConnectorDiscovery(connectorId: string) {
  return request<PlatformConsoleRecord['connectors'][number]>(`/platform/connectors-center/${connectorId}/refresh`, {
    method: 'POST'
  });
}

export async function enableConnector(connectorId: string) {
  return request<PlatformConsoleRecord['connectors'][number]>(`/platform/connectors-center/${connectorId}/enable`, {
    method: 'POST'
  });
}

export async function disableConnector(connectorId: string) {
  return request<PlatformConsoleRecord['connectors'][number]>(`/platform/connectors-center/${connectorId}/disable`, {
    method: 'POST'
  });
}

export async function setConnectorPolicy(
  connectorId: string,
  effect: 'allow' | 'deny' | 'require-approval' | 'observe'
) {
  return request<PlatformConsoleRecord['connectors'][number]>(
    `/platform/connectors-center/${connectorId}/policy/${effect}`,
    { method: 'POST' }
  );
}

export async function clearConnectorPolicy(connectorId: string) {
  return request<PlatformConsoleRecord['connectors'][number]>(
    `/platform/connectors-center/${connectorId}/policy/reset`,
    { method: 'POST' }
  );
}

export async function setCapabilityPolicy(
  connectorId: string,
  capabilityId: string,
  effect: 'allow' | 'deny' | 'require-approval' | 'observe'
) {
  return request<PlatformConsoleRecord['connectors'][number]>(
    `/platform/connectors-center/${connectorId}/capabilities/${encodeURIComponent(capabilityId)}/policy/${effect}`,
    { method: 'POST' }
  );
}

export async function clearCapabilityPolicy(connectorId: string, capabilityId: string) {
  return request<PlatformConsoleRecord['connectors'][number]>(
    `/platform/connectors-center/${connectorId}/capabilities/${encodeURIComponent(capabilityId)}/policy/reset`,
    { method: 'POST' }
  );
}

export async function configureConnector(params: ConnectorTemplateConfigParams) {
  return request<PlatformConsoleRecord['connectors'][number]>('/platform/connectors-center/configure', {
    method: 'POST',
    body: JSON.stringify({ ...params, actor: 'agent-admin-user', enabled: true })
  });
}

export async function promoteSkill(skillId: string) {
  return request<SkillRecord>(`/skills/${skillId}/promote`, { method: 'POST' });
}

export async function getSkills(status?: string) {
  const search = new URLSearchParams();
  if (status) {
    search.set('status', status);
  }
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return request<PlatformConsoleRecord['skills']>(`/skills${suffix}`, {
    cancelKey: 'skills',
    cancelPrevious: true
  });
}

export async function getRules() {
  return request<PlatformConsoleRecord['rules']>('/rules', {
    cancelKey: 'rules',
    cancelPrevious: true
  });
}

export async function disableSkill(skillId: string) {
  return request<SkillRecord>(`/skills/${skillId}/disable`, { method: 'POST' });
}

export async function restoreSkill(skillId: string) {
  return request<SkillRecord>(`/skills/${skillId}/restore`, { method: 'POST' });
}

export async function retireSkill(skillId: string) {
  return request<SkillRecord>(`/skills/${skillId}/retire`, { method: 'POST' });
}

export async function invalidateRule(ruleId: string, reason: string) {
  return request(`/rules/${ruleId}/invalidate`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
}

export async function supersedeRule(ruleId: string, replacementId: string, reason: string) {
  return request(`/rules/${ruleId}/supersede`, {
    method: 'POST',
    body: JSON.stringify({ replacementId, reason })
  });
}

export async function restoreRule(ruleId: string) {
  return request(`/rules/${ruleId}/restore`, { method: 'POST' });
}

export async function retireRule(ruleId: string, reason: string) {
  return request(`/rules/${ruleId}/retire`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
}

export async function createOrUpdateCounselorSelector(params: {
  selectorId: string;
  domain: string;
  strategy: 'manual' | 'user-id' | 'session-ratio' | 'task-type' | 'feature-flag';
  candidateIds: string[];
  weights?: number[];
  featureFlag?: string;
  defaultCounselorId: string;
  enabled?: boolean;
}) {
  return request<NonNullable<PlatformConsoleRecord['learning']['counselorSelectorConfigs']>[number]>(
    '/platform/learning-center/counselor-selectors',
    {
      method: 'POST',
      body: JSON.stringify(params)
    }
  );
}

export async function enableCounselorSelector(selectorId: string) {
  return request<NonNullable<PlatformConsoleRecord['learning']['counselorSelectorConfigs']>[number]>(
    `/platform/learning-center/counselor-selectors/${selectorId}/enable`,
    { method: 'POST' }
  );
}

export async function disableCounselorSelector(selectorId: string) {
  return request<NonNullable<PlatformConsoleRecord['learning']['counselorSelectorConfigs']>[number]>(
    `/platform/learning-center/counselor-selectors/${selectorId}/disable`,
    { method: 'POST' }
  );
}

export async function setLearningConflictStatus(
  conflictId: string,
  status: 'open' | 'merged' | 'dismissed' | 'escalated',
  preferredMemoryId?: string
) {
  return request<NonNullable<PlatformConsoleRecord['learning']['learningConflictScan']>['conflictPairs'][number]>(
    `/platform/learning-center/conflicts/${encodeURIComponent(conflictId)}/${status}`,
    {
      method: 'POST',
      body: JSON.stringify(preferredMemoryId ? { preferredMemoryId } : {})
    }
  );
}
