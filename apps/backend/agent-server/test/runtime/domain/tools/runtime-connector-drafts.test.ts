import { describe, expect, it } from 'vitest';
import type { ConfiguredConnectorRecord } from '@agent/core';

import {
  buildConnectorDraftConfig,
  buildConnectorSecretUpdateConfig,
  findConfiguredConnector
} from '../../../../src/runtime/domain/tools/runtime-connector-drafts';

describe('runtime connector drafts domain helpers', () => {
  it('builds connector draft config from known templates', () => {
    expect(
      buildConnectorDraftConfig({
        templateId: 'github-mcp-template',
        displayName: 'GitHub MCP',
        actor: 'author'
      })
    ).toMatchObject({
      templateId: 'github-mcp-template',
      transport: 'stdio',
      displayName: 'GitHub MCP',
      command: 'npx',
      args: ['-y', 'github-mcp-server'],
      actor: 'author',
      enabled: false
    });

    expect(
      buildConnectorDraftConfig({
        templateId: 'lark-mcp-template',
        displayName: 'Lark MCP'
      })
    ).toMatchObject({
      templateId: 'lark-mcp-template',
      transport: 'http',
      displayName: 'Lark MCP',
      actor: 'agent-chat-user',
      enabled: false
    });

    expect(
      buildConnectorDraftConfig({
        templateId: 'browser-mcp-template'
      })
    ).toMatchObject({
      templateId: 'browser-mcp-template',
      displayName: 'Browser MCP'
    });
  });

  it('finds configured connectors by connector id', () => {
    const configuredConnectors: ConfiguredConnectorRecord[] = [
      {
        connectorId: 'github-mcp',
        templateId: 'github-mcp-template',
        displayName: 'GitHub MCP',
        transport: 'stdio',
        enabled: true
      }
    ];

    expect(findConfiguredConnector(configuredConnectors, 'github-mcp')).toEqual(configuredConnectors[0]);
    expect(findConfiguredConnector(configuredConnectors, 'missing')).toBeUndefined();
  });

  it('builds secret update config from configured connectors', () => {
    const configured: ConfiguredConnectorRecord = {
      connectorId: 'browser-mcp',
      templateId: 'browser-mcp-template',
      displayName: 'Browser MCP',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'browserbase-mcp'],
      enabled: true
    };

    expect(buildConnectorSecretUpdateConfig(configured, 'secret-value', 'admin')).toEqual({
      templateId: 'browser-mcp-template',
      transport: 'stdio',
      displayName: 'Browser MCP',
      endpoint: undefined,
      command: 'npx',
      args: ['-y', 'browserbase-mcp'],
      apiKey: 'secret-value',
      enabled: true,
      actor: 'admin'
    });
  });
});
