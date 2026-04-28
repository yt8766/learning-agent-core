import {
  ExecutionCapabilityRecordSchema,
  ExecutionNodeRecordSchema,
  type ExecutionCapabilityCategory,
  type ExecutionCapabilityRecord,
  type ExecutionNodeRecord,
  type ExecutionNodeKind,
  type ExecutionRiskClass,
  type ExecutionSandboxMode
} from '@agent/core';
import type { ToolDefinition } from '@agent/runtime';
import { createDefaultToolRegistry } from '@agent/tools';

import { optionalBooleanEquals, optionalEquals } from './agent-tools.helpers';
import type { AgentToolCatalog } from './agent-tools.types';
import type { AgentToolCapabilityQuery, AgentToolNodeQuery } from './agent-tools.types';

const NODE_ID = 'node-local-tools';

export function buildAgentToolCatalog(now = new Date().toISOString()): AgentToolCatalog {
  const toolRegistry = createDefaultToolRegistry();
  const capabilities = toolRegistry.list().map(tool => toCapability(tool));
  const node = ExecutionNodeRecordSchema.parse({
    nodeId: NODE_ID,
    displayName: 'Local Agent Tool Facade',
    kind: 'local_terminal',
    status: 'available',
    sandboxMode: 'sandboxed',
    riskClass: highestRisk(capabilities),
    capabilities,
    permissionScope: {
      workspaceRoot: process.cwd(),
      allowedPaths: ['.'],
      deniedPaths: [],
      allowedHosts: [],
      deniedHosts: [],
      allowedCommands: [],
      deniedCommands: []
    },
    health: {
      ok: true,
      message: 'In-memory facade is available.',
      checkedAt: now
    },
    lastHeartbeatAt: now,
    metadata: {
      source: 'agent-tools-http-facade',
      catalog: 'default-tool-registry'
    },
    createdAt: now,
    updatedAt: now
  });

  return { nodes: [node], capabilities };
}

function toCapability(tool: ToolDefinition): ExecutionCapabilityRecord {
  const capability = {
    capabilityId: `capability.${tool.family}.${tool.name}`,
    nodeId: NODE_ID,
    toolName: tool.name,
    category: toExecutionCategory(tool),
    riskClass: tool.riskLevel,
    requiresApproval: tool.requiresApproval,
    inputSchemaRef: `@agent/tools/${tool.name}/input`,
    outputSchemaRef: `@agent/tools/${tool.name}/result`,
    permissionHints: [tool.permissionScope, tool.sandboxProfile],
    metadata: {
      family: tool.family,
      capabilityType: tool.capabilityType,
      isReadOnly: tool.isReadOnly,
      isDestructive: tool.isDestructive,
      supportsStreamingDispatch: tool.supportsStreamingDispatch
    }
  };
  return ExecutionCapabilityRecordSchema.parse(capability);
}

function toExecutionCategory(tool: ToolDefinition): ExecutionCapabilityCategory {
  if (tool.family === 'filesystem') {
    return 'filesystem';
  }
  if (tool.family === 'knowledge') {
    return 'inspection';
  }
  if (tool.family === 'mcp' && tool.name.includes('browse')) {
    return 'browser';
  }
  if (tool.family === 'mcp' || tool.family === 'scheduling') {
    return 'terminal';
  }
  if (tool.family === 'connector-governance') {
    return 'network';
  }
  if (tool.family === 'scaffold') {
    return 'code_execution';
  }
  return tool.category === 'action' ? 'code_execution' : 'inspection';
}

function highestRisk(capabilities: ExecutionCapabilityRecord[]): ExecutionRiskClass {
  const order: ExecutionRiskClass[] = ['low', 'medium', 'high', 'critical'];
  return capabilities.reduce<ExecutionRiskClass>((highest, capability) => {
    return order.indexOf(capability.riskClass) > order.indexOf(highest) ? capability.riskClass : highest;
  }, 'low');
}

export const AGENT_TOOL_NODE_ID = NODE_ID;

export function filterAgentToolNodes(catalog: AgentToolCatalog, query: AgentToolNodeQuery): ExecutionNodeRecord[] {
  return catalog.nodes.filter(
    node =>
      optionalEquals(node.status, query.status) &&
      optionalEquals(node.kind, query.kind) &&
      optionalEquals(node.sandboxMode, query.sandboxMode) &&
      optionalEquals(node.riskClass, query.riskClass)
  );
}

export function filterAgentToolCapabilities(
  catalog: AgentToolCatalog,
  query: AgentToolCapabilityQuery
): ExecutionCapabilityRecord[] {
  return catalog.capabilities.filter(
    capability =>
      optionalEquals(capability.nodeId, query.nodeId) &&
      optionalEquals(capability.category, query.category) &&
      optionalEquals(capability.riskClass, query.riskClass) &&
      optionalBooleanEquals(capability.requiresApproval, query.requiresApproval)
  );
}

export type AgentToolCatalogNodeKind = ExecutionNodeKind;
export type AgentToolCatalogSandboxMode = ExecutionSandboxMode;
