import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const connectorTemplateFormState = vi.hoisted(() => ({
  renderedButtons: [] as Array<{ children?: React.ReactNode; onClick?: () => void }>,
  renderedInputs: [] as Array<{
    placeholder?: string;
    onChange?: (event: { target: { value: string } }) => void;
  }>
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => {
    connectorTemplateFormState.renderedButtons.push({ children, onClick });
    return <button onClick={onClick}>{children}</button>;
  }
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    placeholder,
    onChange
  }: {
    placeholder?: string;
    onChange?: (event: { target: { value: string } }) => void;
  }) => {
    connectorTemplateFormState.renderedInputs.push({ placeholder, onChange });
    return <input />;
  }
}));

import { ConnectorTemplateForm } from '@/pages/connectors-center/connector-template-form';

describe('ConnectorTemplateForm', () => {
  beforeEach(() => {
    connectorTemplateFormState.renderedButtons.length = 0;
    connectorTemplateFormState.renderedInputs.length = 0;
  });

  it('renders stdio and http variants', () => {
    const stdioHtml = renderToStaticMarkup(
      <ConnectorTemplateForm
        templateId="github-mcp-template"
        transport="stdio"
        displayName="GitHub MCP"
        endpoint=""
        command="npx"
        argsText="-y github-mcp-server"
        apiKey=""
        onTransportChange={vi.fn()}
        onDisplayNameChange={vi.fn()}
        onEndpointChange={vi.fn()}
        onCommandChange={vi.fn()}
        onArgsTextChange={vi.fn()}
        onApiKeyChange={vi.fn()}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const httpHtml = renderToStaticMarkup(
      <ConnectorTemplateForm
        templateId="lark-mcp-template"
        transport="http"
        displayName="Lark MCP"
        endpoint="https://mcp.example.com"
        command=""
        argsText=""
        apiKey="secret"
        onTransportChange={vi.fn()}
        onDisplayNameChange={vi.fn()}
        onEndpointChange={vi.fn()}
        onCommandChange={vi.fn()}
        onArgsTextChange={vi.fn()}
        onApiKeyChange={vi.fn()}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(stdioHtml).toContain('Display Name');
    expect(stdioHtml).toContain('Command');
    expect(stdioHtml).toContain('Args');
    expect(stdioHtml).toContain('保存配置');
    expect(httpHtml).toContain('Endpoint');
    expect(httpHtml).toContain('API Key / Token');
  });

  it('routes input changes, cancel and stdio submit payload through callbacks', () => {
    const onDisplayNameChange = vi.fn();
    const onCommandChange = vi.fn();
    const onArgsTextChange = vi.fn();
    const onApiKeyChange = vi.fn();
    const onCancel = vi.fn();
    const onSubmit = vi.fn();

    renderToStaticMarkup(
      <ConnectorTemplateForm
        templateId="github-mcp-template"
        transport="stdio"
        displayName="GitHub MCP"
        endpoint=""
        command="npx"
        argsText="-y github-mcp-server"
        apiKey="secret"
        onTransportChange={vi.fn()}
        onDisplayNameChange={onDisplayNameChange}
        onEndpointChange={vi.fn()}
        onCommandChange={onCommandChange}
        onArgsTextChange={onArgsTextChange}
        onApiKeyChange={onApiKeyChange}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    );

    connectorTemplateFormState.renderedInputs
      .find(item => item.placeholder === 'GitHub MCP')
      ?.onChange?.({ target: { value: 'GitHub Enterprise MCP' } });
    connectorTemplateFormState.renderedInputs
      .find(item => item.placeholder === 'npx')
      ?.onChange?.({ target: { value: 'pnpm' } });
    connectorTemplateFormState.renderedInputs
      .find(item => item.placeholder === '-y github-mcp-server')
      ?.onChange?.({ target: { value: '--github-mcp-server --verbose' } });
    connectorTemplateFormState.renderedInputs
      .find(item => item.placeholder === '可选，保存到运行态配置')
      ?.onChange?.({ target: { value: 'next-secret' } });

    connectorTemplateFormState.renderedButtons.find(item => item.children === '取消')?.onClick?.();
    connectorTemplateFormState.renderedButtons.find(item => item.children === '保存配置')?.onClick?.();

    expect(onDisplayNameChange).toHaveBeenCalledWith('GitHub Enterprise MCP');
    expect(onCommandChange).toHaveBeenCalledWith('pnpm');
    expect(onArgsTextChange).toHaveBeenCalledWith('--github-mcp-server --verbose');
    expect(onApiKeyChange).toHaveBeenCalledWith('next-secret');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      templateId: 'github-mcp-template',
      transport: 'stdio',
      displayName: 'GitHub MCP',
      endpoint: undefined,
      command: 'npx',
      args: ['-y', 'github-mcp-server'],
      apiKey: 'secret'
    });
  });

  it('submits the http payload with endpoint and no stdio-only fields', () => {
    const onSubmit = vi.fn();

    renderToStaticMarkup(
      <ConnectorTemplateForm
        templateId="lark-mcp-template"
        transport="http"
        displayName="Lark MCP"
        endpoint="https://mcp.example.com"
        command=""
        argsText=""
        apiKey=""
        onTransportChange={vi.fn()}
        onDisplayNameChange={vi.fn()}
        onEndpointChange={vi.fn()}
        onCommandChange={vi.fn()}
        onArgsTextChange={vi.fn()}
        onApiKeyChange={vi.fn()}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    connectorTemplateFormState.renderedButtons.find(item => item.children === '保存配置')?.onClick?.();

    expect(onSubmit).toHaveBeenCalledWith({
      templateId: 'lark-mcp-template',
      transport: 'http',
      displayName: 'Lark MCP',
      endpoint: 'https://mcp.example.com',
      command: undefined,
      args: undefined,
      apiKey: undefined
    });
  });
});
