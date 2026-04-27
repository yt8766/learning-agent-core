import { ExecutionNodeRecordSchema } from '@agent/core';

import type { ExecutionNodeRecord, ListDefaultExecutionNodesOptions } from './execution-fabric-types';

function resolveNow(options?: ListDefaultExecutionNodesOptions): string {
  return options?.now?.() ?? new Date().toISOString();
}

export function listDefaultExecutionNodes(options?: ListDefaultExecutionNodesOptions): ExecutionNodeRecord[] {
  const timestamp = resolveNow(options);
  const nodes: ExecutionNodeRecord[] = [
    {
      nodeId: 'execution_node_local_terminal',
      displayName: 'Local terminal',
      kind: 'local_terminal',
      status: 'available',
      sandboxMode: 'host',
      riskClass: 'high',
      capabilities: [
        {
          capabilityId: 'execution_capability_local_terminal',
          nodeId: 'execution_node_local_terminal',
          toolName: 'terminal.exec',
          category: 'terminal',
          riskClass: 'high',
          requiresApproval: true,
          permissionHints: ['Runs shell commands inside the active workspace context.']
        }
      ],
      permissionScope: {
        allowedPaths: ['workspace'],
        deniedPaths: ['home_profile', 'browser_profile']
      },
      health: { ok: true, checkedAt: timestamp },
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      nodeId: 'execution_node_browser',
      displayName: 'Browser',
      kind: 'browser',
      status: 'available',
      sandboxMode: 'sandboxed',
      riskClass: 'medium',
      capabilities: [
        {
          capabilityId: 'execution_capability_browser',
          nodeId: 'execution_node_browser',
          toolName: 'browser.use',
          category: 'browser',
          riskClass: 'medium',
          requiresApproval: false,
          permissionHints: ['Inspects and interacts with browser targets for verification.']
        }
      ],
      permissionScope: {
        allowedHosts: ['localhost', '127.0.0.1', '::1']
      },
      health: { ok: true, checkedAt: timestamp },
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      nodeId: 'execution_node_docker_sandbox',
      displayName: 'Docker sandbox',
      kind: 'docker_sandbox',
      status: 'available',
      sandboxMode: 'sandboxed',
      riskClass: 'medium',
      capabilities: [
        {
          capabilityId: 'execution_capability_docker_sandbox',
          nodeId: 'execution_node_docker_sandbox',
          toolName: 'sandbox.exec',
          category: 'code_execution',
          riskClass: 'medium',
          requiresApproval: false,
          permissionHints: ['Runs isolated commands in a disposable sandbox.']
        }
      ],
      permissionScope: {
        allowedPaths: ['workspace']
      },
      health: { ok: true, checkedAt: timestamp },
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ];

  return nodes.map(node => ExecutionNodeRecordSchema.parse(node));
}

export function findExecutionNode(
  nodeId: string,
  nodes: ExecutionNodeRecord[] = listDefaultExecutionNodes()
): ExecutionNodeRecord | undefined {
  return nodes.find(node => node.nodeId === nodeId);
}
