import { spawn } from 'node:child_process';

import { ToolExecutionRequest, ToolExecutionResult } from '@agent/shared';

import { McpCapabilityDefinition } from './mcp-capability-registry';
import { McpServerDefinition } from './mcp-server-registry';
import { SandboxExecutor } from './sandbox-executor';

export interface McpTransportHealth {
  healthState: 'healthy' | 'degraded' | 'disabled';
  healthReason: string;
  implementedCapabilityCount: number;
}

export interface McpTransportDiscovery {
  sessionState: 'stateless' | 'disconnected' | 'connected' | 'error';
  discoveredCapabilities?: string[];
  discoveryMode: 'registered' | 'remote';
  errorMessage?: string;
}

export interface McpTransportHandler {
  readonly transport: McpServerDefinition['transport'];
  invoke(
    server: McpServerDefinition,
    capability: McpCapabilityDefinition,
    request: ToolExecutionRequest
  ): Promise<ToolExecutionResult>;
  getHealth(server: McpServerDefinition, capabilities: McpCapabilityDefinition[]): McpTransportHealth;
  discover?(server: McpServerDefinition, capabilities: McpCapabilityDefinition[]): Promise<McpTransportDiscovery>;
  closeSession?(server: McpServerDefinition): Promise<boolean>;
  sweepIdleSessions?(idleTtlMs: number): Promise<string[]>;
  getSessionMetadata?(
    server: McpServerDefinition
  ): { createdAt?: string; lastActivityAt?: string; requestCount?: number; idleMs?: number } | undefined;
}

export class LocalAdapterTransportHandler implements McpTransportHandler {
  readonly transport = 'local-adapter' as const;

  constructor(private readonly fallbackExecutor: SandboxExecutor) {}

  invoke(
    _server: McpServerDefinition,
    capability: McpCapabilityDefinition,
    request: ToolExecutionRequest
  ): Promise<ToolExecutionResult> {
    return this.fallbackExecutor.execute({
      ...request,
      toolName: capability.toolName
    });
  }

