import { execFile } from 'node:child_process';

import type { ToolExecutionRequest, ToolExecutionResult } from '@agent/core';

import type { McpCapabilityDefinition } from '../mcp/mcp-capability-registry';
import type { McpServerDefinition } from '../mcp/mcp-server-registry';
import type { McpTransportDiscovery, McpTransportHandler, McpTransportHealth } from '../mcp/mcp-transport-types';

const DEFAULT_CLI_TIMEOUT_MS = 30_000;
const CLI_STDOUT_MAX_BUFFER = 4 * 1024 * 1024;
const CLI_ERROR_MESSAGE_LIMIT = 1024;

export interface CliRunOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface CliRunnerOptions {
  timeoutMs: number;
  env: Record<string, string | undefined>;
  maxBuffer: number;
  stdin?: string;
}

export type CliRunner = (command: string, args: string[], options: CliRunnerOptions) => Promise<CliRunOutput>;

export interface CliCapabilityBinding {
  capabilityId: string;
  buildPayload(request: ToolExecutionRequest, capability: McpCapabilityDefinition): { args: string[]; stdin?: string };
  parseResponse(raw: CliRunOutput, capability: McpCapabilityDefinition): unknown;
  timeoutMs?: number;
}

export const defaultCliRunner: CliRunner = (command, args, options) =>
  new Promise(resolve => {
    const child = execFile(
      command,
      args,
      {
        env: {
          ...process.env,
          ...Object.fromEntries(
            Object.entries(options.env)
              .filter(([, value]) => typeof value === 'string')
              .map(([key, value]) => [key, value as string])
          )
        },
        maxBuffer: options.maxBuffer,
        timeout: options.timeoutMs,
        windowsHide: true
      },
      (error, stdout, stderr) => {
        if (error) {
          const exitCode =
            typeof (error as NodeJS.ErrnoException).code === 'number'
              ? ((error as NodeJS.ErrnoException).code as unknown as number)
              : typeof (error as { code?: string }).code === 'string' &&
                  (error as { code?: string }).code === 'ETIMEDOUT'
                ? 124
                : 1;
          resolve({
            stdout: typeof stdout === 'string' ? stdout : String(stdout ?? ''),
            stderr: typeof stderr === 'string' ? stderr : String(stderr ?? error.message ?? ''),
            exitCode
          });
          return;
        }
        resolve({
          stdout: typeof stdout === 'string' ? stdout : String(stdout ?? ''),
          stderr: typeof stderr === 'string' ? stderr : String(stderr ?? ''),
          exitCode: 0
        });
      }
    );

    if (options.stdin) {
      child.stdin?.end(options.stdin);
    }
  });

function buildOutputSummary(
  server: McpServerDefinition,
  capability: McpCapabilityDefinition,
  raw: CliRunOutput
): string {
  const snippet = raw.stdout.trim().split(/\r?\n/, 1)[0]?.slice(0, 200);
  if (snippet) {
    return snippet;
  }
  return `CLI transport ${server.id} completed ${capability.toolName}`;
}

export class CliTransportHandler implements McpTransportHandler {
  readonly transport = 'cli' as const;

  constructor(
    private readonly bindings: Map<string, CliCapabilityBinding>,
    private readonly runner: CliRunner = defaultCliRunner
  ) {}

  async invoke(
    server: McpServerDefinition,
    capability: McpCapabilityDefinition,
    request: ToolExecutionRequest
  ): Promise<ToolExecutionResult> {
    const startedAt = Date.now();
    const binding = this.bindings.get(capability.id);

    if (!binding) {
      return {
        ok: false,
        outputSummary: `CLI transport ${server.id} missing binding for ${capability.id}`,
        errorMessage: `cli_binding_missing:${capability.id}`,
        durationMs: Date.now() - startedAt,
        exitCode: 1,
        serverId: server.id,
        capabilityId: capability.id,
        transportUsed: 'cli',
        fallbackUsed: false
      };
    }

    if (!server.command) {
      return {
        ok: false,
        outputSummary: `CLI transport ${server.id} missing command`,
        errorMessage: 'cli_command_missing',
        durationMs: Date.now() - startedAt,
        exitCode: 1,
        serverId: server.id,
        capabilityId: capability.id,
        transportUsed: 'cli',
        fallbackUsed: false
      };
    }

    const { args, stdin } = binding.buildPayload(request, capability);
    const timeoutMs = binding.timeoutMs ?? capability.timeoutMs ?? DEFAULT_CLI_TIMEOUT_MS;

    let raw: CliRunOutput;
    try {
      raw = await this.runner(server.command, args, {
        timeoutMs,
        env: server.env ?? {},
        maxBuffer: CLI_STDOUT_MAX_BUFFER,
        stdin
      });
    } catch (error) {
      return {
        ok: false,
        outputSummary: `CLI transport ${server.id} request failed`,
        errorMessage: error instanceof Error ? error.message : 'cli_request_failed',
        durationMs: Date.now() - startedAt,
        exitCode: 1,
        serverId: server.id,
        capabilityId: capability.id,
        transportUsed: 'cli',
        fallbackUsed: false
      };
    }

    if (raw.exitCode !== 0) {
      const stderrSnippet = raw.stderr.slice(0, CLI_ERROR_MESSAGE_LIMIT);
      return {
        ok: false,
        outputSummary: `CLI transport ${server.id} exited with ${raw.exitCode}`,
        errorMessage: `mmx_exit_${raw.exitCode}: ${stderrSnippet}`.trim(),
        durationMs: Date.now() - startedAt,
        exitCode: raw.exitCode,
        serverId: server.id,
        capabilityId: capability.id,
        transportUsed: 'cli',
        fallbackUsed: false
      };
    }

    let rawOutput: unknown;
    try {
      rawOutput = binding.parseResponse(raw, capability);
    } catch {
      return {
        ok: false,
        outputSummary: `CLI transport ${server.id} response parse failed`,
        errorMessage: 'cli_response_parse_failed',
        durationMs: Date.now() - startedAt,
        exitCode: 0,
        serverId: server.id,
        capabilityId: capability.id,
        transportUsed: 'cli',
        fallbackUsed: false
      };
    }

    return {
      ok: true,
      outputSummary: buildOutputSummary(server, capability, raw),
      rawOutput,
      durationMs: Date.now() - startedAt,
      exitCode: 0,
      serverId: server.id,
      capabilityId: capability.id,
      transportUsed: 'cli',
      fallbackUsed: false
    };
  }

  getHealth(server: McpServerDefinition, capabilities: McpCapabilityDefinition[]): McpTransportHealth {
    if (!server.enabled) {
      return {
        healthState: 'disabled',
        healthReason: 'connector_disabled',
        implementedCapabilityCount: 0
      };
    }

    if (!server.command) {
      return {
        healthState: 'disabled',
        healthReason: 'cli_command_missing',
        implementedCapabilityCount: 0
      };
    }

    return {
      healthState: 'healthy',
      healthReason: 'cli_transport_ready',
      implementedCapabilityCount: capabilities.length
    };
  }

  async discover(
    _server: McpServerDefinition,
    capabilities: McpCapabilityDefinition[]
  ): Promise<McpTransportDiscovery> {
    return {
      sessionState: 'stateless',
      discoveredCapabilities: capabilities.map(capability => capability.toolName),
      discoveryMode: 'registered'
    };
  }
}
