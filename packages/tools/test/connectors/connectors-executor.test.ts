import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { ActionIntent } from '@agent/core';

import { executeConnectorTool } from '../../src/executors/connectors/connectors-executor';
import { cleanupTempWorkspaces, createTempWorkspace } from '../test-utils/temp-workspace';

describe('executeConnectorTool', () => {
  const originalCwd = process.cwd();
  const tempWorkspaces: string[] = [];

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempWorkspaces(tempWorkspaces.splice(0));
  });

  it('uses injected storage for connector drafts without creating root data/runtime', async () => {
    const root = await createTempWorkspace('connector-tools');
    tempWorkspaces.push(root);
    await mkdir(root, { recursive: true });
    process.chdir(root);
    const storage = createConnectorStorage();

    await executeConnectorTool(
      {
        taskId: 'task-draft',
        toolName: 'create_connector_draft',
        intent: ActionIntent.WRITE_FILE,
        requestedBy: 'agent',
        input: {
          templateId: 'lark-mcp-template',
          displayName: 'Lark MCP'
        }
      },
      {
        storage
      }
    );

    await executeConnectorTool(
      {
        taskId: 'task-secret',
        toolName: 'update_connector_secret',
        intent: ActionIntent.WRITE_FILE,
        requestedBy: 'agent',
        input: {
          connectorId: 'lark-mcp',
          secretRef: 'env:LARK_MCP_TOKEN'
        }
      },
      {
        storage
      }
    );

    const enableResult = await executeConnectorTool(
      {
        taskId: 'task-enable',
        toolName: 'enable_connector',
        intent: ActionIntent.WRITE_FILE,
        requestedBy: 'agent',
        input: {
          connectorId: 'lark-mcp'
        }
      },
      {
        storage
      }
    );

    const listed = await executeConnectorTool(
      {
        taskId: 'task-list',
        toolName: 'list_connectors',
        intent: ActionIntent.READ_FILE,
        requestedBy: 'agent',
        input: {}
      },
      {
        storage
      }
    );

    expect(enableResult?.rawOutput).toEqual(expect.objectContaining({ enabled: true, status: 'enabled' }));
    expect(listed?.rawOutput).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ connectorId: 'lark-mcp', apiKeyRef: 'env:LARK_MCP_TOKEN' })]
      })
    );
    await expect(stat(join(root, 'data', 'runtime'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

function createConnectorStorage() {
  const drafts = new Map<string, Record<string, unknown>>();
  return {
    async listConnectorDrafts() {
      return [...drafts.values()];
    },
    async readConnectorDraft(connectorId: string) {
      const draft = drafts.get(connectorId);
      if (!draft) {
        throw new Error(`Missing connector draft ${connectorId}`);
      }
      return draft;
    },
    async writeConnectorDraft(draft: Record<string, unknown>) {
      drafts.set(String(draft.connectorId), draft);
    }
  };
}
