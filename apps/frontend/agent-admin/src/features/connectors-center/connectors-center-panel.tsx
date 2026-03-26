import { useState } from 'react';
import type { ChangeEvent } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import type { ConnectorRecord } from '../../types/admin';

interface ConnectorsCenterPanelProps {
  connectors: ConnectorRecord[];
  onSelectTask: (taskId: string) => void;
  onCloseSession: (connectorId: string) => void;
  onRefreshConnectorDiscovery: (connectorId: string) => void;
  onEnableConnector: (connectorId: string) => void;
  onDisableConnector: (connectorId: string) => void;
  onSetConnectorPolicy: (connectorId: string, effect: 'allow' | 'deny' | 'require-approval' | 'observe') => void;
  onClearConnectorPolicy: (connectorId: string) => void;
  onSetCapabilityPolicy: (
    connectorId: string,
    capabilityId: string,
    effect: 'allow' | 'deny' | 'require-approval' | 'observe'
  ) => void;
  onClearCapabilityPolicy: (connectorId: string, capabilityId: string) => void;
  onConfigureConnector: (params: {
    templateId: 'github-mcp-template' | 'browser-mcp-template';
    transport: 'stdio' | 'http';
    displayName?: string;
    endpoint?: string;
    command?: string;
    args?: string[];
    apiKey?: string;
  }) => void;
}