  getHealth(server: McpServerDefinition, capabilities: McpCapabilityDefinition[]): McpTransportHealth {
    if (!server.enabled) {
      return {
        healthState: 'disabled',
        healthReason: 'connector_disabled',
        implementedCapabilityCount: 0
      };
    }

    return {
      healthState: 'degraded',
      healthReason: 'fallback_local_adapter',
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

export class HttpTransportHandler implements McpTransportHandler {
  readonly transport = 'http' as const;

  async invoke(
    server: McpServerDefinition,
    capability: McpCapabilityDefinition,
    request: ToolExecutionRequest
  ): Promise<ToolExecutionResult> {
    if (!server.endpoint) {
      return {
        ok: false,
        outputSummary: `MCP server ${server.id} is missing an HTTP endpoint`,
        errorMessage: 'missing_endpoint',
        durationMs: 0,
        exitCode: 1
      };
    }

    const startedAt = Date.now();

    try {
      const response = await fetch(server.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(server.headers ?? {})
        },
        body: JSON.stringify({
          capabilityId: capability.id,
          toolName: capability.toolName,
          request
        })
      });

      if (!response.ok) {
        return {
          ok: false,
          outputSummary: `HTTP MCP server ${server.id} returned ${response.status}`,
          errorMessage: `http_${response.status}`,
          durationMs: Date.now() - startedAt,
          exitCode: 1
        };
      }

      const payload = (await response.json()) as Partial<ToolExecutionResult>;
      return {
        ok: payload.ok ?? false,
        outputSummary: payload.outputSummary ?? `HTTP MCP server ${server.id} completed`,
        rawOutput: payload.rawOutput,
        exitCode: payload.exitCode ?? (payload.ok ? 0 : 1),
        errorMessage: payload.errorMessage,
        durationMs: payload.durationMs ?? Date.now() - startedAt
      };
    } catch (error) {
      return {
        ok: false,
        outputSummary: `HTTP MCP server ${server.id} request failed`,
        errorMessage: error instanceof Error ? error.message : 'http_request_failed',
        durationMs: Date.now() - startedAt,
        exitCode: 1
      };
    }
  }

  getHealth(server: McpServerDefinition, capabilities: McpCapabilityDefinition[]): McpTransportHealth {
    if (!server.enabled) {
      return {
        healthState: 'disabled',
        healthReason: 'connector_disabled',
        implementedCapabilityCount: 0
      };
    }

    if (!server.endpoint) {
      return {
        healthState: 'degraded',
        healthReason: 'missing_http_endpoint',
        implementedCapabilityCount: 0
      };
    }

    return {
      healthState: 'healthy',
      healthReason: 'http_transport_ready',
      implementedCapabilityCount: capabilities.length
    };
  }

  async discover(server: McpServerDefinition, capabilities: McpCapabilityDefinition[]): Promise<McpTransportDiscovery> {
    const endpoint = server.discoveryEndpoint ?? server.endpoint;
    if (!endpoint) {
      return {
        sessionState: 'error',
        discoveredCapabilities: capabilities.map(capability => capability.toolName),
        discoveryMode: 'registered',
        errorMessage: 'missing_http_discovery_endpoint'
      };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(server.headers ?? {})
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {}
        })
      });

      if (!response.ok) {
        return {
          sessionState: 'error',
          discoveredCapabilities: capabilities.map(capability => capability.toolName),
          discoveryMode: 'registered',
          errorMessage: `http_discovery_${response.status}`
        };
      }

      const payload = (await response.json()) as {
        tools?: Array<{ name?: string }>;
        result?: { tools?: Array<{ name?: string }> };
      };
      const tools = payload.tools ?? payload.result?.tools ?? [];
      const discoveredCapabilities = Array.isArray(tools)
        ? tools.map(tool => tool?.name).filter((name): name is string => typeof name === 'string' && name.length > 0)
        : [];

      return {
        sessionState: 'connected',
        discoveredCapabilities: discoveredCapabilities.length
          ? discoveredCapabilities
          : capabilities.map(capability => capability.toolName),
        discoveryMode: discoveredCapabilities.length ? 'remote' : 'registered'
      };
    } catch (error) {
      return {
        sessionState: 'error',
        discoveredCapabilities: capabilities.map(capability => capability.toolName),
        discoveryMode: 'registered',
        errorMessage: error instanceof Error ? error.message : 'http_discovery_failed'
      };
    }
  }
}

export class StdioTransportHandler implements McpTransportHandler {
  readonly transport = 'stdio' as const;
  constructor(private readonly options: { maxSessions?: number } = {}) {}

  private readonly sessions = new Map<
    string,
    {
      child: ReturnType<typeof spawn>;
      pending: Map<
        number,
        { resolve: (value: unknown) => void; reject: (reason?: unknown) => void; timeout: NodeJS.Timeout }
      >;
      nextId: number;
      stdoutBuffer: string;
      stderrBuffer: string;
      initialized: Promise<void>;
      createdAt: string;
      lastActivityAt: string;
      requestCount: number;
      close: () => void;
    }
  >();

