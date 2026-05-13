import { describe, expect, it, vi } from 'vitest';
import { ActionIntent } from '@agent/core';

import { executeConnectorTool } from '../../../src/executors/connectors/connectors-executor';

describe('executeConnectorTool extended coverage', () => {
  function makeStorage() {
    const drafts = new Map<string, any>();
    return {
      listConnectorDrafts: vi.fn(async () => [...drafts.values()]),
      readConnectorDraft: vi.fn(async (id: string) => {
        const draft = drafts.get(id);
        if (!draft) throw new Error(`Connector draft ${id} was not found.`);
        return draft;
      }),
      writeConnectorDraft: vi.fn(async (draft: any) => {
        drafts.set(draft.connectorId, draft);
      })
    };
  }

  function makeRequest(toolName: string, input: Record<string, unknown> = {}) {
    return {
      taskId: 'task-1',
      toolName,
      intent: ActionIntent.WRITE_FILE,
      requestedBy: 'agent' as const,
      input
    };
  }

  it('returns undefined for unknown tool name', async () => {
    const result = await executeConnectorTool(makeRequest('unknown_tool'));
    expect(result).toBeUndefined();
  });

  describe('create_connector_draft', () => {
    it('throws when templateId is empty', async () => {
      await expect(executeConnectorTool(makeRequest('create_connector_draft', { templateId: '' }))).rejects.toThrow(
        'create_connector_draft requires templateId.'
      );
    });

    it('creates draft with github-mcp-template', async () => {
      const storage = makeStorage();
      const result = await executeConnectorTool(
        makeRequest('create_connector_draft', { templateId: 'github-mcp-template' }),
        { storage }
      );

      expect(result?.outputSummary).toContain('github-mcp');
      expect(storage.writeConnectorDraft).toHaveBeenCalled();
    });

    it('creates draft with browser-mcp-template', async () => {
      const storage = makeStorage();
      const result = await executeConnectorTool(
        makeRequest('create_connector_draft', { templateId: 'browser-mcp-template' }),
        { storage }
      );

      expect(result?.outputSummary).toContain('browser-mcp');
    });

    it('creates draft with lark-mcp-template', async () => {
      const storage = makeStorage();
      const result = await executeConnectorTool(
        makeRequest('create_connector_draft', { templateId: 'lark-mcp-template' }),
        { storage }
      );

      expect(result?.outputSummary).toContain('lark-mcp');
    });

    it('uses custom displayName when provided', async () => {
      const storage = makeStorage();
      const result = await executeConnectorTool(
        makeRequest('create_connector_draft', {
          templateId: 'custom-template',
          displayName: 'My Custom Connector'
        }),
        { storage }
      );

      expect(result?.rawOutput.displayName).toBe('My Custom Connector');
    });

    it('falls back to default connector name when displayName not provided', async () => {
      const storage = makeStorage();
      const result = await executeConnectorTool(
        makeRequest('create_connector_draft', { templateId: 'github-mcp-template' }),
        { storage }
      );

      expect(result?.rawOutput.displayName).toBe('GitHub MCP');
    });

    it('strips -template suffix for unknown templates', async () => {
      const storage = makeStorage();
      const result = await executeConnectorTool(
        makeRequest('create_connector_draft', { templateId: 'my-custom-template' }),
        { storage }
      );

      expect(result?.rawOutput.connectorId).toBe('my-custom');
    });
  });

  describe('update_connector_secret', () => {
    it('throws when connectorId is empty', async () => {
      await expect(
        executeConnectorTool(makeRequest('update_connector_secret', { connectorId: '', secretRef: 'env:KEY' }))
      ).rejects.toThrow('update_connector_secret requires connectorId and secretRef.');
    });

    it('throws when secretRef is empty', async () => {
      await expect(
        executeConnectorTool(makeRequest('update_connector_secret', { connectorId: 'c1', secretRef: '' }))
      ).rejects.toThrow('update_connector_secret requires connectorId and secretRef.');
    });

    it('updates secret and sets status to enabled when connector was enabled', async () => {
      const storage = makeStorage();
      storage.writeConnectorDraft({
        connectorId: 'c1',
        templateId: 'test',
        displayName: 'Test',
        enabled: true,
        status: 'enabled',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01'
      });

      const result = await executeConnectorTool(
        makeRequest('update_connector_secret', { connectorId: 'c1', secretRef: 'env:KEY' }),
        { storage }
      );

      expect(result?.rawOutput.status).toBe('enabled');
      expect(result?.rawOutput.apiKeyRef).toBe('env:KEY');
    });

    it('sets status to configured when connector was not enabled', async () => {
      const storage = makeStorage();
      storage.writeConnectorDraft({
        connectorId: 'c1',
        templateId: 'test',
        displayName: 'Test',
        enabled: false,
        status: 'draft',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01'
      });

      const result = await executeConnectorTool(
        makeRequest('update_connector_secret', { connectorId: 'c1', secretRef: 'env:KEY' }),
        { storage }
      );

      expect(result?.rawOutput.status).toBe('configured');
    });
  });

  describe('enable_connector / disable_connector', () => {
    it('throws when connectorId is empty for enable', async () => {
      await expect(executeConnectorTool(makeRequest('enable_connector', { connectorId: '' }))).rejects.toThrow(
        'enable_connector requires connectorId.'
      );
    });

    it('throws when connectorId is empty for disable', async () => {
      await expect(executeConnectorTool(makeRequest('disable_connector', { connectorId: '' }))).rejects.toThrow(
        'disable_connector requires connectorId.'
      );
    });

    it('enables connector', async () => {
      const storage = makeStorage();
      storage.writeConnectorDraft({
        connectorId: 'c1',
        templateId: 'test',
        displayName: 'Test',
        enabled: false,
        status: 'configured',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01'
      });

      const result = await executeConnectorTool(makeRequest('enable_connector', { connectorId: 'c1' }), { storage });

      expect(result?.rawOutput.enabled).toBe(true);
      expect(result?.rawOutput.status).toBe('enabled');
    });

    it('disables connector', async () => {
      const storage = makeStorage();
      storage.writeConnectorDraft({
        connectorId: 'c1',
        templateId: 'test',
        displayName: 'Test',
        enabled: true,
        status: 'enabled',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01'
      });

      const result = await executeConnectorTool(makeRequest('disable_connector', { connectorId: 'c1' }), { storage });

      expect(result?.rawOutput.enabled).toBe(false);
      expect(result?.rawOutput.status).toBe('disabled');
    });
  });

  describe('list_connectors', () => {
    it('lists all connector drafts', async () => {
      const storage = makeStorage();
      storage.writeConnectorDraft({
        connectorId: 'c1',
        templateId: 'test',
        displayName: 'Test',
        enabled: false,
        status: 'draft',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01'
      });

      const result = await executeConnectorTool(makeRequest('list_connectors'), { storage });

      expect(result?.outputSummary).toContain('1');
      expect(result?.rawOutput.items).toHaveLength(1);
    });

    it('returns 0 items when empty', async () => {
      const storage = makeStorage();
      const result = await executeConnectorTool(makeRequest('list_connectors'), { storage });

      expect(result?.outputSummary).toContain('0');
    });
  });
});
