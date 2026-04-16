import { NotFoundException } from '@nestjs/common';

import { ConfigureConnectorDto } from '@agent/shared';

import {
  appendGovernanceAudit,
  persistConnectorDiscoverySnapshot
} from '../../modules/runtime-governance/services/runtime-governance-store';

export async function setConnectorEnabledWithGovernance(input: {
  connectorId: string;
  enabled: boolean;
  profile: string;
  runtimeStateRepository: { load: () => Promise<any>; save: (snapshot: any) => Promise<void> };
  mcpServerRegistry: {
    get: (connectorId: string) => any;
    setEnabled: (connectorId: string, enabled: boolean) => void;
  };
  mcpClientManager: { closeServerSession: (connectorId: string) => Promise<boolean> };
  describeConnectorProfilePolicy: (connectorId: string, profile: any) => { enabledByProfile: boolean; reason?: string };
}) {
  const connector = input.mcpServerRegistry.get(input.connectorId);
  if (!connector) {
    throw new NotFoundException(`Connector ${input.connectorId} not found`);
  }
  const profilePolicy = input.describeConnectorProfilePolicy(input.connectorId, input.profile);
  if (input.enabled && !profilePolicy.enabledByProfile) {
    throw new NotFoundException(
      `Connector ${input.connectorId} is unavailable for ${input.profile} profile: ${profilePolicy.reason}`
    );
  }
  const snapshot = await input.runtimeStateRepository.load();
  const disabled = new Set(snapshot.governance?.disabledConnectorIds ?? []);
  if (input.enabled) {
    disabled.delete(input.connectorId);
  } else {
    disabled.add(input.connectorId);
  }
  snapshot.governance = {
    ...(snapshot.governance ?? {}),
    disabledConnectorIds: Array.from(disabled)
  };
  await input.runtimeStateRepository.save(snapshot);
  input.mcpServerRegistry.setEnabled(input.connectorId, input.enabled);
  if (!input.enabled) {
    await input.mcpClientManager.closeServerSession(input.connectorId).catch(() => false);
  }
  await appendGovernanceAudit(input.runtimeStateRepository, {
    actor: 'agent-admin-user',
    action: input.enabled ? 'connector.enabled' : 'connector.disabled',
    scope: 'connector',
    targetId: input.connectorId,
    outcome: 'success'
  });
  return input.mcpServerRegistry.get(input.connectorId)!;
}

export async function setConnectorApprovalPolicyWithGovernance(input: {
  connectorId: string;
  effect: 'allow' | 'deny' | 'require-approval' | 'observe';
  actor: string;
  runtimeStateRepository: { load: () => Promise<any>; save: (snapshot: any) => Promise<void> };
  mcpServerRegistry: { get: (connectorId: string) => any };
  mcpCapabilityRegistry: { setServerApprovalOverride: (connectorId: string, effect?: any) => void };
  mcpClientManager: { closeServerSession: (connectorId: string) => Promise<boolean> };
  loadConnectorView: (connectorId: string) => Promise<any>;
}) {
  const connector = input.mcpServerRegistry.get(input.connectorId);
  if (!connector) {
    throw new NotFoundException(`Connector ${input.connectorId} not found`);
  }
  const snapshot = await input.runtimeStateRepository.load();
  const overrides = (snapshot.governance?.connectorPolicyOverrides ?? []).filter(
    (item: any) => item.connectorId !== input.connectorId
  );
  overrides.push({
    connectorId: input.connectorId,
    effect: input.effect,
    reason: `updated_from_admin:${input.effect}`,
    updatedAt: new Date().toISOString(),
    updatedBy: input.actor
  });
  snapshot.governance = {
    ...(snapshot.governance ?? {}),
    connectorPolicyOverrides: overrides
  };
  await input.runtimeStateRepository.save(snapshot);
  input.mcpCapabilityRegistry.setServerApprovalOverride(input.connectorId, input.effect);
  if (input.effect === 'deny') {
    await input.mcpClientManager.closeServerSession(input.connectorId).catch(() => false);
  }
  await appendGovernanceAudit(input.runtimeStateRepository, {
    actor: input.actor,
    action: 'connector.policy.updated',
    scope: 'connector',
    targetId: input.connectorId,
    outcome: 'success',
    reason: input.effect
  });
  return input.loadConnectorView(input.connectorId);
}

