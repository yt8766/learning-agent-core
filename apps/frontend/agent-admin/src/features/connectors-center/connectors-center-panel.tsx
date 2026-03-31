import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { DashboardCenterShell, DashboardEmptyState } from '@/components/dashboard-center-shell';

import type { ConnectorRecord } from '@/types/admin';
import { ConnectorCard } from './connector-card';
import { ConnectorsCenterSummary } from './connectors-center-summary';
import { ConnectorTemplateForm } from './connector-template-form';
import type { ConnectorsCenterPanelProps } from './connectors-center-types';

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
    'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template' | ''
  >('');
  const [transport, setTransport] = useState<'stdio' | 'http'>('stdio');
  const [displayName, setDisplayName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [command, setCommand] = useState('npx');
  const [argsText, setArgsText] = useState('');
  const [apiKey, setApiKey] = useState('');

  const openTemplateForm = (
    templateId: 'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template',
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
    <DashboardCenterShell
      title="Connector & Policy Center"
      description="统一查看 connector 注册、模板配置与 policy 覆盖情况。"
      count={connectors.length}
      actions={<Badge variant="secondary">MCP Connectors</Badge>}
    >
      <div className="grid gap-4">
        <ConnectorsCenterSummary connectors={connectors} />
        {configuringTemplateId ? (
          <ConnectorTemplateForm
            templateId={configuringTemplateId}
            transport={transport}
            displayName={displayName}
            endpoint={endpoint}
            command={command}
            argsText={argsText}
            apiKey={apiKey}
            onTransportChange={setTransport}
            onDisplayNameChange={setDisplayName}
            onEndpointChange={setEndpoint}
            onCommandChange={setCommand}
            onArgsTextChange={setArgsText}
            onApiKeyChange={setApiKey}
            onCancel={closeTemplateForm}
            onSubmit={params => {
              onConfigureConnector(params);
              closeTemplateForm();
            }}
          />
        ) : null}
        {connectors.length === 0 ? (
          <DashboardEmptyState message="当前没有已注册的 MCP connectors。" />
        ) : (
          connectors.map(connector => (
            <div key={connector.id}>
              <ConnectorCard
                connector={connector}
                onSelectTask={onSelectTask}
                onCloseSession={onCloseSession}
                onRefreshConnectorDiscovery={onRefreshConnectorDiscovery}
                onEnableConnector={onEnableConnector}
                onDisableConnector={onDisableConnector}
                onSetConnectorPolicy={onSetConnectorPolicy}
                onClearConnectorPolicy={onClearConnectorPolicy}
                onSetCapabilityPolicy={onSetCapabilityPolicy}
                onClearCapabilityPolicy={onClearCapabilityPolicy}
                onOpenTemplateForm={openTemplateForm}
              />
            </div>
          ))
        )}
      </div>
    </DashboardCenterShell>
  );
}
