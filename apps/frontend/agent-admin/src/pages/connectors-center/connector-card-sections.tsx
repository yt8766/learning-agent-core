import type { ComponentProps } from 'react';

import { Badge } from '@/components/ui/badge';
import type { ConnectorRecord } from '@/types/admin';

import { ActionButton } from './connector-card-primitives';
import type { ConnectorCardProps } from './connector-card';

export function ConnectorBadges({ connector }: { connector: ConnectorRecord }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Badge variant="secondary">{connector.transport}</Badge>
      {connector.installationMode ? <Badge variant="secondary">{connector.installationMode}</Badge> : null}
      {connector.trustClass ? <Badge variant="secondary">{connector.trustClass}</Badge> : null}
      {connector.profilePolicy ? (
        <Badge variant={connector.profilePolicy.enabledByProfile ? 'success' : 'warning'}>
          profile {connector.profilePolicy.enabledByProfile ? 'allowed' : 'restricted'}
        </Badge>
      ) : null}
      {connector.sessionState ? <Badge variant="secondary">session {connector.sessionState}</Badge> : null}
      {connector.discoveryMode ? <Badge variant="secondary">discovery {connector.discoveryMode}</Badge> : null}
      <Badge variant="secondary">capabilities {connector.capabilityCount}</Badge>
      {typeof connector.successRate === 'number' ? (
        <Badge variant="outline">success {(connector.successRate * 100).toFixed(0)}%</Badge>
      ) : null}
      {typeof connector.totalTaskCount === 'number' ? (
        <Badge variant="outline">used {connector.totalTaskCount}</Badge>
      ) : null}
      {typeof connector.activeTaskCount === 'number' ? (
        <Badge variant="outline">active {connector.activeTaskCount}</Badge>
      ) : null}
      {typeof connector.implementedCapabilityCount === 'number' ? (
        <Badge variant="secondary">implemented {connector.implementedCapabilityCount}</Badge>
      ) : null}
      {typeof connector.discoveredCapabilityCount === 'number' ? (
        <Badge variant="secondary">discovered {connector.discoveredCapabilityCount}</Badge>
      ) : null}
      <Badge variant="secondary">审批 {connector.approvalRequiredCount}</Badge>
      <Badge variant="secondary">高风险 {connector.highRiskCount}</Badge>
    </div>
  );
}