export async function clearConnectorApprovalPolicyWithGovernance(input: {
  connectorId: string;
  actor: string;
  runtimeStateRepository: { load: () => Promise<any>; save: (snapshot: any) => Promise<void> };
  mcpServerRegistry: { get: (connectorId: string) => any };
  mcpCapabilityRegistry: { setServerApprovalOverride: (connectorId: string, effect?: any) => void };
  loadConnectorView: (connectorId: string) => Promise<any>;
}) {
  const connector = input.mcpServerRegistry.get(input.connectorId);
  if (!connector) {
    throw new NotFoundException(`Connector ${input.connectorId} not found`);
  }
  const snapshot = await input.runtimeStateRepository.load();
  snapshot.governance = {
    ...(snapshot.governance ?? {}),
    connectorPolicyOverrides: (snapshot.governance?.connectorPolicyOverrides ?? []).filter(
      (item: any) => item.connectorId !== input.connectorId
    )
  };
  await input.runtimeStateRepository.save(snapshot);
  input.mcpCapabilityRegistry.setServerApprovalOverride(input.connectorId, undefined);
  await appendGovernanceAudit(input.runtimeStateRepository, {
    actor: input.actor,
    action: 'connector.policy.cleared',
    scope: 'connector',
    targetId: input.connectorId,
    outcome: 'success'
  });
  return input.loadConnectorView(input.connectorId);
}

export async function setCapabilityApprovalPolicyWithGovernance(input: {
  connectorId: string;
  capabilityId: string;
  effect: 'allow' | 'deny' | 'require-approval' | 'observe';
  actor: string;
  runtimeStateRepository: { load: () => Promise<any>; save: (snapshot: any) => Promise<void> };
  mcpServerRegistry: { get: (connectorId: string) => any };
  mcpCapabilityRegistry: {
    get: (capabilityId: string) => any;
    setCapabilityApprovalOverride: (capabilityId: string, effect?: any) => void;
  };
  loadConnectorView: (connectorId: string) => Promise<any>;
}) {
  const connector = input.mcpServerRegistry.get(input.connectorId);
  if (!connector) {
    throw new NotFoundException(`Connector ${input.connectorId} not found`);
  }
  const capability = input.mcpCapabilityRegistry.get(input.capabilityId);
  if (!capability || capability.serverId !== input.connectorId) {
    throw new NotFoundException(`Capability ${input.capabilityId} not found for connector ${input.connectorId}`);
  }
  const snapshot = await input.runtimeStateRepository.load();
  const overrides = (snapshot.governance?.capabilityPolicyOverrides ?? []).filter(
    (item: any) => item.capabilityId !== input.capabilityId
  );
  overrides.push({
    capabilityId: input.capabilityId,
    connectorId: input.connectorId,
    effect: input.effect,
    reason: `updated_from_admin:${input.effect}`,
    updatedAt: new Date().toISOString(),
    updatedBy: input.actor
  });
  snapshot.governance = {
    ...(snapshot.governance ?? {}),
    capabilityPolicyOverrides: overrides
  };
  await input.runtimeStateRepository.save(snapshot);
  input.mcpCapabilityRegistry.setCapabilityApprovalOverride(input.capabilityId, input.effect);
  await appendGovernanceAudit(input.runtimeStateRepository, {
    actor: input.actor,
    action: 'connector.capability.policy.updated',
    scope: 'connector',
    targetId: input.connectorId,
    outcome: 'success',
    reason: `${input.capabilityId}:${input.effect}`
  });
  return input.loadConnectorView(input.connectorId);
}

export async function clearCapabilityApprovalPolicyWithGovernance(input: {
  connectorId: string;
  capabilityId: string;
  actor: string;
  runtimeStateRepository: { load: () => Promise<any>; save: (snapshot: any) => Promise<void> };
  mcpServerRegistry: { get: (connectorId: string) => any };
  mcpCapabilityRegistry: {
    get: (capabilityId: string) => any;
    setCapabilityApprovalOverride: (capabilityId: string, effect?: any) => void;
  };
  loadConnectorView: (connectorId: string) => Promise<any>;
}) {
  const connector = input.mcpServerRegistry.get(input.connectorId);
  if (!connector) {
    throw new NotFoundException(`Connector ${input.connectorId} not found`);
  }
  const capability = input.mcpCapabilityRegistry.get(input.capabilityId);
  if (!capability || capability.serverId !== input.connectorId) {
    throw new NotFoundException(`Capability ${input.capabilityId} not found for connector ${input.connectorId}`);
  }
  const snapshot = await input.runtimeStateRepository.load();
  snapshot.governance = {
    ...(snapshot.governance ?? {}),
    capabilityPolicyOverrides: (snapshot.governance?.capabilityPolicyOverrides ?? []).filter(
      (item: any) => item.capabilityId !== input.capabilityId
    )
  };
  await input.runtimeStateRepository.save(snapshot);
  input.mcpCapabilityRegistry.setCapabilityApprovalOverride(input.capabilityId, undefined);
  await appendGovernanceAudit(input.runtimeStateRepository, {
    actor: input.actor,
    action: 'connector.capability.policy.cleared',
    scope: 'connector',
    targetId: input.connectorId,
    outcome: 'success',
    reason: input.capabilityId
  });
  return input.loadConnectorView(input.connectorId);
}

