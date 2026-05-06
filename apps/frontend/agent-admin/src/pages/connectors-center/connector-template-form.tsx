import type { ChangeEvent, ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import type { ConnectorTemplateConfigParams } from './connectors-center-types';

interface ConnectorTemplateFormProps {
  templateId: 'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template';
  transport: 'stdio' | 'http';
  displayName: string;
  endpoint: string;
  command: string;
  argsText: string;
  apiKey: string;
  onTransportChange: (value: 'stdio' | 'http') => void;
  onDisplayNameChange: (value: string) => void;
  onEndpointChange: (value: string) => void;
  onCommandChange: (value: string) => void;
  onArgsTextChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: (params: ConnectorTemplateConfigParams) => void;
}

export function ConnectorTemplateForm(props: ConnectorTemplateFormProps) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">配置 {props.templateId}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            保存后会覆盖当前 configured connector 配置，并重新进入发现流程。
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={props.onCancel}>
          取消
        </Button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Field label="Display Name">
          <Input
            value={props.displayName}
            onChange={event => props.onDisplayNameChange(event.target.value)}
            placeholder="GitHub MCP"
          />
        </Field>
        <Field label="Transport">
          <select
            value={props.transport}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              props.onTransportChange(event.target.value as 'stdio' | 'http')
            }
            className="flex h-10 w-full rounded-2xl border border-input bg-background px-4 py-2 text-sm text-foreground shadow-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
          >
            <option value="stdio">stdio</option>
            <option value="http">http</option>
          </select>
        </Field>
        {props.transport === 'http' ? (
          <Field label="Endpoint" className="md:col-span-2">
            <Input
              value={props.endpoint}
              onChange={(event: ChangeEvent<HTMLInputElement>) => props.onEndpointChange(event.target.value)}
              placeholder="https://mcp.example.com"
            />
          </Field>
        ) : (
          <>
            <Field label="Command">
              <Input
                value={props.command}
                onChange={(event: ChangeEvent<HTMLInputElement>) => props.onCommandChange(event.target.value)}
                placeholder="npx"
              />
            </Field>
            <Field label="Args">
              <Input
                value={props.argsText}
                onChange={(event: ChangeEvent<HTMLInputElement>) => props.onArgsTextChange(event.target.value)}
                placeholder="-y github-mcp-server"
              />
            </Field>
          </>
        )}
        <Field label="API Key / Token" className="md:col-span-2">
          <Input
            type="password"
            value={props.apiKey}
            onChange={(event: ChangeEvent<HTMLInputElement>) => props.onApiKeyChange(event.target.value)}
            placeholder="可选，保存到运行态配置"
          />
        </Field>
      </div>
      <div className="mt-4 flex gap-2">
        <Button
          size="sm"
          onClick={() =>
            props.onSubmit({
              templateId: props.templateId,
              transport: props.transport,
              displayName: props.displayName || undefined,
              endpoint: props.transport === 'http' ? props.endpoint || undefined : undefined,
              command: props.transport === 'stdio' ? props.command || undefined : undefined,
              args: props.transport === 'stdio' ? props.argsText.split(/\s+/).filter(Boolean) : undefined,
              apiKey: props.apiKey || undefined
            })
          }
          disabled={props.transport === 'http' ? !props.endpoint.trim() : !props.command.trim()}
        >
          保存配置
        </Button>
      </div>
    </div>
  );
}

function Field(props: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={`grid gap-2 text-xs text-muted-foreground ${props.className ?? ''}`}>
      <span>{props.label}</span>
      {props.children}
    </label>
  );
}