export function ConnectorsCenterPanel({
  connectors,
  onSelectTask,
  onCloseSession,
  onRefreshConnectorDiscovery,
  onEnableConnector,
  onDisableConnector,
  onSetConnectorPolicy,
  onClearConnectorPolicy,
  onSetCapabilityPolicy,
  onClearCapabilityPolicy,
  onConfigureConnector
}: ConnectorsCenterPanelProps) {
  const [configuringTemplateId, setConfiguringTemplateId] = useState<
    'github-mcp-template' | 'browser-mcp-template' | ''
  >('');
  const [transport, setTransport] = useState<'stdio' | 'http'>('stdio');
  const [displayName, setDisplayName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [command, setCommand] = useState('npx');
  const [argsText, setArgsText] = useState('');
  const [apiKey, setApiKey] = useState('');
  const successRates = connectors
    .map(item => item.successRate)
    .filter((value): value is number => typeof value === 'number');
  const avgSuccessRate = successRates.length
    ? successRates.reduce((sum, value) => sum + value, 0) / successRates.length
    : undefined;
  const governedCapabilityCount = connectors.reduce(
    (sum, connector) =>
      sum +
      connector.capabilities.filter(
        capability => capability.effectiveApprovalMode && capability.effectiveApprovalMode !== 'default'
      ).length,
    0
  );
  const totalConnectorUsage = connectors.reduce((sum, connector) => sum + (connector.totalTaskCount ?? 0), 0);
  const topPerformers = connectors
    .filter(connector => typeof connector.successRate === 'number')
    .slice()
    .sort((left, right) => (right.successRate ?? 0) - (left.successRate ?? 0))
    .slice(0, 3);
  const needsAttention = connectors
    .filter(
      connector =>
        connector.recentFailureReason || (connector.successRate ?? 1) < 0.6 || connector.healthState !== 'healthy'
    )
    .slice()
    .sort((left, right) => (left.successRate ?? 1) - (right.successRate ?? 1))
    .slice(0, 3);

  const openTemplateForm = (
    templateId: 'github-mcp-template' | 'browser-mcp-template',
    connector?: ConnectorRecord
  ) => {
    setConfiguringTemplateId(templateId);
    setTransport((connector?.transport as 'stdio' | 'http') ?? 'stdio');
    setDisplayName(connector?.displayName ?? (templateId === 'github-mcp-template' ? 'GitHub MCP' : 'Browser MCP'));
    setEndpoint(connector?.endpoint ?? '');
    setCommand(connector?.command ?? 'npx');
    setArgsText(
      connector?.args?.join(' ') ??
        (templateId === 'github-mcp-template' ? '-y github-mcp-server' : '-y browserbase-mcp')
    );
    setApiKey('');
  };

  const closeTemplateForm = () => {
    setConfiguringTemplateId('');
    setEndpoint('');
    setApiKey('');
  };

  return (
    <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-stone-950">Connector &amp; Policy Center</CardTitle>
        <Badge variant="outline">{connectors.length}</Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">Connector Effectiveness</p>
            <p className="mt-3 text-2xl font-semibold text-stone-950">
              {avgSuccessRate == null ? 'N/A' : `${Math.round(avgSuccessRate * 100)}%`}
            </p>
            <p className="mt-2 text-sm text-stone-500">连接器平均成功率。</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">Capability Governance</p>
            <p className="mt-3 text-2xl font-semibold text-stone-950">{governedCapabilityCount}</p>
            <p className="mt-2 text-sm text-stone-500">已有单独策略的 capability 数量。</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">Connector Usage</p>
            <p className="mt-3 text-2xl font-semibold text-stone-950">{totalConnectorUsage}</p>
            <p className="mt-2 text-sm text-stone-500">连接器参与过的任务总次数。</p>
          </div>
        </div>
        {topPerformers.length || needsAttention.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">Top Performers</p>
              <div className="mt-3 grid gap-2">
                {topPerformers.length ? (
                  topPerformers.map(connector => (
                    <div key={`top-${connector.id}`} className="rounded-xl border border-stone-200 bg-white px-3 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-stone-900">{connector.displayName}</span>
                        <Badge variant="success">{Math.round((connector.successRate ?? 0) * 100)}%</Badge>
                      </div>
                      <p className="mt-1 text-xs text-stone-500">
                        used {connector.totalTaskCount ?? 0} · capabilities {connector.capabilityCount}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-stone-500">当前还没有足够运行数据。</p>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">Needs Attention</p>
              <div className="mt-3 grid gap-2">
                {needsAttention.length ? (
                  needsAttention.map(connector => (
                    <div
                      key={`attention-${connector.id}`}
                      className="rounded-xl border border-stone-200 bg-white px-3 py-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-stone-900">{connector.displayName}</span>
                        <Badge variant={connector.healthState === 'healthy' ? 'warning' : 'destructive'}>
                          {connector.healthState}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-stone-500">
                        success {connector.successRate == null ? 'N/A' : `${Math.round(connector.successRate * 100)}%`}
                      </p>
                      {connector.recentFailureReason ? (
                        <p className="mt-1 text-xs text-rose-600">{connector.recentFailureReason}</p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-stone-500">当前没有明显异常 connector。</p>
                )}
              </div>
            </div>
          </div>
        ) : null}
        {configuringTemplateId ? (
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-stone-950">配置 {configuringTemplateId}</p>
                <p className="mt-1 text-xs text-stone-500">
                  保存后会覆盖当前 configured connector 配置，并重新进入发现流程。
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={closeTemplateForm}>
                取消
              </Button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-xs text-stone-600">
                <span>Display Name</span>
                <Input
                  value={displayName}
                  onChange={event => setDisplayName(event.target.value)}
                  placeholder="GitHub MCP"
                />
              </label>
              <label className="grid gap-2 text-xs text-stone-600">
                <span>Transport</span>
                <select
                  value={transport}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    setTransport(event.target.value as 'stdio' | 'http')
                  }
                  className="flex h-10 w-full rounded-2xl border border-stone-200 bg-white px-4 py-2 text-sm text-stone-900 shadow-sm outline-none transition focus:border-stone-300 focus:ring-2 focus:ring-stone-200"
                >
                  <option value="stdio">stdio</option>
                  <option value="http">http</option>
                </select>
              </label>
              {transport === 'http' ? (
                <label className="grid gap-2 text-xs text-stone-600 md:col-span-2">
                  <span>Endpoint</span>
                  <Input
                    value={endpoint}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setEndpoint(event.target.value)}
                    placeholder="https://mcp.example.com"
                  />
                </label>
              ) : (
                <>
                  <label className="grid gap-2 text-xs text-stone-600">
                    <span>Command</span>
                    <Input
                      value={command}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setCommand(event.target.value)}
                      placeholder="npx"
                    />
                  </label>
                  <label className="grid gap-2 text-xs text-stone-600">
                    <span>Args</span>
                    <Input
                      value={argsText}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setArgsText(event.target.value)}
                      placeholder="-y github-mcp-server"
                    />
                  </label>
                </>
              )}
              <label className="grid gap-2 text-xs text-stone-600 md:col-span-2">
                <span>API Key / Token</span>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setApiKey(event.target.value)}
                  placeholder="可选，保存到运行态配置"
                />
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  onConfigureConnector({
                    templateId: configuringTemplateId,
                    transport,
                    displayName: displayName || undefined,
                    endpoint: transport === 'http' ? endpoint || undefined : undefined,
                    command: transport === 'stdio' ? command || undefined : undefined,
                    args: transport === 'stdio' ? argsText.split(/\s+/).filter(Boolean) : undefined,
                    apiKey: apiKey || undefined
                  });
                  closeTemplateForm();
                }}
                disabled={transport === 'http' ? !endpoint.trim() : !command.trim()}
              >
                保存配置
              </Button>
            </div>
          </div>
        ) : null}
        {connectors.length === 0 ? (
          <p className="text-sm text-stone-500">当前没有已注册的 MCP connectors。</p>
        ) : (
          connectors.map(connector => (
            <article key={connector.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-stone-950">{connector.displayName}</p>
                  <p className="mt-1 text-xs text-stone-500">{connector.id}</p>
                </div>
                <Badge
                  variant={
                    connector.healthState === 'healthy'
                      ? 'success'
                      : connector.healthState === 'disabled'
                        ? 'destructive'
                        : 'warning'
                  }
                >
                  {connector.healthState}
                </Badge>
              </div>
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
                {connector.discoveryMode ? (
                  <Badge variant="secondary">discovery {connector.discoveryMode}</Badge>
                ) : null}
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
              {connector.healthReason ? <p className="mt-3 text-xs text-stone-500">{connector.healthReason}</p> : null}
              {connector.source ? <p className="mt-1 text-xs text-stone-500">source: {connector.source}</p> : null}
              {connector.authMode ? <p className="mt-1 text-xs text-stone-500">auth: {connector.authMode}</p> : null}
              {connector.dataScope ? (
                <p className="mt-1 text-xs text-stone-500">data scope: {connector.dataScope}</p>
              ) : null}
              {connector.writeScope ? (
                <p className="mt-1 text-xs text-stone-500">write scope: {connector.writeScope}</p>
              ) : null}
              {connector.allowedProfiles?.length ? (
                <p className="mt-1 text-xs text-stone-500">profiles: {connector.allowedProfiles.join(', ')}</p>
              ) : null}
              {connector.configurationTemplateId || connector.endpoint || connector.command ? (
                <div className="mt-3 rounded-xl border border-stone-200 bg-white px-3 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Configuration</p>
                  {connector.configurationTemplateId ? (
                    <p className="mt-2 text-xs text-stone-600">template: {connector.configurationTemplateId}</p>
                  ) : null}
                  {connector.configuredAt ? (
                    <p className="mt-1 text-xs text-stone-600">configured at: {connector.configuredAt}</p>
                  ) : null}
                  {connector.endpoint ? (
                    <p className="mt-1 break-all text-xs text-stone-600">endpoint: {connector.endpoint}</p>
                  ) : null}
                  {connector.command ? (
                    <p className="mt-1 text-xs text-stone-600">
                      command: {connector.command}
                      {connector.args?.length ? ` ${connector.args.join(' ')}` : ''}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {connector.firstUsedAt ? (
                <p className="mt-1 text-xs text-stone-500">first used {connector.firstUsedAt}</p>
              ) : null}
              {connector.lastUsedAt ? (
                <p className="mt-1 text-xs text-stone-500">last used {connector.lastUsedAt}</p>
              ) : null}
              {connector.recentFailureReason ? (
                <p className="mt-1 text-xs text-rose-600">recent failure: {connector.recentFailureReason}</p>
              ) : null}
              {connector.profilePolicy ? (
                <p className="mt-1 text-xs text-stone-500">profile policy: {connector.profilePolicy.reason}</p>
              ) : null}
              {connector.recentTaskGoals?.length ? (
                <div className="mt-3 rounded-xl border border-stone-200 bg-white px-3 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Recent Goals</p>
                  <ul className="mt-2 space-y-1 text-sm text-stone-600">
                    {connector.recentTaskGoals.map(goal => (
                      <li key={`${connector.id}-${goal}`}>{goal}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {connector.lastDiscoveredAt ? (
                <p className="mt-1 text-xs text-stone-500">last discovered {connector.lastDiscoveredAt}</p>
              ) : null}
              {connector.sessionCreatedAt ? (
                <p className="mt-1 text-xs text-stone-500">session created {connector.sessionCreatedAt}</p>
              ) : null}
              {connector.sessionLastActivityAt ? (
                <p className="mt-1 text-xs text-stone-500">last activity {connector.sessionLastActivityAt}</p>
              ) : null}
              {typeof connector.sessionRequestCount === 'number' ? (
                <p className="mt-1 text-xs text-stone-500">session requests {connector.sessionRequestCount}</p>
              ) : null}
              {typeof connector.sessionIdleMs === 'number' ? (
                <p className="mt-1 text-xs text-stone-500">idle {Math.round(connector.sessionIdleMs / 1000)}s</p>
              ) : null}
              {connector.lastDiscoveryError ? (
                <p className="mt-1 text-xs text-amber-700">{connector.lastDiscoveryError}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    connector.enabled ? onDisableConnector(connector.id) : onEnableConnector(connector.id)
                  }
                  className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-stone-700"
                >
                  {connector.enabled ? '停用 connector' : '启用 connector'}
                </button>
                <button
                  type="button"
                  onClick={() => onRefreshConnectorDiscovery(connector.id)}
                  className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-stone-700"
                >
                  刷新发现
                </button>
                {(connector.id === 'github-mcp-template' || connector.id === 'browser-mcp-template') &&
                !connector.enabled ? (
                  <button
                    type="button"
                    onClick={() => openTemplateForm(connector.id as 'github-mcp-template' | 'browser-mcp-template')}
                    className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-stone-700"
                  >
                    配置模板
                  </button>
                ) : null}
                {(connector.configurationTemplateId ||
                  connector.id === 'github-mcp' ||
                  connector.id === 'browser-mcp') &&
                connector.installationMode === 'configured' ? (
                  <button
                    type="button"
                    onClick={() =>
                      openTemplateForm(
                        (connector.configurationTemplateId ??
                          (connector.id === 'github-mcp' ? 'github-mcp-template' : 'browser-mcp-template')) as
                          | 'github-mcp-template'
                          | 'browser-mcp-template',
                        connector
                      )
                    }
                    className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-stone-700"
                  >
                    编辑配置
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onSetConnectorPolicy(connector.id, 'require-approval')}
                  className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-stone-700"
                >
                  强制审批
                </button>
                <button
                  type="button"
                  onClick={() => onSetConnectorPolicy(connector.id, 'allow')}
                  className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-stone-700"
                >
                  允许直通
                </button>
                <button
                  type="button"
                  onClick={() => onSetConnectorPolicy(connector.id, 'deny')}
                  className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-stone-700"
                >
                  禁止执行
                </button>
                <button
                  type="button"
                  onClick={() => onClearConnectorPolicy(connector.id)}
                  className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-stone-700"
                >
                  清除策略
                </button>
                {connector.transport === 'stdio' && connector.sessionState === 'connected' ? (
                  <button
                    type="button"
                    onClick={() => onCloseSession(connector.id)}
                    className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-stone-700"
                  >
                    关闭 session
                  </button>
                ) : null}
              </div>
              {connector.discoveredCapabilities?.length ? (
                <div className="mt-3 rounded-xl border border-stone-200 bg-white px-3 py-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
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
                    className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-stone-900">{capability.toolName}</span>
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
                      {capability.approvalPolicy ? (
                        <Badge variant="secondary">{capability.approvalPolicy}</Badge>
                      ) : null}
                      {capability.trustClass ? <Badge variant="secondary">{capability.trustClass}</Badge> : null}
                      {capability.dataScope ? <Badge variant="outline">{capability.dataScope}</Badge> : null}
                      {capability.writeScope ? <Badge variant="outline">{capability.writeScope}</Badge> : null}
                      {typeof capability.usageCount === 'number' ? (
                        <Badge variant="outline">used {capability.usageCount}</Badge>
                      ) : null}
                    </div>
                    {capability.policyReason ? <p className="mt-2 text-stone-500">{capability.policyReason}</p> : null}
                    {capability.recentTaskGoals?.length ? (
                      <div className="mt-2 rounded-lg border border-stone-200 bg-stone-50 px-2 py-2">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-stone-500">
                          Recent Capability Goals
                        </p>
                        <ul className="mt-1 space-y-1 text-stone-600">
                          {capability.recentTaskGoals.map(goal => (
                            <li key={`${capability.id}-${goal}`}>{goal}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {capability.recentTasks?.length ? (
                      <div className="mt-2 rounded-lg border border-stone-200 bg-white px-2 py-2">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-stone-500">
                          Task Drill-down
                        </p>
                        <div className="mt-2 grid gap-2">
                          {capability.recentTasks.map(task => (
                            <div
                              key={`${capability.id}-${task.taskId}`}
                              className="rounded-md border border-stone-200 bg-stone-50 px-2 py-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-stone-900">{task.goal}</p>
                                  <p className="mt-1 text-[11px] text-stone-500">
                                    {task.taskId} · {task.status} · approvals {task.approvalCount}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => onSelectTask(task.taskId)}
                                  className="rounded-full border border-stone-300 bg-white px-2.5 py-1 text-[11px] text-stone-700"
                                >
                                  查看任务
                                </button>
                              </div>
                              {task.latestTraceSummary ? (
                                <p className="mt-2 text-[11px] text-stone-600">{task.latestTraceSummary}</p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onSetCapabilityPolicy(connector.id, capability.id, 'require-approval')}
                        className="rounded-full border border-stone-300 bg-white px-2.5 py-1 text-[11px] text-stone-700"
                      >
                        审批
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetCapabilityPolicy(connector.id, capability.id, 'allow')}
                        className="rounded-full border border-stone-300 bg-white px-2.5 py-1 text-[11px] text-stone-700"
                      >
                        允许
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetCapabilityPolicy(connector.id, capability.id, 'deny')}
                        className="rounded-full border border-stone-300 bg-white px-2.5 py-1 text-[11px] text-stone-700"
                      >
                        禁止
                      </button>
                      <button
                        type="button"
                        onClick={() => onClearCapabilityPolicy(connector.id, capability.id)}
                        className="rounded-full border border-stone-300 bg-white px-2.5 py-1 text-[11px] text-stone-700"
                      >
                        清除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {connector.approvalPolicies?.length ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700">Approval Policies</p>
                  <div className="mt-2 grid gap-2">
                    {connector.approvalPolicies.slice(0, 4).map(policy => (
                      <div key={policy.id} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-stone-900">{policy.targetId}</span>
                          <Badge variant="outline">{policy.mode}</Badge>
                        </div>
                        <p className="mt-1 text-stone-600">{policy.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {connector.healthChecks?.length ? (
                <div className="mt-3 rounded-xl border border-stone-200 bg-white px-3 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Health Checks</p>
                  <div className="mt-2 grid gap-2">
                    {connector.healthChecks.slice(0, 2).map(check => (
                      <div
                        key={`${connector.id}-${check.checkedAt}`}
                        className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-stone-900">{check.healthState}</span>
                          <span className="text-stone-500">{check.checkedAt}</span>
                        </div>
                        {check.reason ? <p className="mt-1 text-stone-600">{check.reason}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {connector.discoveryHistory?.length ? (
                <div className="mt-3 rounded-xl border border-stone-200 bg-white px-3 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Discovery History</p>
                  <div className="mt-2 grid gap-2">
                    {connector.discoveryHistory.slice(0, 3).map(entry => (
                      <div
                        key={`${connector.id}-${entry.discoveredAt}-${entry.discoveryMode}`}
                        className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-stone-900">{entry.discoveryMode}</span>
                          <span className="text-stone-500">{entry.discoveredAt}</span>
                        </div>
                        <p className="mt-1 text-stone-600">session: {entry.sessionState}</p>
                        <p className="mt-1 text-stone-600">
                          capabilities: {entry.discoveredCapabilities.slice(0, 5).join(', ') || 'none'}
                        </p>
                        {entry.error ? <p className="mt-1 text-amber-700">error: {entry.error}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {connector.recentGovernanceAudits?.length ? (
                <div className="mt-3 rounded-xl border border-stone-200 bg-white px-3 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Governance Timeline</p>
                  <div className="mt-2 grid gap-2">
                    {connector.recentGovernanceAudits.slice(0, 4).map(entry => (
                      <div key={entry.id} className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-stone-900">{entry.action}</span>
                          <Badge
                            variant={
                              entry.outcome === 'success'
                                ? 'success'
                                : entry.outcome === 'pending'
                                  ? 'warning'
                                  : 'destructive'
                            }
                          >
                            {entry.outcome}
                          </Badge>
                        </div>
                        <p className="mt-1 text-stone-600">{entry.at}</p>
                        <p className="mt-1 text-stone-600">actor: {entry.actor}</p>
                        {entry.reason ? <p className="mt-1 text-stone-600">{entry.reason}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}