export async function closeConnectorSessionWithGovernance(input: {
  connectorId: string;
  runtimeStateRepository: { load: () => Promise<any>; save: (snapshot: any) => Promise<void> };
  mcpClientManager: { closeServerSession: (connectorId: string) => Promise<boolean> };
}) {
  const closed = await input.mcpClientManager.closeServerSession(input.connectorId);
  await appendGovernanceAudit(input.runtimeStateRepository, {
    actor: 'agent-admin-user',
    action: 'connector.session.closed',
    scope: 'connector',
    targetId: input.connectorId,
    outcome: closed ? 'success' : 'rejected',
    reason: closed ? undefined : 'session_not_open'
  });
  return {
    connectorId: input.connectorId,
    closed
  };
}

export async function refreshConnectorDiscoveryWithGovernance(input: {
  connectorId: string;
  runtimeStateRepository: { load: () => Promise<any>; save: (snapshot: any) => Promise<void> };
  mcpServerRegistry: { get: (connectorId: string) => any };
  mcpClientManager: {
    refreshServerDiscovery: (connectorId: string) => Promise<void>;
    describeServers: () => any[];
  };
  registerDiscoveredCapabilities: (connectorId: string) => void;
  loadConnectorView: (connectorId: string) => Promise<any>;
}) {
  const connector = input.mcpServerRegistry.get(input.connectorId);
  if (!connector) {
    throw new NotFoundException(`Connector ${input.connectorId} not found`);
  }
  try {
    await input.mcpClientManager.refreshServerDiscovery(input.connectorId);
    input.registerDiscoveredCapabilities(input.connectorId);
    await persistConnectorDiscoverySnapshot(
      input.runtimeStateRepository,
      input.mcpClientManager as any,
      input.connectorId
    );
    await appendGovernanceAudit(input.runtimeStateRepository, {
      actor: 'agent-admin-user',
      action: 'connector.discovery.refreshed',
      scope: 'connector',
      targetId: input.connectorId,
      outcome: 'success'
    });
    return input.loadConnectorView(input.connectorId);
  } catch (error) {
    await persistConnectorDiscoverySnapshot(
      input.runtimeStateRepository,
      input.mcpClientManager as any,
      input.connectorId,
      error
    );
    await appendGovernanceAudit(input.runtimeStateRepository, {
      actor: 'agent-admin-user',
      action: 'connector.discovery.refreshed',
      scope: 'connector',
      targetId: input.connectorId,
      outcome: 'rejected',
      reason: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

export async function configureConnectorWithGovernance(input: {
  dto: ConfigureConnectorDto;
  runtimeStateRepository: { load: () => Promise<any>; save: (snapshot: any) => Promise<void> };
  mcpClientManager: { refreshServerDiscovery: (connectorId: string) => Promise<void>; describeServers: () => any[] };
  registerConfiguredConnector: (config: any) => void;
  registerDiscoveredCapabilities: (connectorId: string) => void;
  loadConnectorView: (connectorId: string) => Promise<any>;
}) {
  const connectorId =
    input.dto.templateId === 'github-mcp-template'
      ? 'github-mcp'
      : input.dto.templateId === 'browser-mcp-template'
        ? 'browser-mcp'
        : 'lark-mcp';
  const snapshot = await input.runtimeStateRepository.load();
  const configuredConnectors = (snapshot.governance?.configuredConnectors ?? []).filter(
    (item: any) => item.connectorId !== connectorId
  );
  configuredConnectors.push({
    ...input.dto,
    connectorId,
    configuredAt: new Date().toISOString(),
    enabled: input.dto.enabled ?? true
  });
  snapshot.governance = {
    ...(snapshot.governance ?? {}),
    configuredConnectors
  };
  await input.runtimeStateRepository.save(snapshot);
  input.registerConfiguredConnector(configuredConnectors[configuredConnectors.length - 1]!);
  await input.mcpClientManager.refreshServerDiscovery(connectorId).catch(() => undefined);
  input.registerDiscoveredCapabilities(connectorId);
  await persistConnectorDiscoverySnapshot(
    input.runtimeStateRepository,
    input.mcpClientManager as any,
    connectorId
  ).catch(() => undefined);
  await appendGovernanceAudit(input.runtimeStateRepository, {
    actor: input.dto.actor ?? 'agent-admin-user',
    action: 'connector.configured',
    scope: 'connector',
    targetId: connectorId,
    outcome: 'success',
    reason: input.dto.templateId
  });
  return input.loadConnectorView(connectorId);
}
