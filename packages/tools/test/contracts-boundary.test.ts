import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  AgentToolAliasRequestSchema,
  ToolContractSchema,
  ToolReceiptSchema,
  ToolRiskLevelSchema
} from '../src/contracts';

describe('@agent/tools contracts boundary', () => {
  it('does not depend on @agent/runtime from package source or manifest', () => {
    const toolsRoot = resolve(__dirname, '..');
    const manifest = JSON.parse(readFileSync(resolve(toolsRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    const declaredRuntimeDependency =
      manifest.dependencies?.['@agent/runtime'] ??
      manifest.devDependencies?.['@agent/runtime'] ??
      manifest.peerDependencies?.['@agent/runtime'];

    const sourceDir = resolve(toolsRoot, 'src');
    const runtimeImports = readdirSync(sourceDir, { recursive: true })
      .map(entry => String(entry))
      .filter(entry => entry.endsWith('.ts'))
      .filter(entry => {
        const content = readFileSync(resolve(sourceDir, entry), 'utf8');
        return content.includes('@agent/runtime');
      });

    expect(declaredRuntimeDependency).toBeUndefined();
    expect(runtimeImports).toEqual([]);
  });

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
