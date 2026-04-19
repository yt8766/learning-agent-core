import { RuntimeStateSnapshot } from '@agent/memory';

type GovernanceAuditRecord = NonNullable<RuntimeStateSnapshot['governanceAudit']>[number];
type DiscoveryRecord = NonNullable<
  NonNullable<RuntimeStateSnapshot['governance']>['connectorDiscoveryHistory']
>[number];

export function groupConnectorDiscoveryHistory(history: DiscoveryRecord[]) {
  const grouped = new Map<string, DiscoveryRecord[]>();
  for (const entry of history.slice().sort((left, right) => right.discoveredAt.localeCompare(left.discoveredAt))) {
    const items = grouped.get(entry.connectorId) ?? [];
    items.push(entry);
    grouped.set(entry.connectorId, items);
  }
  return grouped;
}

export function groupGovernanceAuditByTarget(history: GovernanceAuditRecord[]) {
  const grouped = new Map<string, GovernanceAuditRecord[]>();
  for (const entry of history) {
    if (entry.scope !== 'connector') {
      continue;
    }
    const items = grouped.get(entry.targetId) ?? [];
    items.push(entry);
    grouped.set(entry.targetId, items);
  }
  return grouped;
}

export function defaultConnectorSessionState(transport?: 'http' | 'stdio' | 'local-adapter') {
  if (transport === 'stdio') {
    return 'disconnected' as const;
  }
  return 'stateless' as const;
}
