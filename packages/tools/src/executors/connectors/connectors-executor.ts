import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { ToolExecutionRequest } from '@agent/core';

import { toWorkspacePath } from '../../sandbox/sandbox-executor-utils';

type ConnectorDraft = {
  connectorId: string;
  templateId: 'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template' | string;
  displayName: string;
  enabled: boolean;
  status: 'draft' | 'configured' | 'enabled' | 'disabled';
  endpoint?: string;
  command?: string;
  args?: string[];
  apiKeyRef?: string;
  updatedAt: string;
  createdAt: string;
};

export async function executeConnectorTool(request: ToolExecutionRequest) {
  switch (request.toolName) {
    case 'create_connector_draft': {
      const templateId = String(request.input.templateId ?? '').trim();
      if (!templateId) {
        throw new Error('create_connector_draft requires templateId.');
      }
      const connectorId = toConnectorId(templateId);
      const now = new Date().toISOString();
      const draft: ConnectorDraft = {
        connectorId,
        templateId,
        displayName: String(request.input.displayName ?? defaultConnectorName(templateId)),
        enabled: false,
        status: 'draft',
        createdAt: now,
        updatedAt: now
      };
      await writeConnectorDraft(draft);
      return {
        outputSummary: `Created connector draft ${connectorId}`,
        rawOutput: draft
      };
    }
    case 'update_connector_secret': {
      const connectorId = String(request.input.connectorId ?? '').trim();
      const secretRef = String(request.input.secretRef ?? '').trim();
      if (!connectorId || !secretRef) {
        throw new Error('update_connector_secret requires connectorId and secretRef.');
      }
      const draft = await readConnectorDraft(connectorId);
      const updated = {
        ...draft,
        apiKeyRef: secretRef,
        status: draft.enabled ? 'enabled' : 'configured',
        updatedAt: new Date().toISOString()
      } satisfies ConnectorDraft;
      await writeConnectorDraft(updated);
      return {
        outputSummary: `Updated connector secret reference for ${connectorId}`,
        rawOutput: updated
      };
    }
    case 'enable_connector':
    case 'disable_connector': {
      const connectorId = String(request.input.connectorId ?? '').trim();
      if (!connectorId) {
        throw new Error(`${request.toolName} requires connectorId.`);
      }
      const draft = await readConnectorDraft(connectorId);
      const enabled = request.toolName === 'enable_connector';
      const updated = {
        ...draft,
        enabled,
        status: enabled ? 'enabled' : 'disabled',
        updatedAt: new Date().toISOString()
      } satisfies ConnectorDraft;
      await writeConnectorDraft(updated);
      return {
        outputSummary: `${enabled ? 'Enabled' : 'Disabled'} connector ${connectorId}`,
        rawOutput: updated
      };
    }
    case 'list_connectors': {
      const drafts = await listConnectorDrafts();
      return {
        outputSummary: `Listed ${drafts.length} connector draft${drafts.length === 1 ? '' : 's'}`,
        rawOutput: { items: drafts }
      };
    }
    default:
      return undefined;
  }
}

async function listConnectorDrafts() {
  const dir = toWorkspacePath('data/runtime/connectors');
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const drafts: ConnectorDraft[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }
    const filePath = toWorkspacePath(`data/runtime/connectors/${entry.name}`);
    drafts.push(JSON.parse(await readFile(filePath, 'utf8')) as ConnectorDraft);
  }
  return drafts.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

async function readConnectorDraft(connectorId: string) {
  const path = toWorkspacePath(`data/runtime/connectors/${connectorId}.json`);
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as ConnectorDraft;
}

async function writeConnectorDraft(draft: ConnectorDraft) {
  const path = toWorkspacePath(`data/runtime/connectors/${draft.connectorId}.json`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(draft, null, 2)}\n`);
}

function toConnectorId(templateId: string) {
  if (templateId === 'github-mcp-template') return 'github-mcp';
  if (templateId === 'browser-mcp-template') return 'browser-mcp';
  if (templateId === 'lark-mcp-template') return 'lark-mcp';
  return templateId.replace(/-template$/i, '').trim();
}

function defaultConnectorName(templateId: string) {
  if (templateId === 'github-mcp-template') return 'GitHub MCP';
  if (templateId === 'browser-mcp-template') return 'Browser MCP';
  if (templateId === 'lark-mcp-template') return 'Lark MCP';
  return templateId;
}
