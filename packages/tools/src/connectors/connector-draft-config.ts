import type { ConfigureConnectorDto, ConfiguredConnectorRecord } from '@agent/core';

export function buildConnectorDraftConfig(input: {
  templateId: ConfigureConnectorDto['templateId'];
  displayName?: string;
  actor?: string;
}): ConfigureConnectorDto {
  const base = defaultConnectorConfig(input.templateId);
  return {
    ...base,
    displayName: input.displayName ?? base.displayName,
    actor: input.actor ?? 'agent-chat-user',
    enabled: false
  };
}

export function findConfiguredConnector(
  configuredConnectors: ConfiguredConnectorRecord[],
  connectorId: string
): ConfiguredConnectorRecord | undefined {
  return configuredConnectors.find(item => item.connectorId === connectorId);
}

export function buildConnectorSecretUpdateConfig(
  configured: ConfiguredConnectorRecord,
  apiKey: string,
  actor = 'agent-admin-user'
): ConfigureConnectorDto {
  return {
    templateId: configured.templateId,
    transport: configured.transport,
    displayName: configured.displayName,
    endpoint: configured.endpoint,
    command: configured.command,
    args: configured.args,
    apiKey,
    enabled: configured.enabled,
    actor
  };
}

function defaultConnectorConfig(
  templateId: ConfigureConnectorDto['templateId']
): Pick<ConfigureConnectorDto, 'templateId' | 'transport' | 'displayName' | 'command' | 'args'> {
  if (templateId === 'github-mcp-template') {
    return {
      templateId,
      transport: 'stdio',
      displayName: 'GitHub MCP',
      command: 'npx',
      args: ['-y', 'github-mcp-server']
    };
  }
  if (templateId === 'browser-mcp-template') {
    return {
      templateId,
      transport: 'stdio',
      displayName: 'Browser MCP',
      command: 'npx',
      args: ['-y', 'browserbase-mcp']
    };
  }
  return {
    templateId,
    transport: 'http',
    displayName: 'Lark MCP'
  };
}