  private async getSession(server: McpServerDefinition) {
    if (!server.command) {
      throw new Error('missing_stdio_command');
    }

    this.enforceSessionLimit();

    const child = spawn(server.command, server.args ?? [], {
      env: {
        ...process.env,
        ...(server.env ?? {})
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const session = {
      child,
      pending: new Map<
        number,
        { resolve: (value: unknown) => void; reject: (reason?: unknown) => void; timeout: NodeJS.Timeout }
      >(),
      nextId: 1,
      stdoutBuffer: '',
      stderrBuffer: '',
      initialized: Promise.resolve(),
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      requestCount: 0,
      close: () => {
        child.stdin.end();
        child.kill('SIGTERM');
        for (const [, waiter] of session.pending) {
          clearTimeout(waiter.timeout);
          waiter.reject(new Error('stdio_session_closed'));
        }
        session.pending.clear();
        this.sessions.delete(server.id);
      }
    };

    const send = (message: Record<string, unknown>) => {
      session.lastActivityAt = new Date().toISOString();
      session.requestCount += 1;
      child.stdin.write(`${JSON.stringify(message)}\n`);
    };

    const awaitResponse = (id: number, timeoutMs: number) =>
      new Promise<unknown>((resolve, reject) => {
        const timeout = setTimeout(() => {
          session.pending.delete(id);
          reject(new Error(`stdio_timeout_${id}`));
        }, timeoutMs);

        session.pending.set(id, {
          resolve: value => {
            clearTimeout(timeout);
            resolve(value);
          },
          reject: reason => {
            clearTimeout(timeout);
            reject(reason);
          },
          timeout
        });
      });

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      session.stdoutBuffer += chunk;
      let newlineIndex = session.stdoutBuffer.indexOf('\n');
      while (newlineIndex >= 0) {
        const line = session.stdoutBuffer.slice(0, newlineIndex).trim();
        session.stdoutBuffer = session.stdoutBuffer.slice(newlineIndex + 1);
        if (line) {
          try {
            const message = JSON.parse(line) as {
              id?: number;
              result?: unknown;
              error?: { message?: string };
            };
            if (typeof message.id === 'number' && session.pending.has(message.id)) {
              const waiter = session.pending.get(message.id)!;
              session.pending.delete(message.id);
              if (message.error) {
                waiter.reject(new Error(message.error.message ?? 'stdio_mcp_error'));
              } else {
                waiter.resolve(message.result);
              }
            }
          } catch {
            session.stderrBuffer += `\ninvalid_stdout:${line}`;
          }
        }
        newlineIndex = session.stdoutBuffer.indexOf('\n');
      }
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => {
      session.stderrBuffer += chunk;
    });
    child.on('exit', () => {
      session.close();
    });
    child.on('error', error => {
      session.stderrBuffer += `\nspawn_error:${error.message}`;
      session.close();
    });

    session.initialized = (async () => {
      const initializeId = session.nextId++;
      send({
        jsonrpc: '2.0',
        id: initializeId,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: {
            name: 'learning-agent-core',
            version: '0.1.0'
          }
        }
      });
      await awaitResponse(initializeId, 10000);
      send({
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      });
    })();

    this.sessions.set(server.id, session);
    await session.initialized;
    return {
      send,
      awaitResponse,
      nextId: () => session.nextId++,
      close: session.close
    };
  }

  private enforceSessionLimit() {
    const maxSessions = Math.max(1, this.options.maxSessions ?? 4);
    if (this.sessions.size < maxSessions) {
      return;
    }

    const oldestIdleSession = Array.from(this.sessions.entries()).sort((left, right) => {
      return new Date(left[1].lastActivityAt).getTime() - new Date(right[1].lastActivityAt).getTime();
    })[0];

    oldestIdleSession?.[1].close();
  }

  private async withClient<T>(
    server: McpServerDefinition,
    run: (client: {
      send: (message: Record<string, unknown>) => void;
      awaitResponse: (id: number, timeoutMs: number) => Promise<unknown>;
      nextId: () => number;
      close: () => void;
    }) => Promise<T>
  ): Promise<T> {
    const existing = this.sessions.get(server.id);
    const client = existing
      ? await existing.initialized.then(() => ({
          send: (message: Record<string, unknown>) => {
            const stdin = existing.child.stdin;
            if (!stdin) {
              throw new Error('stdio_stdin_unavailable');
            }
            stdin.write(`${JSON.stringify(message)}\n`);
          },
          awaitResponse: (id: number, timeoutMs: number) =>
            new Promise<unknown>((resolve, reject) => {
              const timeout = setTimeout(() => {
                existing.pending.delete(id);
                reject(new Error(`stdio_timeout_${id}`));
              }, timeoutMs);
              existing.pending.set(id, {
                resolve: value => {
                  clearTimeout(timeout);
                  resolve(value);
                },
                reject: reason => {
                  clearTimeout(timeout);
                  reject(reason);
                },
                timeout
              });
            }),
          nextId: () => existing.nextId++,
          close: existing.close
        }))
      : await this.getSession(server);

    return run({
      ...client,
      close: () => {
        client.close();
      }
    });
  }

  async invoke(
    server: McpServerDefinition,
    capability: McpCapabilityDefinition,
    request: ToolExecutionRequest
  ): Promise<ToolExecutionResult> {
    if (!server.command) {
      return {
        ok: false,
        outputSummary: `MCP server ${server.id} is missing a stdio command`,
        errorMessage: 'missing_stdio_command',
        durationMs: 0,
        exitCode: 1
      };
    }

    const startedAt = Date.now();

    try {
      const result = (await this.withClient(server, async client => {
        const callId = client.nextId();
        client.send({
          jsonrpc: '2.0',
          id: callId,
          method: 'tools/call',
          params: {
            name: capability.toolName,
            arguments: request.input
          }
        });
        return client.awaitResponse(callId, 20000) as Promise<{
          content?: Array<{ type?: string; text?: string }>;
          isError?: boolean;
          [key: string]: unknown;
        }>;
      })) as {
        content?: Array<{ type?: string; text?: string }>;
        isError?: boolean;
        [key: string]: unknown;
      };

      const contentText = Array.isArray(result?.content)
        ? result.content
            .map(item => (typeof item?.text === 'string' ? item.text : undefined))
            .filter((item): item is string => Boolean(item))
            .join('\n')
        : '';

      return {
        ok: !result?.isError,
        outputSummary: contentText || `STDIO MCP server ${server.id} completed ${capability.toolName}`,
        rawOutput: result,
        exitCode: result?.isError ? 1 : 0,
        durationMs: Date.now() - startedAt,
        errorMessage: result?.isError ? contentText || 'stdio_tool_error' : undefined
      };
    } catch (error) {
      return {
        ok: false,
        outputSummary: `STDIO MCP server ${server.id} request failed`,
        errorMessage: error instanceof Error ? error.message : 'stdio_request_failed',
        durationMs: Date.now() - startedAt,
        exitCode: 1
      };
    }
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
        healthState: 'degraded',
        healthReason: 'missing_stdio_command',
        implementedCapabilityCount: 0
      };
    }

