import type { RuntimeProfile } from '@agent/config';
import { describeConnectorProfilePolicy } from '@agent/runtime';
import { RuntimeStateSnapshot } from '@agent/memory';
import { ApprovalPolicyRecord, ConnectorHealthRecord, TaskStatus } from '@agent/core';
import { McpClientManager } from '@agent/tools';

import {
  describeCapabilityApprovalReason,
  findCapabilityTraceSummary,
  taskTouchesCapability
} from '../helpers/runtime-connector-utils';
import { groupConnectorDiscoveryHistory, groupGovernanceAuditByTarget } from '../helpers/runtime-derived-records';

type ConnectorsCenterItem = ReturnType<McpClientManager['describeServers']>[number];

interface ConnectorsCenterTaskLike {
  id: string;
  goal: string;
  status?: string;
  approvals?: unknown[];
  connectorRefs?: string[];
  createdAt: string;
  updatedAt: string;
  result?: string;
  trace: Array<{
    summary?: string;
    node?: string;
    data?: unknown;
  }>;
}

export function buildConnectorsCenter(input: {
  profile: RuntimeProfile;
  snapshot: RuntimeStateSnapshot;
  tasks: ConnectorsCenterTaskLike[];
  connectors: ConnectorsCenterItem[];
  knowledgeOverview?: {
    sourceCount: number;
    searchableDocumentCount: number;
    blockedDocumentCount: number;
    latestReceipts: Array<{
      id: string;
    }>;
  };
}) {
  const configuredConnectors = new Map(
    (input.snapshot.governance?.configuredConnectors ?? []).map(item => [item.connectorId, item] as const)
  );
  const discoveryHistory = groupConnectorDiscoveryHistory(input.snapshot.governance?.connectorDiscoveryHistory ?? []);
  const governanceAuditByConnector = groupGovernanceAuditByTarget(input.snapshot.governanceAudit ?? []);
  const policyOverrides = new Map(
    (input.snapshot.governance?.connectorPolicyOverrides ?? []).map(item => [item.connectorId, item] as const)
  );
  const capabilityOverrides = new Map(
    (input.snapshot.governance?.capabilityPolicyOverrides ?? []).map(item => [item.capabilityId, item] as const)
  );

  return input.connectors.map(connector => {
    const profilePolicy = describeConnectorProfilePolicy(connector.id, input.profile);
    const connectorConfig = configuredConnectors.get(connector.id);
    const connectorHistory = discoveryHistory.get(connector.id) ?? [];
    const latestDiscovery = connectorHistory[0];
    const override = policyOverrides.get(connector.id);
    const enrichedCapabilities = connector.capabilities.map(capability => {
      const capabilityOverride = capabilityOverrides.get(capability.id);
      const capabilityTasks = input.tasks
        .filter(task => (task.connectorRefs ?? []).includes(connector.id))
        .filter(task => taskTouchesCapability(task, capability.toolName))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      return {
        ...capability,
        effectiveApprovalMode: capabilityOverride?.effect ?? override?.effect ?? 'default',
        policyReason:
          capabilityOverride?.reason ??
          override?.reason ??
          (capability.requiresApproval
            ? describeCapabilityApprovalReason(connector.displayName, capability.toolName, capability.riskLevel)
            : 'inherits default connector policy'),
        usageCount: capabilityTasks.length,
        recentTaskGoals: capabilityTasks.slice(0, 3).map(task => task.goal),
        recentTasks: capabilityTasks.slice(0, 3).map(task => ({
          taskId: task.id,
          goal: task.goal,
          status: String(task.status),
          approvalCount: task.approvals?.length ?? 0,
          latestTraceSummary: findCapabilityTraceSummary(task, capability.toolName)
        }))
      };
    });
    const healthChecks: ConnectorHealthRecord[] = [
      {
        connectorId: connector.id,
        healthState: profilePolicy.enabledByProfile
          ? (connector.healthState as ConnectorHealthRecord['healthState'])
          : 'disabled',
        reason: profilePolicy.enabledByProfile ? connector.healthReason : profilePolicy.reason,
        checkedAt: latestDiscovery?.discoveredAt ?? connector.lastDiscoveredAt ?? new Date().toISOString(),
        transport: connector.transport,
        implementedCapabilityCount: connector.implementedCapabilityCount,
        discoveredCapabilityCount: connector.discoveredCapabilityCount
      }
    ];
    const approvalPolicies: ApprovalPolicyRecord[] = connector.capabilities
      .filter(capability => capability.requiresApproval)
      .map(capability => ({
        id: `${connector.id}:${capability.id}`,
        scope: 'capability',
        targetId: capability.id,
        capabilityId: capability.id,
        connectorId: connector.id,
        mode: capability.riskLevel === 'critical' || capability.riskLevel === 'high' ? 'all-actions' : 'high-risk-only',
        effect: 'require-approval',
        matchedCount: 1,
        reason: describeCapabilityApprovalReason(connector.displayName, capability.toolName, capability.riskLevel)
      }));
    if (override) {
      approvalPolicies.unshift({
        id: `${connector.id}:override`,
        scope: 'connector',
        targetId: connector.id,
        connectorId: connector.id,
        mode: override.effect,
        effect: override.effect,
        matchedCount: connector.capabilityCount,
        reason: override.reason ?? `connector policy override: ${override.effect}`
      });
    }
    for (const capability of connector.capabilities) {
      const capabilityOverride = capabilityOverrides.get(capability.id);
      if (!capabilityOverride) {
        continue;
      }
      approvalPolicies.unshift({
        id: `${connector.id}:${capability.id}:override`,
        scope: 'capability',
        targetId: capability.id,
        capabilityId: capability.id,
        connectorId: connector.id,
        mode: capabilityOverride.effect,
        effect: capabilityOverride.effect,
        matchedCount: 1,
        reason: capabilityOverride.reason ?? `capability policy override: ${capabilityOverride.effect}`
      });
    }

    const relatedTasks = input.tasks
      .filter(task => (task.connectorRefs ?? []).includes(connector.id))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    const completedTasks = relatedTasks.filter(task =>
      [String(TaskStatus.COMPLETED), String(TaskStatus.FAILED)].includes(String(task.status))
    );
    const successfulTasks = completedTasks.filter(task => String(task.status) === String(TaskStatus.COMPLETED));
    const failedTask = relatedTasks.find(task => String(task.status) === String(TaskStatus.FAILED));

    return {
      ...connector,
      enabled: connector.enabled && profilePolicy.enabledByProfile,
      healthState: profilePolicy.enabledByProfile ? connector.healthState : 'disabled',
      healthReason: profilePolicy.enabledByProfile ? connector.healthReason : profilePolicy.reason,
      trustClass: connector.trustClass,
      source: connector.source,
      authMode: connector.headers ? 'header' : connector.command ? 'token' : 'none',
      dataScope: connector.dataScope,
      writeScope: connector.writeScope,
      installationMode: connector.installationMode ?? 'builtin',
      allowedProfiles: connector.allowedProfiles,
      endpoint: connector.endpoint,
      command: connector.command,
      args: connector.args,
      configuredAt: connectorConfig?.configuredAt,
      configurationTemplateId: connectorConfig?.templateId,
      activeTaskCount: relatedTasks.filter(task =>
        ['queued', 'running', 'waiting_approval', 'blocked'].includes(String(task.status))
      ).length,
      totalTaskCount: relatedTasks.length,
      successRate: completedTasks.length ? successfulTasks.length / completedTasks.length : undefined,
      recentTaskGoals: relatedTasks.slice(0, 3).map(task => task.goal),
      firstUsedAt: relatedTasks.length ? relatedTasks[relatedTasks.length - 1]?.createdAt : undefined,
      lastUsedAt: relatedTasks[0]?.updatedAt,
      recentFailureReason:
        failedTask?.result ??
        failedTask?.trace.find(trace => /fail|error/i.test(trace.summary ?? '') || /fail|error/i.test(trace.node ?? ''))
          ?.summary,
      lastDiscoveredAt: latestDiscovery?.discoveredAt ?? connector.lastDiscoveredAt,
      lastDiscoveryError: latestDiscovery?.error ?? connector.lastDiscoveryError,
      discoveryHistory: connectorHistory.slice(0, 5),
      recentGovernanceAudits: governanceAuditByConnector.get(connector.id)?.slice(0, 5) ?? [],
      knowledgeIngestion: input.knowledgeOverview
        ? {
            sourceCount: input.knowledgeOverview.sourceCount,
            searchableDocumentCount: input.knowledgeOverview.searchableDocumentCount,
            blockedDocumentCount: input.knowledgeOverview.blockedDocumentCount,
            latestReceiptIds: input.knowledgeOverview.latestReceipts.map(item => item.id)
          }
        : undefined,
      profilePolicy,
      healthChecks,
      approvalPolicies,
      capabilities: enrichedCapabilities
    };
  });
}
