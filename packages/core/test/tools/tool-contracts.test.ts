import { describe, expect, it } from 'vitest';

import {
  AutoReviewRequestSchema,
  AutoReviewResultSchema,
  CommandToolContractSchema,
  FileToolContractSchema,
  SandboxPlanSchema,
  SandboxResultSchema,
  ToolApprovalPreviewSchema,
  ToolReceiptSchema,
  ToolRuntimeEventSchema
} from '../../src/tools';

const timestamp = '2026-04-25T10:00:00.000Z';

describe('@agent/core tool contracts', () => {
  it('parses a file tool contract', () => {
    const tool = FileToolContractSchema.parse({
      toolId: 'tool.file.workspace',
      name: 'workspace_file',
      description: 'Read and write files inside the workspace.',
      kind: 'file',
      riskLevel: 'medium',
      approvalPolicy: 'on_demand',
      operations: ['read', 'write', 'list'],
      pathPolicy: {
        workspaceRoot: '/workspace',
        allowedPaths: ['/workspace'],
        deniedPaths: ['/workspace/.env']
      }
    });

    expect(tool.kind).toBe('file');
    expect(tool.pathPolicy.allowOutsideWorkspace).toBe(false);
  });

  it('parses semantic and raw command tool contracts', () => {
    const semantic = CommandToolContractSchema.parse({
      toolId: 'tool.command.test',
      name: 'run_tests',
      description: 'Run a known test command through a semantic command.',
      kind: 'command',
      riskLevel: 'high',
      approvalPolicy: 'always',
      commandMode: 'semantic',
      semanticName: 'package-test',
      commandTemplate: 'pnpm --dir {packageDir} test'
    });

    const raw = CommandToolContractSchema.parse({
      toolId: 'tool.command.raw',
      name: 'raw_command',
      description: 'Run an explicitly allowed raw command.',
      kind: 'command',
      riskLevel: 'critical',
      approvalPolicy: 'always',
      commandMode: 'raw',
      allowedCommands: ['pnpm test'],
      deniedCommands: ['rm -rf /'],
      shell: 'zsh'
    });

    expect(semantic.commandMode).toBe('semantic');
    expect(raw.commandMode).toBe('raw');
    expect(raw.deniedCommands).toContain('rm -rf /');
  });

  it('parses sandbox plans and results', () => {
    const plan = SandboxPlanSchema.parse({
      sandboxId: 'sandbox-plan-1',
      taskId: 'task-1',
      mode: 'workspace-write',
      writableRoots: ['/workspace'],
      networkAccess: 'restricted',
      commandPolicy: {
        allowedCommands: ['pnpm test'],
        deniedCommands: ['rm -rf /']
      },
      createdAt: timestamp
    });

    const result = SandboxResultSchema.parse({
      sandboxId: 'sandbox-plan-1',
      status: 'succeeded',
      startedAt: timestamp,
      completedAt: timestamp,
      exitCode: 0,
      summary: 'Tests passed',
      artifacts: [
        {
          artifactId: 'artifact-log-1',
          kind: 'log',
          uri: 'file:///workspace/test.log'
        }
      ]
    });

    expect(plan.networkAccess).toBe('restricted');
    expect(result.artifacts[0]?.kind).toBe('log');
  });

  it('parses auto review requests and results', () => {
    const request = AutoReviewRequestSchema.parse({
      reviewId: 'review-1',
      taskId: 'task-1',
      scope: {
        changedFiles: ['packages/core/src/tools/index.ts'],
        diffRefs: ['HEAD']
      },
      focus: ['contract_compatibility', 'test_coverage'],
      requestedAt: timestamp
    });

    const result = AutoReviewResultSchema.parse({
      reviewId: 'review-1',
      taskId: 'task-1',
      kind: 'code_change',
      status: 'warnings',
      verdict: 'warn',
      summary: 'Review found contract compatibility concerns.',
      findings: [
        {
          findingId: 'finding-1',
          severity: 'error',
          category: 'contract_compatibility',
          title: 'Missing schema export',
          message: 'The schema is not exported from the tools boundary.',
          file: 'packages/core/src/tools/index.ts',
          startLine: 1,
          endLine: 1
        }
      ],
      evidenceIds: ['evidence-1'],
      artifactIds: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: timestamp
    });

    expect(request.focus).toContain('contract_compatibility');
    expect(result.verdict).toBe('warn');
    expect(result.findings[0]?.severity).toBe('error');
  });

  it('parses the documented auto review record vocabulary', () => {
    const record = AutoReviewResultSchema.parse({
      reviewId: 'review-doc-1',
      sessionId: 'session-1',
      taskId: 'task-1',
      requestId: 'request-1',
      kind: 'sandbox_result',
      status: 'blocked',
      verdict: 'block',
      summary: 'Sandbox result requires review before continuing.',
      findings: [
        {
          findingId: 'finding-doc-1',
          severity: 'blocker',
          category: 'sandbox_result',
          title: 'Sandbox denied command',
          message: 'The command attempted to use a denied operation.',
          file: 'packages/core/src/tools/index.ts',
          startLine: 12,
          endLine: 12,
          evidenceIds: ['evidence-1'],
          recommendation: 'Use an approved command profile.'
        }
      ],
      evidenceIds: ['evidence-1'],
      artifactIds: ['artifact-1'],
      sandboxRunId: 'sandbox-run-1',
      policyDecisionId: 'policy-decision-1',
      approval: {
        approvalId: 'approval-1',
        interruptId: 'interrupt-1',
        resumeEndpoint: '/api/auto-review/reviews/:reviewId/approval'
      },
      createdAt: timestamp,
      updatedAt: timestamp,
      metadata: {
        source: 'docs/api/auto-review.md'
      }
    });

    expect(record.status).toBe('blocked');
    expect(record.verdict).toBe('block');
    expect(record.findings[0]?.severity).toBe('blocker');
  });

  it('parses approval previews and receipts', () => {
    const preview = ToolApprovalPreviewSchema.parse({
      approvalId: 'approval-1',
      toolCallId: 'tool-call-1',
      toolId: 'tool.command.test',
      riskLevel: 'high',
      title: 'Run package tests',
      summary: 'pnpm --dir packages/core test',
      requestedBy: {
        actor: 'supervisor',
        actorId: 'supervisor-main'
      },
      preview: {
        command: 'pnpm --dir packages/core test',
        affectedPaths: ['packages/core']
      },
      createdAt: timestamp
    });

    const receipt = ToolReceiptSchema.parse({
      receiptId: 'receipt-1',
      toolCallId: 'tool-call-1',
      toolId: 'tool.command.test',
      status: 'succeeded',
      startedAt: timestamp,
      completedAt: timestamp,
      durationMs: 1200,
      outputPreview: 'Tests passed',
      evidenceIds: ['evidence-1']
    });

    expect(preview.preview.command).toContain('pnpm');
    expect(receipt.status).toBe('succeeded');
  });

  it('parses tool, sandbox, and auto review runtime events', () => {
    const events = [
      ToolRuntimeEventSchema.parse({
        eventId: 'event-tool-1',
        emittedAt: timestamp,
        kind: 'tool',
        type: 'tool.receipt.created',
        taskId: 'task-1',
        toolCallId: 'tool-call-1',
        receiptId: 'receipt-1',
        status: 'succeeded'
      }),
      ToolRuntimeEventSchema.parse({
        eventId: 'event-sandbox-1',
        emittedAt: timestamp,
        kind: 'sandbox',
        type: 'sandbox.result.created',
        taskId: 'task-1',
        sandboxId: 'sandbox-plan-1',
        status: 'succeeded'
      }),
      ToolRuntimeEventSchema.parse({
        eventId: 'event-review-1',
        emittedAt: timestamp,
        kind: 'auto_review',
        type: 'auto_review.completed',
        taskId: 'task-1',
        reviewId: 'review-1',
        verdict: 'warn'
      })
    ];

    expect(events.map(event => event.kind)).toEqual(['tool', 'sandbox', 'auto_review']);
  });
});
