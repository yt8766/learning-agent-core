import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const connectorsPanelHarness = vi.hoisted(() => ({
  stateQueue: [] as Array<{ value: unknown; setter?: (...args: unknown[]) => void }>,
  triggerTemplateOpen: undefined as
    | undefined
    | {
        templateId: 'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template';
        connector?: any;
      },
  autoSubmitTemplate: false,
  autoCancelTemplate: false
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: ((initialValue: unknown) => {
      const next = connectorsPanelHarness.stateQueue.shift();
      return [next?.value ?? initialValue, next?.setter ?? vi.fn()];
    }) as typeof actual.useState
  };
});

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>
}));

vi.mock('@/components/dashboard-center-shell', () => ({
  DashboardCenterShell: ({
    title,
    description,
    count,
    actions,
    children
  }: {
    title?: React.ReactNode;
    description?: React.ReactNode;
    count?: number;
    actions?: React.ReactNode;
    children?: React.ReactNode;
  }) => (
    <section>
      <h1>{title}</h1>
      <p>{description}</p>
      <span>count:{count}</span>
      <div>{actions}</div>
      <div>{children}</div>
    </section>
  ),
  DashboardEmptyState: ({ message }: { message?: React.ReactNode }) => <div>{message}</div>
}));

vi.mock('@/features/connectors-center/connectors-center-summary', () => ({
  ConnectorsCenterSummary: ({ connectors }: { connectors: Array<{ id: string }> }) => (
    <div>summary:{connectors.map(item => item.id).join(',')}</div>
  )
}));

vi.mock('@/features/connectors-center/connector-card', () => ({
  ConnectorCard: ({
    connector,
    onOpenTemplateForm
  }: {
    connector: { id: string; displayName: string };
    onOpenTemplateForm: (
      templateId: 'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template',
      connector?: any
    ) => void;
  }) => {
    if (
      connectorsPanelHarness.triggerTemplateOpen &&
      connector.id === (connectorsPanelHarness.triggerTemplateOpen.connector?.id ?? connector.id)
    ) {
      const trigger = connectorsPanelHarness.triggerTemplateOpen;
      connectorsPanelHarness.triggerTemplateOpen = undefined;
      onOpenTemplateForm(trigger.templateId, trigger.connector);
    }
    return <div>connector-card:{connector.displayName}</div>;
  }
}));

vi.mock('@/features/connectors-center/connector-template-form', () => ({
  ConnectorTemplateForm: (props: any) => {
    if (connectorsPanelHarness.autoSubmitTemplate) {
      connectorsPanelHarness.autoSubmitTemplate = false;
      props.onSubmit({
        templateId: props.templateId,
        transport: props.transport,
        displayName: props.displayName,
        endpoint: props.endpoint || undefined,
        command: props.command || undefined,
        args: props.argsText ? props.argsText.split(/\s+/).filter(Boolean) : undefined,
        apiKey: props.apiKey || undefined
      });
    }
    if (connectorsPanelHarness.autoCancelTemplate) {
      connectorsPanelHarness.autoCancelTemplate = false;
      props.onCancel();
    }
    return (
      <div>
        template-form:{props.templateId}:{props.transport}:{props.displayName}:{props.command}:{props.argsText}:
        {props.endpoint}:{props.apiKey}
      </div>
    );
  }
}));

import { ConnectorsCenterPanel } from '@/features/connectors-center/connectors-center-panel';

function resetHarness() {
  connectorsPanelHarness.stateQueue.length = 0;
  connectorsPanelHarness.triggerTemplateOpen = undefined;
  connectorsPanelHarness.autoSubmitTemplate = false;
  connectorsPanelHarness.autoCancelTemplate = false;
}

afterEach(() => {
  resetHarness();
  vi.clearAllMocks();
});

