import type { ConfigureConnectorDto } from '@agent/core';
import type { RuntimeStateSnapshot } from '@agent/memory';

type ConnectorPolicyEffect = 'allow' | 'deny' | 'require-approval' | 'observe';

export function setConnectorEnabledState(
  snapshot: RuntimeStateSnapshot,
  connectorId: string,
  enabled: boolean
): RuntimeStateSnapshot {
  const disabled = new Set(snapshot.governance?.disabledConnectorIds ?? []);
  if (enabled) {
    disabled.delete(connectorId);
  } else {
    disabled.add(connectorId);
  }

  snapshot.governance = {
    ...(snapshot.governance ?? {}),
    disabledConnectorIds: Array.from(disabled)
  };
  return snapshot;
}

export function setConnectorPolicyOverride(
  snapshot: RuntimeStateSnapshot,
  input: {
    connectorId: string;
    effect: ConnectorPolicyEffect;
    actor: string;
    updatedAt: string;
  }
): RuntimeStateSnapshot {
  const overrides = (snapshot.governance?.connectorPolicyOverrides ?? []).filter(
    item => item.connectorId !== input.connectorId
  );
  overrides.push({
    connectorId: input.connectorId,
    effect: input.effect,
    reason: `updated_from_admin:${input.effect}`,
    updatedAt: input.updatedAt,
    updatedBy: input.actor
  });

  snapshot.governance = {
    ...(snapshot.governance ?? {}),
    connectorPolicyOverrides: overrides
  };
  return snapshot;
}

export function clearConnectorPolicyOverride(
  snapshot: RuntimeStateSnapshot,
  connectorId: string
): RuntimeStateSnapshot {
  snapshot.governance = {
    ...(snapshot.governance ?? {}),
    connectorPolicyOverrides: (snapshot.governance?.connectorPolicyOverrides ?? []).filter(
      item => item.connectorId !== connectorId
    )
  };
  return snapshot;
}

export function setCapabilityPolicyOverride(
  snapshot: RuntimeStateSnapshot,
  input: {
    connectorId: string;
    capabilityId: string;
    effect: ConnectorPolicyEffect;
    actor: string;
    updatedAt: string;
  }
): RuntimeStateSnapshot {
  const overrides = (snapshot.governance?.capabilityPolicyOverrides ?? []).filter(
    item => item.capabilityId !== input.capabilityId
  );
  overrides.push({
    capabilityId: input.capabilityId,
    connectorId: input.connectorId,
    effect: input.effect,
    reason: `updated_from_admin:${input.effect}`,
    updatedAt: input.updatedAt,
    updatedBy: input.actor
  });

  snapshot.governance = {
    ...(snapshot.governance ?? {}),
    capabilityPolicyOverrides: overrides
  };
  return snapshot;
}

export function clearCapabilityPolicyOverride(
  snapshot: RuntimeStateSnapshot,
  capabilityId: string
): RuntimeStateSnapshot {
  snapshot.governance = {
    ...(snapshot.governance ?? {}),
    capabilityPolicyOverrides: (snapshot.governance?.capabilityPolicyOverrides ?? []).filter(
      item => item.capabilityId !== capabilityId
    )
  };
  return snapshot;
}

export function resolveConfiguredConnectorId(templateId: ConfigureConnectorDto['templateId']) {
  return templateId === 'github-mcp-template'
    ? 'github-mcp'
    : templateId === 'browser-mcp-template'
      ? 'browser-mcp'
      : 'lark-mcp';
}

export function setConfiguredConnectorRecord(
  snapshot: RuntimeStateSnapshot,
  dto: ConfigureConnectorDto,
  configuredAt = new Date().toISOString()
): RuntimeStateSnapshot {
  const connectorId = resolveConfiguredConnectorId(dto.templateId);
  const configuredConnectors = (snapshot.governance?.configuredConnectors ?? []).filter(
    item => item.connectorId !== connectorId
  );
  configuredConnectors.push({
    ...dto,
    connectorId,
    configuredAt,
    enabled: dto.enabled ?? true
  });

  snapshot.governance = {
    ...(snapshot.governance ?? {}),
    configuredConnectors
  };
  return snapshot;
}
