import type { ConnectorRecord } from '@/types/admin';

export interface ConnectorTemplateConfigParams {
  templateId: 'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template';
  transport: 'stdio' | 'http';
  displayName?: string;
  endpoint?: string;
  command?: string;
  args?: string[];
  apiKey?: string;
}

export interface ConnectorsCenterPanelProps {
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
  onConfigureConnector: (params: ConnectorTemplateConfigParams) => void;
}
