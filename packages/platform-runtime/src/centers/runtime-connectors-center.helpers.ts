interface ConnectorTraceTaskLike {
  trace?: Array<{
    node?: string;
    summary?: string;
    data?: unknown;
  }>;
}

export interface RuntimeConnectorGovernanceAuditRecord {
  scope: string;
  targetId: string;
  [key: string]: unknown;
}

export interface RuntimeConnectorDiscoveryRecord {
  connectorId: string;
  discoveredAt: string;
  [key: string]: unknown;
}

export function describeCapabilityApprovalReason(connectorDisplayName: string, toolName: string, riskLevel: string) {
  if (riskLevel === 'critical') {
    return `${connectorDisplayName} 的 ${toolName} 属于 critical 风险能力，命中强审批策略。`;
  }
  if (riskLevel === 'high') {
    return `${connectorDisplayName} 的 ${toolName} 属于 high 风险能力，执行前必须人工确认。`;
  }
  return `${connectorDisplayName} 的 ${toolName} 被标记为需审批能力，当前策略要求在调用前确认。`;
}

export function taskTouchesCapability(task: ConnectorTraceTaskLike, toolName: string): boolean {
  const loweredToolName = toolName.toLowerCase();
  return (task.trace ?? []).some(trace => {
    const summary = String(trace.summary ?? '').toLowerCase();
    const node = String(trace.node ?? '').toLowerCase();
    const data = JSON.stringify(trace.data ?? '').toLowerCase();
    return summary.includes(loweredToolName) || node.includes(loweredToolName) || data.includes(loweredToolName);
  });
}

export function findCapabilityTraceSummary(task: ConnectorTraceTaskLike, toolName: string): string | undefined {
  const loweredToolName = toolName.toLowerCase();
  const trace = (task.trace ?? []).find(item => {
    const summary = String(item.summary ?? '').toLowerCase();
    const node = String(item.node ?? '').toLowerCase();
    const data = JSON.stringify(item.data ?? '').toLowerCase();
    return summary.includes(loweredToolName) || node.includes(loweredToolName) || data.includes(loweredToolName);
  });
  return trace?.summary ?? trace?.node;
}

export function groupConnectorDiscoveryHistory(history: RuntimeConnectorDiscoveryRecord[]) {
  const grouped = new Map<string, RuntimeConnectorDiscoveryRecord[]>();
  for (const entry of history.slice().sort((left, right) => right.discoveredAt.localeCompare(left.discoveredAt))) {
    const items = grouped.get(entry.connectorId) ?? [];
    items.push(entry);
    grouped.set(entry.connectorId, items);
  }
  return grouped;
}

export function groupGovernanceAuditByTarget(history: RuntimeConnectorGovernanceAuditRecord[]) {
  const grouped = new Map<string, RuntimeConnectorGovernanceAuditRecord[]>();
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
