import { readFile } from 'node:fs/promises';

import { afterEach, describe, expect, it } from 'vitest';
import { ActionIntent } from '@agent/core';

import { LocalSandboxExecutor } from '../../src/sandbox';
import { cleanupTempWorkspaces, createTempWorkspace } from '../test-utils/temp-workspace';

describe('LocalSandboxExecutor placeholder semantics', () => {
  const originalCwd = process.cwd();
  const tempWorkspaces: string[] = [];

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempWorkspaces(tempWorkspaces.splice(0));
  });

  it('returns a stable failure for unknown tools instead of a successful stub', async () => {
    const root = await createTempWorkspace('sandbox-unknown-tool');
    tempWorkspaces.push(root);

    process.chdir(root);
    const executor = new LocalSandboxExecutor();
    const result = await executor.execute({
      taskId: 'task-unknown-tool',
      toolName: 'nonexistent_tool',
      intent: ActionIntent.READ_FILE,
      requestedBy: 'agent',
      input: {
        secret: 'do-not-echo',
        nested: {
          token: 'abc123'
        }
      }
    });

    expect(result.ok).toBe(false);
    expect(result.outputSummary).toBe('Unsupported sandbox tool');
    expect(result.errorMessage).toContain('unsupported_tool');
    expect(JSON.stringify(result.rawOutput)).not.toContain('do-not-echo');
    expect(JSON.stringify(result.rawOutput)).not.toContain('abc123');
  });

  it('keeps http_request as a blocked placeholder without leaking the full input', async () => {
    const root = await createTempWorkspace('sandbox-http-request-placeholder');
    tempWorkspaces.push(root);

    process.chdir(root);
    const executor = new LocalSandboxExecutor();
    const result = await executor.execute({
      taskId: 'task-http-request',
      toolName: 'http_request',
      intent: ActionIntent.NETWORK,
      requestedBy: 'agent',
      input: {
        method: 'POST',
        url: 'https://api.example.test/v1/messages',
        headers: {
          Authorization: 'Bearer super-secret-token',
          'Content-Type': 'application/json'
        },
        body: {
          prompt: 'private prompt',
          apiKey: 'secret-key'
        }
      }
    });

    expect(result.ok).toBe(true);
    expect(result.rawOutput).toEqual(
      expect.objectContaining({
        blocked: true,
        reason: 'network_restricted',
        requestSummary: {
          method: 'POST',
          url: 'https://api.example.test/v1/messages'
        }
      })
    );
    const serialized = JSON.stringify(result.rawOutput);
    expect(serialized).not.toContain('super-secret-token');
    expect(serialized).not.toContain('private prompt');
    expect(serialized).not.toContain('secret-key');
    expect(serialized).not.toContain('Authorization');
    expect(serialized).not.toContain('headers');
    expect(serialized).not.toContain('body');
  });

  it('marks browse_page screenshot artifacts as simulated placeholders', async () => {
    const root = await createTempWorkspace('sandbox-browser-placeholder');
    tempWorkspaces.push(root);

    process.chdir(root);
    const executor = new LocalSandboxExecutor();
    const result = await executor.execute({
      taskId: 'task-browse-page',
      toolName: 'browse_page',
      intent: ActionIntent.READ_FILE,
      requestedBy: 'agent',
      input: {
        goal: 'inspect home page',
        url: 'http://localhost:3000/dashboard',
        screenshot: true
      }
    });

    expect(result.ok).toBe(true);
    expect(result.rawOutput).toEqual(
      expect.objectContaining({
        simulated: true,
        screenshot: expect.objectContaining({
          simulated: true,
          placeholder: true,
          kind: 'text_placeholder'
        })
      })
    );
    expect(JSON.stringify(result.rawOutput)).not.toContain('"screenshot":true');
    const output = result.rawOutput as { screenshot: { path: string }; screenshotRef: string };
    expect(output.screenshot.path).toBe(output.screenshotRef);
    await expect(readFile(output.screenshot.path, 'utf8')).resolves.toContain('placeholder');
  });
});
