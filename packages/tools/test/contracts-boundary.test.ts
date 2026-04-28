import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  AgentToolAliasRequestSchema,
  ToolContractSchema,
  ToolReceiptSchema,
  ToolRiskLevelSchema
} from '../src/contracts';

describe('@agent/tools contracts boundary', () => {
  it('hosts tool surface and runtime contracts locally', () => {
    expect(ToolRiskLevelSchema.parse('medium')).toBe('medium');
    expect(
      AgentToolAliasRequestSchema.parse({
        alias: 'read',
        requestedBy: { actor: 'specialist_agent', actorId: 'coder' },
        input: {}
      }).alias
    ).toBe('read');
    expect(
      ToolContractSchema.parse({
        kind: 'agent',
        toolId: 'knowledge.search',
        name: 'knowledge.search',
        description: 'Search knowledge',
        riskLevel: 'low',
        approvalPolicy: 'never',
        agentDomain: 'knowledge'
      }).kind
    ).toBe('agent');
    expect(
      ToolReceiptSchema.parse({
        receiptId: 'receipt-1',
        toolCallId: 'call-1',
        toolId: 'knowledge.search',
        status: 'succeeded'
      }).status
    ).toBe('succeeded');
  });

  it('does not leave the old core tools implementation in place', () => {
    const legacyDir = resolve(__dirname, '../../core/src/tools');
    const legacySourceFiles = existsSync(legacyDir)
      ? readdirSync(legacyDir, { recursive: true })
          .map(entry => String(entry))
          .filter(entry => entry.endsWith('.ts'))
      : [];

    expect(legacySourceFiles).toEqual([]);
  });
});