export function ConnectorMetadata({ connector }: { connector: ConnectorRecord }) {
  return (
    <>
      {connector.healthReason ? <p className="mt-3 text-xs text-muted-foreground">{connector.healthReason}</p> : null}
      {connector.source ? <p className="mt-1 text-xs text-muted-foreground">source: {connector.source}</p> : null}
      {connector.authMode ? <p className="mt-1 text-xs text-muted-foreground">auth: {connector.authMode}</p> : null}
      {connector.dataScope ? (
        <p className="mt-1 text-xs text-muted-foreground">data scope: {connector.dataScope}</p>
      ) : null}
      {connector.writeScope ? (
        <p className="mt-1 text-xs text-muted-foreground">write scope: {connector.writeScope}</p>
      ) : null}
      {connector.allowedProfiles?.length ? (
        <p className="mt-1 text-xs text-muted-foreground">profiles: {connector.allowedProfiles.join(', ')}</p>
      ) : null}
      {connector.configurationTemplateId || connector.endpoint || connector.command ? (
        <div className="mt-3 rounded-xl border border-border/70 bg-background px-3 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Configuration</p>
          {connector.configurationTemplateId ? (
            <p className="mt-2 text-xs text-muted-foreground">template: {connector.configurationTemplateId}</p>
          ) : null}
          {connector.configuredAt ? (
            <p className="mt-1 text-xs text-muted-foreground">configured at: {connector.configuredAt}</p>
          ) : null}
          {connector.endpoint ? (
            <p className="mt-1 break-all text-xs text-muted-foreground">endpoint: {connector.endpoint}</p>
          ) : null}
          {connector.command ? (
            <p className="mt-1 text-xs text-muted-foreground">
              command: {connector.command}
              {connector.args?.length ? ` ${connector.args.join(' ')}` : ''}
            </p>
          ) : null}
        </div>
      ) : null}
      {connector.firstUsedAt ? (
        <p className="mt-1 text-xs text-muted-foreground">first used {connector.firstUsedAt}</p>
      ) : null}
      {connector.lastUsedAt ? (
        <p className="mt-1 text-xs text-muted-foreground">last used {connector.lastUsedAt}</p>
      ) : null}
      {connector.recentFailureReason ? (
        <p className="mt-1 text-xs text-rose-600">recent failure: {connector.recentFailureReason}</p>
      ) : null}
      {connector.profilePolicy ? (
        <p className="mt-1 text-xs text-muted-foreground">profile policy: {connector.profilePolicy.reason}</p>
      ) : null}
      {connector.recentTaskGoals?.length ? (
        <div className="mt-3 rounded-xl border border-border/70 bg-background px-3 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Recent Goals</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {connector.recentTaskGoals.map(goal => (
              <li key={`${connector.id}-${goal}`}>{goal}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {connector.lastDiscoveredAt ? (
        <p className="mt-1 text-xs text-muted-foreground">last discovered {connector.lastDiscoveredAt}</p>
      ) : null}
      {connector.sessionCreatedAt ? (
        <p className="mt-1 text-xs text-muted-foreground">session created {connector.sessionCreatedAt}</p>
      ) : null}
      {connector.sessionLastActivityAt ? (
        <p className="mt-1 text-xs text-muted-foreground">last activity {connector.sessionLastActivityAt}</p>
      ) : null}
      {typeof connector.sessionRequestCount === 'number' ? (
        <p className="mt-1 text-xs text-muted-foreground">session requests {connector.sessionRequestCount}</p>
      ) : null}
      {typeof connector.sessionIdleMs === 'number' ? (
        <p className="mt-1 text-xs text-muted-foreground">idle {Math.round(connector.sessionIdleMs / 1000)}s</p>
      ) : null}
      {connector.lastDiscoveryError ? (
        <p className="mt-1 text-xs text-amber-700">{connector.lastDiscoveryError}</p>
      ) : null}
    </>
  );
}

export function ConnectorActions(props: ComponentProps<typeof ConnectorCardPropsShim>) {
  const { connector } = props;
  const isTemplate =
    connector.id === 'github-mcp-template' ||
    connector.id === 'browser-mcp-template' ||
    connector.id === 'lark-mcp-template';
  const templateId =
    connector.configurationTemplateId ??
    (connector.id === 'github-mcp'
      ? 'github-mcp-template'
      : connector.id === 'browser-mcp'
        ? 'browser-mcp-template'
        : undefined);
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <ActionButton
        onClick={() =>
          connector.enabled ? props.onDisableConnector(connector.id) : props.onEnableConnector(connector.id)
        }
      >
        {connector.enabled ? '停用 connector' : '启用 connector'}
      </ActionButton>
      <ActionButton onClick={() => props.onRefreshConnectorDiscovery(connector.id)}>刷新发现</ActionButton>
      {isTemplate && !connector.enabled ? (
        <ActionButton
          onClick={() =>
            props.onOpenTemplateForm(
              connector.id as 'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template'
            )
          }
        >
          配置模板
        </ActionButton>
      ) : null}
      {templateId && connector.installationMode === 'configured' ? (
        <ActionButton
          onClick={() =>
            props.onOpenTemplateForm(
              templateId as 'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template',
              connector
            )
          }
        >
          编辑配置
        </ActionButton>
      ) : null}
      <ActionButton onClick={() => props.onSetConnectorPolicy(connector.id, 'require-approval')}>强制审批</ActionButton>
      <ActionButton onClick={() => props.onSetConnectorPolicy(connector.id, 'allow')}>允许直通</ActionButton>
      <ActionButton onClick={() => props.onSetConnectorPolicy(connector.id, 'deny')}>禁止执行</ActionButton>
      <ActionButton onClick={() => props.onClearConnectorPolicy(connector.id)}>清除策略</ActionButton>
      {connector.transport === 'stdio' && connector.sessionState === 'connected' ? (
        <ActionButton onClick={() => props.onCloseSession(connector.id)}>关闭 session</ActionButton>
      ) : null}
    </div>
  );
}

export function ConnectorCapabilities(props: ComponentProps<typeof ConnectorCardPropsShim>) {
  const { connector } = props;
  return (
    <>
      {connector.discoveredCapabilities?.length ? (
        <div className="mt-3 rounded-xl border border-border/70 bg-background px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Discovered Capabilities
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {connector.discoveredCapabilities.slice(0, 8).map(capability => (
              <div key={`${connector.id}-${capability}`}>
                <Badge variant="outline">{capability}</Badge>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-4 grid gap-2">
        {connector.capabilities.slice(0, 4).map(capability => (
          <div
            key={`${connector.id}-${capability.id}`}
            className="rounded-xl border border-border/70 bg-background px-3 py-2 text-xs text-muted-foreground"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground">{capability.toolName}</span>
              <span>{capability.riskLevel}</span>
            </div>
            <p className="mt-1">{capability.displayName}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {capability.isPrimaryForTool ? <Badge variant="success">primary path</Badge> : null}
              {capability.fallbackAvailable ? <Badge variant="outline">has fallback</Badge> : null}
              {capability.requiresApproval ? <Badge variant="outline">requires approval</Badge> : null}
              {capability.effectiveApprovalMode ? (
                <Badge variant="secondary">policy {capability.effectiveApprovalMode}</Badge>
              ) : null}
              {capability.approvalPolicy ? <Badge variant="secondary">{capability.approvalPolicy}</Badge> : null}
              {capability.trustClass ? <Badge variant="secondary">{capability.trustClass}</Badge> : null}
              {capability.dataScope ? <Badge variant="outline">{capability.dataScope}</Badge> : null}
              {capability.writeScope ? <Badge variant="outline">{capability.writeScope}</Badge> : null}
              {typeof capability.usageCount === 'number' ? (
                <Badge variant="outline">used {capability.usageCount}</Badge>
              ) : null}
            </div>
            {capability.policyReason ? <p className="mt-2 text-muted-foreground">{capability.policyReason}</p> : null}
            {capability.recentTaskGoals?.length ? (
              <div className="mt-2 rounded-lg border border-border/70 bg-muted/30 px-2 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Recent Capability Goals
                </p>
                <ul className="mt-1 space-y-1 text-muted-foreground">
                  {capability.recentTaskGoals.map(goal => (
                    <li key={`${capability.id}-${goal}`}>{goal}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {capability.recentTasks?.length ? (
              <div className="mt-2 rounded-lg border border-border/70 bg-background px-2 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Task Drill-down</p>
                <div className="mt-2 grid gap-2">
                  {capability.recentTasks.map(task => (
                    <div
                      key={`${capability.id}-${task.taskId}`}
                      className="rounded-md border border-border/70 bg-muted/30 px-2 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{task.goal}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {task.taskId} · {task.status} · approvals {task.approvalCount}
                          </p>
                        </div>
                        <ActionButton small onClick={() => props.onSelectTask(task.taskId)}>
                          查看任务
                        </ActionButton>
                      </div>
                      {task.latestTraceSummary ? (
                        <p className="mt-2 text-[11px] text-muted-foreground">{task.latestTraceSummary}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <ActionButton
                small
                onClick={() => props.onSetCapabilityPolicy(connector.id, capability.id, 'require-approval')}
              >
                审批
              </ActionButton>
              <ActionButton small onClick={() => props.onSetCapabilityPolicy(connector.id, capability.id, 'allow')}>
                允许
              </ActionButton>
              <ActionButton small onClick={() => props.onSetCapabilityPolicy(connector.id, capability.id, 'deny')}>
                禁止
              </ActionButton>
              <ActionButton small onClick={() => props.onClearCapabilityPolicy(connector.id, capability.id)}>
                清除
              </ActionButton>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function ConnectorCardPropsShim(_props: ConnectorCardProps) {
  return null;
}
