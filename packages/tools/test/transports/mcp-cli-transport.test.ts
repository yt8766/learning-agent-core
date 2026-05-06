import { describe, expect, it, vi } from 'vitest';

import { ActionIntent } from '@agent/core';

import type { McpCapabilityDefinition } from '../../src/mcp/mcp-capability-registry';
import type { McpServerDefinition } from '../../src/mcp/mcp-server-registry';
import { CliTransportHandler, type CliRunner } from '../../src/transports/mcp-cli-transport';

const capability: McpCapabilityDefinition = {
  id: 'minimax:web_search',
  toolName: 'web_search',
  serverId: 'minimax-cli',
  displayName: 'MiniMax CLI web search',
  riskLevel: 'low',
  requiresApproval: false,
  category: 'knowledge'
};

const server: McpServerDefinition = {
  id: 'minimax-cli',
  displayName: 'MiniMax CLI',
  transport: 'cli',
  enabled: true,
  command: 'mmx',
  env: { MINIMAX_API_KEY: 'sk-test' }
};

function makeRequest() {
  return {
    taskId: 'task-1',
    toolName: 'web_search',
    intent: ActionIntent.CALL_EXTERNAL_API,
    input: { query: 'hello' },
    requestedBy: 'agent' as const
  };
}

describe('CliTransportHandler', () => {
  it('spawns configured command with binding-built args and returns parsed rawOutput', async () => {
    const runner: CliRunner = vi.fn(async (command, args) => {
      expect(command).toBe('mmx');
      expect(args).toEqual(['search', 'query', '--q', 'hello', '--output', 'json']);
      return {
        stdout: '{"results":[{"title":"T","url":"https://x","summary":"S"}]}',
        stderr: '',
        exitCode: 0
      };
    });

    const handler = new CliTransportHandler(
      new Map([
        [
          'minimax:web_search',
          {
            capabilityId: 'minimax:web_search',
            buildPayload: () => ({ args: ['search', 'query', '--q', 'hello', '--output', 'json'] }),
            parseResponse: raw => JSON.parse(raw.stdout)
          }
        ]
      ]),
      runner
    );

    const result = await handler.invoke(server, capability, makeRequest());

    expect(runner).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.transportUsed).toBe('cli');
    expect(result.serverId).toBe('minimax-cli');
    expect(result.capabilityId).toBe('minimax:web_search');
    expect(result.rawOutput).toEqual({ results: [{ title: 'T', url: 'https://x', summary: 'S' }] });
    expect(result.outputSummary.length).toBeGreaterThan(0);
    expect(typeof result.durationMs).toBe('number');
  });

  it('returns ok=false with errorMessage when cli exits non-zero', async () => {
    const runner: CliRunner = vi.fn(async () => ({ stdout: '', stderr: 'network down', exitCode: 2 }));

    const handler = new CliTransportHandler(
      new Map([
        [
          'minimax:web_search',
          {
            capabilityId: 'minimax:web_search',
            buildPayload: () => ({ args: ['search'] }),
            parseResponse: () => ({})
          }
        ]
      ]),
      runner
    );

    const result = await handler.invoke(server, capability, makeRequest());

    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain('mmx_exit_2');
    expect(result.errorMessage).toContain('network down');
    expect(result.transportUsed).toBe('cli');
  });

  it('returns ok=false with cli_response_parse_failed when parser throws', async () => {
    const runner: CliRunner = vi.fn(async () => ({ stdout: 'not json', stderr: '', exitCode: 0 }));

    const handler = new CliTransportHandler(
      new Map([
        [
          'minimax:web_search',
          {
            capabilityId: 'minimax:web_search',
            buildPayload: () => ({ args: ['search'] }),
            parseResponse: raw => {
              JSON.parse(raw.stdout);
              return {};
            }
          }
        ]
      ]),
      runner
    );

    const result = await handler.invoke(server, capability, makeRequest());

    expect(result.ok).toBe(false);
    expect(result.errorMessage).toBe('cli_response_parse_failed');
    expect(result.transportUsed).toBe('cli');
  });

  it('returns cli_binding_missing when no binding is registered for the capability', async () => {
    const runner: CliRunner = vi.fn();
    const handler = new CliTransportHandler(new Map(), runner);

    const result = await handler.invoke(server, capability, makeRequest());

    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain('cli_binding_missing');
    expect(runner).not.toHaveBeenCalled();
  });

  it('reports disabled health when server command is missing', () => {
    const handler = new CliTransportHandler(new Map(), vi.fn());
    const commandless: McpServerDefinition = { ...server, command: undefined };

    const health = handler.getHealth(commandless, [capability]);

    expect(health.healthState).toBe('disabled');
    expect(health.healthReason).toBe('cli_command_missing');
  });

  it('reports disabled health when server is disabled', () => {
    const handler = new CliTransportHandler(new Map(), vi.fn());

    const health = handler.getHealth({ ...server, enabled: false }, [capability]);

    expect(health.healthState).toBe('disabled');
    expect(health.healthReason).toBe('connector_disabled');
  });

  it('reports healthy when enabled with command present', () => {
    const handler = new CliTransportHandler(new Map(), vi.fn());

    const health = handler.getHealth(server, [capability]);

    expect(health.healthState).toBe('healthy');
    expect(health.implementedCapabilityCount).toBe(1);
  });

  it('discovery returns the registered capability tool names as stateless session', async () => {
    const handler = new CliTransportHandler(new Map(), vi.fn());

    const discovery = await handler.discover(server, [capability]);

    expect(discovery.sessionState).toBe('stateless');
    expect(discovery.discoveryMode).toBe('registered');
    expect(discovery.discoveredCapabilities).toEqual(['web_search']);
  });
});
