import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  ApprovalScopeMatchInputSchema,
  ApprovalScopePolicyRecordSchema,
  ToolExecutionRequestSchema,
  buildApprovalScopeMatchKey,
  matchesApprovalScopePolicy
} from '../src/contracts/governance';

describe('@agent/runtime governance contracts boundary', () => {
  it('hosts governance schemas and matchers locally', () => {
    const input = ApprovalScopeMatchInputSchema.parse({
      intent: 'Run command',
      toolName: 'shell.exec',
      riskCode: 'medium',
      requestedBy: 'agent',
      commandPreview: 'pnpm test'
    });
    const matchKey = buildApprovalScopeMatchKey(input);
    const policy = ApprovalScopePolicyRecordSchema.parse({
      id: 'policy-1',
      scope: 'session',
      status: 'active',
      matchKey,
      createdAt: '2026-04-27T00:00:00.000Z',
      updatedAt: '2026-04-27T00:00:00.000Z'
    });

    expect(matchesApprovalScopePolicy(policy, input)).toBe(true);
    expect(
      ToolExecutionRequestSchema.parse({
        taskId: 'task-1',
        toolName: 'shell.exec',
        intent: 'Run tests',
        input: {},
        requestedBy: 'agent'
      }).toolName
    ).toBe('shell.exec');
  });

  it('does not leave the old core governance implementation in place', () => {
    const legacyDir = resolve(__dirname, '../../core/src/governance');
    const legacySourceFiles = existsSync(legacyDir)
      ? readdirSync(legacyDir, { recursive: true })
          .map(entry => String(entry))
          .filter(entry => entry.endsWith('.ts'))
      : [];

    expect(legacySourceFiles).toEqual([]);
  });
});
