import type { ToolExecutionRequest } from '@agent/runtime';

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

export type ConnectorDraftStorage = {
  listConnectorDrafts(): Promise<ConnectorDraft[]>;
  readConnectorDraft(connectorId: string): Promise<ConnectorDraft>;
  writeConnectorDraft(draft: ConnectorDraft): Promise<void>;
};

export type ConnectorExecutorOptions = {
  storage?: ConnectorDraftStorage;
};

export async function executeConnectorTool(request: ToolExecutionRequest, options: ConnectorExecutorOptions = {}) {
  const storage = options.storage ?? getDefaultConnectorDraftStorage();
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
      await storage.writeConnectorDraft(draft);
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
      const draft = await storage.readConnectorDraft(connectorId);
      const updated = {
        ...draft,
        apiKeyRef: secretRef,
        status: draft.enabled ? 'enabled' : 'configured',
        updatedAt: new Date().toISOString()
      } satisfies ConnectorDraft;
      await storage.writeConnectorDraft(updated);
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
      const draft = await storage.readConnectorDraft(connectorId);
      const enabled = request.toolName === 'enable_connector';
      const updated = {
        ...draft,
        enabled,
        status: enabled ? 'enabled' : 'disabled',
        updatedAt: new Date().toISOString()
      } satisfies ConnectorDraft;
      await storage.writeConnectorDraft(updated);
      return {
        outputSummary: `${enabled ? 'Enabled' : 'Disabled'} connector ${connectorId}`,
        rawOutput: updated
      };
    }
    case 'list_connectors': {
      const drafts = await storage.listConnectorDrafts();
      return {
        outputSummary: `Listed ${drafts.length} connector draft${drafts.length === 1 ? '' : 's'}`,
        rawOutput: { items: drafts }
      };
    }
    default:
      return undefined;
  }
}

function createInMemoryConnectorDraftStorage(): ConnectorDraftStorage {
  const drafts = new Map<string, ConnectorDraft>();
  return {
    async listConnectorDrafts() {
      return [...drafts.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },
    async readConnectorDraft(connectorId) {
      const draft = drafts.get(connectorId);
      if (!draft) {
        throw new Error(`Connector draft ${connectorId} was not found.`);
      }
      return draft;
    },
    async writeConnectorDraft(draft) {
      drafts.set(draft.connectorId, draft);
    }
  };
}

const defaultConnectorDraftStorage = createInMemoryConnectorDraftStorage();

function getDefaultConnectorDraftStorage(): ConnectorDraftStorage {
  return defaultConnectorDraftStorage;
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
