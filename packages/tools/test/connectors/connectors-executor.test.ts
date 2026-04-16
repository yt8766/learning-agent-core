import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { ActionIntent } from '@agent/shared';

import { executeConnectorTool } from '../../src/connectors/connectors-executor';
import { cleanupTempWorkspaces, createTempWorkspace } from '../test-utils/temp-workspace';

describe('executeConnectorTool', () => {
  const originalCwd = process.cwd();
  const tempWorkspaces: string[] = [];

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempWorkspaces(tempWorkspaces.splice(0));
  });

  it('creates, updates, enables, and lists connector drafts', async () => {
    const root = await createTempWorkspace('connector-tools');
    tempWorkspaces.push(root);
    await mkdir(root, { recursive: true });
    process.chdir(root);

    await executeConnectorTool({
      taskId: 'task-draft',
      toolName: 'create_connector_draft',
      intent: ActionIntent.WRITE_FILE,
      requestedBy: 'agent',
      input: {
        templateId: 'lark-mcp-template',
        displayName: 'Lark MCP'
      }
    });

    await executeConnectorTool({
      taskId: 'task-secret',
      toolName: 'update_connector_secret',
      intent: ActionIntent.WRITE_FILE,
      requestedBy: 'agent',
      input: {
        connectorId: 'lark-mcp',
        secretRef: 'env:LARK_MCP_TOKEN'
      }
    });

    const enableResult = await executeConnectorTool({
      taskId: 'task-enable',
      toolName: 'enable_connector',
      intent: ActionIntent.WRITE_FILE,
      requestedBy: 'agent',
      input: {
        connectorId: 'lark-mcp'
      }
    });

    const listed = await executeConnectorTool({
      taskId: 'task-list',
      toolName: 'list_connectors',
      intent: ActionIntent.READ_FILE,
      requestedBy: 'agent',
      input: {}
    });

    expect(enableResult?.rawOutput).toEqual(expect.objectContaining({ enabled: true, status: 'enabled' }));
    expect(listed?.rawOutput).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ connectorId: 'lark-mcp', apiKeyRef: 'env:LARK_MCP_TOKEN' })]
      })
    );
    const persisted = JSON.parse(await readFile(join(root, 'data/runtime/connectors/lark-mcp.json'), 'utf8')) as {
      enabled: boolean;
    };
    expect(persisted.enabled).toBe(true);
  });
});