    return {
      healthState: 'healthy',
      healthReason: 'stdio_transport_ready',
      implementedCapabilityCount: capabilities.length
    };
  }

  async discover(server: McpServerDefinition, capabilities: McpCapabilityDefinition[]): Promise<McpTransportDiscovery> {
    if (!server.command) {
      return {
        sessionState: 'error',
        discoveredCapabilities: [],
        discoveryMode: 'remote',
        errorMessage: 'missing_stdio_command'
      };
    }

    try {
      const result = (await this.withClient(server, async client => {
        const listId = client.nextId();
        client.send({
          jsonrpc: '2.0',
          id: listId,
          method: 'tools/list',
          params: {}
        });
        return client.awaitResponse(listId, 10000) as Promise<{
          tools?: Array<{ name?: string }>;
        }>;
      })) as { tools?: Array<{ name?: string }> };

      const discoveredCapabilities = Array.isArray(result.tools)
        ? result.tools
            .map(tool => tool?.name)
            .filter((name): name is string => typeof name === 'string' && name.length > 0)
        : capabilities.map(capability => capability.toolName);

      return {
        sessionState: 'connected',
        discoveredCapabilities,
        discoveryMode: 'remote'
      };
    } catch (error) {
      return {
        sessionState: 'error',
        discoveredCapabilities: capabilities.map(capability => capability.toolName),
        discoveryMode: 'registered',
        errorMessage: error instanceof Error ? error.message : 'stdio_discovery_failed'
      };
    }
  }

  async closeSession(server: McpServerDefinition): Promise<boolean> {
    const session = this.sessions.get(server.id);
    if (!session) {
      return false;
    }
    session.close();
    return true;
  }

  getSessionMetadata(server: McpServerDefinition) {
    const session = this.sessions.get(server.id);
    if (!session) {
      return undefined;
    }
    const idleMs = Math.max(0, Date.now() - new Date(session.lastActivityAt).getTime());
    return {
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      requestCount: session.requestCount,
      idleMs
    };
  }

  async sweepIdleSessions(idleTtlMs: number): Promise<string[]> {
    const closed: string[] = [];
    for (const [serverId, session] of this.sessions) {
      const idleMs = Math.max(0, Date.now() - new Date(session.lastActivityAt).getTime());
      if (idleMs >= idleTtlMs) {
        session.close();
        closed.push(serverId);
      }
    }
    return closed;
  }
}
