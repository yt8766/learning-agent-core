import type { ToolExecutionRequest, ToolExecutionResult } from '@agent/runtime';

import type { McpCapabilityDefinition } from './mcp-capability-registry';
import type { McpServerDefinition } from './mcp-server-registry';

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
