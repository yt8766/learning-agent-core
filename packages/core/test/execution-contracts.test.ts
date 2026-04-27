import { describe, expect, it } from 'vitest';

import {
  ExecutionCapabilityRecordSchema,
  ExecutionNodeKindSchema,
  ExecutionNodeHealthSchema,
  ExecutionNodeRecordSchema,
  ExecutionPolicyDecisionRecordSchema,
  ExecutionRequestRecordSchema,
  ExecutionRequestStatusSchema,
  ExecutionResultRecordSchema
} from '../src';

const timestamp = '2026-04-25T10:00:00.000Z';

describe('@agent/core execution fabric contracts', () => {
  it('parses a local terminal execution node', () => {
    const node = ExecutionNodeRecordSchema.parse({
      nodeId: 'node-local-terminal',
      displayName: 'Local Terminal',
      kind: 'local_terminal',
      status: 'available',
      sandboxMode: 'host',
      riskClass: 'medium',
      capabilities: [
        {
          capabilityId: 'cap-terminal-shell',
          nodeId: 'node-local-terminal',
          toolName: 'shell.exec',
          category: 'terminal',
          riskClass: 'medium',
          requiresApproval: false,
          permissionHints: ['workspace-scoped']
        }
      ],
      permissionScope: {
        workspaceRoot: '/workspace',
        allowedPaths: ['/workspace'],
        deniedCommands: ['rm -rf /']
      },
      health: {
        ok: true,
        checkedAt: timestamp
      },
      createdAt: timestamp,
      updatedAt: timestamp
    });

    expect(node.kind).toBe('local_terminal');
    expect(node.capabilities[0]?.category).toBe('terminal');
  });

  it('parses a docker sandbox node with a high-risk capability', () => {
    const node = ExecutionNodeRecordSchema.parse({
      nodeId: 'node-docker-sandbox',
      displayName: 'Docker Sandbox',
      kind: 'docker_sandbox',
      status: 'busy',
      sandboxMode: 'sandboxed',
      riskClass: 'high',
      capabilities: [
        {
          capabilityId: 'cap-run-tests',
          nodeId: 'node-docker-sandbox',
          toolName: 'pnpm.test',
          category: 'code_execution',
          riskClass: 'high',
          requiresApproval: true,
          inputSchemaRef: 'schema://execution/input/run-tests',
          outputSchemaRef: 'schema://execution/output/run-tests',
          metadata: {
            image: 'node:22'
          }
        }
      ],
      permissionScope: {
        allowedPaths: ['/workspace'],
        allowedHosts: ['registry.npmjs.org'],
        allowedCommands: ['pnpm test']
      },
      health: {
        ok: true,
        message: 'Sandbox warmed',
        checkedAt: timestamp
      },
      lastHeartbeatAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    });

    expect(node.sandboxMode).toBe('sandboxed');
    expect(node.capabilities[0]?.requiresApproval).toBe(true);
  });

  it('parses an execution request pending approval', () => {
    const request = ExecutionRequestRecordSchema.parse({
      requestId: 'exec-request-1',
      taskId: 'task-1',
      sessionId: 'session-1',
      nodeId: 'node-docker-sandbox',
      capabilityId: 'cap-run-tests',
      toolName: 'pnpm.test',
      requestedBy: {
        actor: 'supervisor',
        actorId: 'supervisor-main'
      },
      inputPreview: 'pnpm test -- --runInBand',
      riskClass: 'high',
      policyDecision: {
        decisionId: 'policy-decision-approval',
        requestId: 'exec-request-1',
        decision: 'require_approval',
        reasonCode: 'policy.requires_approval',
        reason: 'Full test runs require human approval.',
        matchedPolicyIds: ['policy-high-risk-tests'],
        requiresApproval: true,
        approvalScope: 'single_request',
        riskClass: 'high',
        createdAt: timestamp
      },
      approvalId: 'approval-1',
      status: 'pending_approval',
      createdAt: timestamp,
      metadata: {
        reason: 'full test run'
      }
    });

    expect(request.status).toBe('pending_approval');
    expect(request.policyDecision?.decision).toBe('require_approval');
    expect(request.requestedBy.actor).toBe('supervisor');
  });

  it('parses allow, require_approval, and deny policy decisions', () => {
    const decisions = ['allow', 'require_approval', 'deny'].map((decision, index) =>
      ExecutionPolicyDecisionRecordSchema.parse({
        decisionId: `policy-decision-${index}`,
        requestId: 'exec-request-1',
        decision,
        reasonCode: `policy.${decision}`,
        reason: `Policy returned ${decision}`,
        matchedPolicyIds: [`policy-${index}`],
        requiresApproval: decision === 'require_approval',
        approvalScope: decision === 'require_approval' ? 'single_request' : undefined,
        riskClass: decision === 'deny' ? 'critical' : 'medium',
        createdAt: timestamp
      })
    );

    expect(decisions.map(decision => decision.decision)).toEqual(['allow', 'require_approval', 'deny']);
  });

  it('parses a succeeded execution result with evidence and artifacts', () => {
    const result = ExecutionResultRecordSchema.parse({
      resultId: 'exec-result-1',
      requestId: 'exec-request-1',
      taskId: 'task-1',
      nodeId: 'node-docker-sandbox',
      status: 'succeeded',
      outputPreview: 'Tests passed',
      artifactIds: ['artifact-test-log'],
      evidenceIds: ['evidence-test-run'],
      durationMs: 1200,
      createdAt: timestamp
    });

    expect(result.artifactIds).toEqual(['artifact-test-log']);
    expect(result.evidenceIds).toEqual(['evidence-test-run']);
  });

  it('parses a failed execution result with a retryable error', () => {
    const result = ExecutionResultRecordSchema.parse({
      resultId: 'exec-result-2',
      requestId: 'exec-request-2',
      taskId: 'task-1',
      nodeId: 'node-local-terminal',
      status: 'failed',
      artifactIds: [],
      evidenceIds: [],
      error: {
        code: 'TIMEOUT',
        message: 'Command timed out',
        retryable: true
      },
      createdAt: timestamp,
      metadata: {
        attempt: 1
      }
    });

    expect(result.error?.retryable).toBe(true);
  });

  it('rejects an invalid execution node kind', () => {
    expect(() => ExecutionNodeKindSchema.parse('kubernetes_cluster')).toThrow();
  });

  it('rejects an invalid execution request status', () => {
    expect(() => ExecutionRequestStatusSchema.parse('waiting_for_worker')).toThrow();
  });

  it('rejects blank execution identifiers and invalid timestamps', () => {
    expect(() =>
      ExecutionRequestRecordSchema.parse({
        requestId: '',
        taskId: 'task-blank-id',
        nodeId: 'node-local-terminal',
        toolName: 'shell.exec',
        requestedBy: { actor: 'runtime' },
        riskClass: 'low',
        status: 'pending_policy',
        createdAt: timestamp
      })
    ).toThrow();
    expect(() =>
      ExecutionPolicyDecisionRecordSchema.parse({
        decisionId: 'policy-decision-invalid-time',
        requestId: 'exec-request-1',
        decision: 'allow',
        reasonCode: 'policy.allow',
        reason: 'Policy allowed the request.',
        matchedPolicyIds: [],
        requiresApproval: false,
        riskClass: 'low',
        createdAt: 'not-a-date'
      })
    ).toThrow();
    expect(() =>
      ExecutionResultRecordSchema.parse({
        resultId: 'exec-result-invalid-duration',
        requestId: 'exec-request-1',
        taskId: 'task-1',
        nodeId: 'node-local-terminal',
        status: 'succeeded',
        artifactIds: [],
        evidenceIds: [],
        durationMs: -1,
        createdAt: timestamp
      })
    ).toThrow();
  });

  it('rejects blank capability identifiers', () => {
    const capability = {
      capabilityId: 'cap-terminal-shell',
      nodeId: 'node-local-terminal',
      toolName: 'shell.exec',
      category: 'terminal',
      riskClass: 'medium',
      requiresApproval: false
    };

    expect(() => ExecutionCapabilityRecordSchema.parse({ ...capability, capabilityId: '' })).toThrow();
    expect(() => ExecutionCapabilityRecordSchema.parse({ ...capability, nodeId: '' })).toThrow();
    expect(() => ExecutionCapabilityRecordSchema.parse({ ...capability, toolName: '' })).toThrow();
  });

  it('rejects blank node identifiers and invalid node timestamps', () => {
    const node = {
      nodeId: 'node-local-terminal',
      displayName: 'Local Terminal',
      kind: 'local_terminal',
      status: 'available',
      sandboxMode: 'host',
      riskClass: 'medium',
      capabilities: [],
      permissionScope: {},
      health: {
        ok: true,
        checkedAt: timestamp
      },
      lastHeartbeatAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    expect(() => ExecutionNodeRecordSchema.parse({ ...node, nodeId: '' })).toThrow();
    expect(() => ExecutionNodeRecordSchema.parse({ ...node, displayName: '' })).toThrow();
    expect(() => ExecutionNodeHealthSchema.parse({ ok: true, checkedAt: 'not-a-date' })).toThrow();
    expect(() => ExecutionNodeRecordSchema.parse({ ...node, lastHeartbeatAt: 'not-a-date' })).toThrow();
  });
});