describe('ConnectorsCenterPanel', () => {
  const baseProps = {
    onSelectTask: vi.fn(),
    onCloseSession: vi.fn(),
    onRefreshConnectorDiscovery: vi.fn(),
    onEnableConnector: vi.fn(),
    onDisableConnector: vi.fn(),
    onSetConnectorPolicy: vi.fn(),
    onClearConnectorPolicy: vi.fn(),
    onSetCapabilityPolicy: vi.fn(),
    onClearCapabilityPolicy: vi.fn(),
    onConfigureConnector: vi.fn()
  };

  it('renders summary, shell metadata, and empty state when there are no connectors', () => {
    connectorsPanelHarness.stateQueue.push(
      { value: '' },
      { value: 'stdio' },
      { value: '' },
      { value: '' },
      { value: 'npx' },
      { value: '' },
      { value: '' }
    );

    const html = renderToStaticMarkup(<ConnectorsCenterPanel connectors={[]} {...baseProps} />);

    expect(html).toContain('Connector &amp; Policy Center');
    expect(html).toContain('统一查看 connector 注册、模板配置与 policy 覆盖情况。');
    expect(html).toContain('count:0');
    expect(html).toContain('MCP Connectors');
    expect(html).toContain('summary:');
    expect(html).toContain('当前没有已注册的 MCP connectors。');
    expect(html).not.toContain('template-form:');
  });

  it('renders connector cards for existing connectors', () => {
    connectorsPanelHarness.stateQueue.push(
      { value: '' },
      { value: 'stdio' },
      { value: '' },
      { value: '' },
      { value: 'npx' },
      { value: '' },
      { value: '' }
    );

    const html = renderToStaticMarkup(
      <ConnectorsCenterPanel
        connectors={
          [
            { id: 'github-mcp', displayName: 'GitHub MCP' },
            { id: 'browser-mcp', displayName: 'Browser MCP' }
          ] as any
        }
        {...baseProps}
      />
    );

    expect(html).toContain('summary:github-mcp,browser-mcp');
    expect(html).toContain('connector-card:GitHub MCP');
    expect(html).toContain('connector-card:Browser MCP');
  });

  it('opens template form with github defaults for template connectors', () => {
    const setTemplateId = vi.fn();
    const setTransport = vi.fn();
    const setDisplayName = vi.fn();
    const setEndpoint = vi.fn();
    const setCommand = vi.fn();
    const setArgsText = vi.fn();
    const setApiKey = vi.fn();
    connectorsPanelHarness.stateQueue.push(
      { value: '', setter: setTemplateId },
      { value: 'stdio', setter: setTransport },
      { value: '', setter: setDisplayName },
      { value: '', setter: setEndpoint },
      { value: 'npx', setter: setCommand },
      { value: '', setter: setArgsText },
      { value: '', setter: setApiKey }
    );
    connectorsPanelHarness.triggerTemplateOpen = {
      templateId: 'github-mcp-template'
    };

    renderToStaticMarkup(
      <ConnectorsCenterPanel
        connectors={[{ id: 'github-mcp-template', displayName: 'GitHub Template' }] as any}
        {...baseProps}
      />
    );

    expect(setTemplateId).toHaveBeenCalledWith('github-mcp-template');
    expect(setTransport).toHaveBeenCalledWith('stdio');
    expect(setDisplayName).toHaveBeenCalledWith('GitHub MCP');
    expect(setEndpoint).toHaveBeenCalledWith('');
    expect(setCommand).toHaveBeenCalledWith('npx');
    expect(setArgsText).toHaveBeenCalledWith('-y github-mcp-server');
    expect(setApiKey).toHaveBeenCalledWith('');
  });

  it('opens template form with connector overrides and browser fallback defaults', () => {
    const setTemplateId = vi.fn();
    const setTransport = vi.fn();
    const setDisplayName = vi.fn();
    const setEndpoint = vi.fn();
    const setCommand = vi.fn();
    const setArgsText = vi.fn();
    const setApiKey = vi.fn();
    connectorsPanelHarness.stateQueue.push(
      { value: '', setter: setTemplateId },
      { value: 'stdio', setter: setTransport },
      { value: '', setter: setDisplayName },
      { value: '', setter: setEndpoint },
      { value: 'npx', setter: setCommand },
      { value: '', setter: setArgsText },
      { value: '', setter: setApiKey }
    );
    connectorsPanelHarness.triggerTemplateOpen = {
      templateId: 'lark-mcp-template',
      connector: {
        id: 'lark-mcp',
        displayName: 'Lark MCP',
        transport: 'http',
        endpoint: 'https://mcp.example.com',
        command: 'pnpm',
        args: ['exec', 'lark-mcp']
      }
    };

    renderToStaticMarkup(
      <ConnectorsCenterPanel connectors={[{ id: 'lark-mcp', displayName: 'Lark MCP' }] as any} {...baseProps} />
    );

    expect(setTemplateId).toHaveBeenCalledWith('lark-mcp-template');
    expect(setTransport).toHaveBeenCalledWith('http');
    expect(setDisplayName).toHaveBeenCalledWith('Lark MCP');
    expect(setEndpoint).toHaveBeenCalledWith('https://mcp.example.com');
    expect(setCommand).toHaveBeenCalledWith('pnpm');
    expect(setArgsText).toHaveBeenCalledWith('exec lark-mcp');
    expect(setApiKey).toHaveBeenCalledWith('');
  });

  it('submits connector config and closes the template form afterwards', () => {
    const onConfigureConnector = vi.fn();
    const setTemplateId = vi.fn();
    const setEndpoint = vi.fn();
    const setApiKey = vi.fn();
    connectorsPanelHarness.stateQueue.push(
      { value: 'github-mcp-template', setter: setTemplateId },
      { value: 'http' },
      { value: 'GitHub MCP' },
      { value: 'https://mcp.example.com', setter: setEndpoint },
      { value: 'npx' },
      { value: '-y github-mcp-server' },
      { value: 'secret', setter: setApiKey }
    );
    connectorsPanelHarness.autoSubmitTemplate = true;

    const html = renderToStaticMarkup(
      <ConnectorsCenterPanel
        connectors={[{ id: 'github-mcp', displayName: 'GitHub MCP' }] as any}
        {...baseProps}
        onConfigureConnector={onConfigureConnector}
      />
    );

    expect(html).toContain(
      'template-form:github-mcp-template:http:GitHub MCP:npx:-y github-mcp-server:https://mcp.example.com:secret'
    );
    expect(onConfigureConnector).toHaveBeenCalledWith({
      templateId: 'github-mcp-template',
      transport: 'http',
      displayName: 'GitHub MCP',
      endpoint: 'https://mcp.example.com',
      command: 'npx',
      args: ['-y', 'github-mcp-server'],
      apiKey: 'secret'
    });
    expect(setTemplateId).toHaveBeenCalledWith('');
    expect(setEndpoint).toHaveBeenCalledWith('');
    expect(setApiKey).toHaveBeenCalledWith('');
  });

  it('cancels template editing and clears transient fields', () => {
    const setTemplateId = vi.fn();
    const setEndpoint = vi.fn();
    const setApiKey = vi.fn();
    connectorsPanelHarness.stateQueue.push(
      { value: 'browser-mcp-template', setter: setTemplateId },
      { value: 'stdio' },
      { value: 'Browser MCP' },
      { value: 'https://old-endpoint.example', setter: setEndpoint },
      { value: 'npx' },
      { value: '-y browserbase-mcp' },
      { value: 'old-secret', setter: setApiKey }
    );
    connectorsPanelHarness.autoCancelTemplate = true;

    renderToStaticMarkup(
      <ConnectorsCenterPanel connectors={[{ id: 'browser-mcp', displayName: 'Browser MCP' }] as any} {...baseProps} />
    );

    expect(setTemplateId).toHaveBeenCalledWith('');
    expect(setEndpoint).toHaveBeenCalledWith('');
    expect(setApiKey).toHaveBeenCalledWith('');
  });
});
