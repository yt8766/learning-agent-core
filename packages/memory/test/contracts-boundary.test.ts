import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { MemoryRecordSchema, MemorySearchRequestSchema, ReflectionRecordSchema, UserProfileRecordSchema } from '../src';

describe('@agent/memory contracts boundary', () => {
  it('hosts memory schemas locally', () => {
    expect(
      MemoryRecordSchema.parse({
        id: 'memory-1',
        type: 'memory',
        scopeType: 'global',
        memoryType: 'fact',
        summary: 'Runtime memory contracts live in memory.',
        content: 'Keep runtime memory contracts in memory.',
        createdAt: '2026-04-27T00:00:00.000Z'
      }).id
    ).toBe('memory-1');
    expect(MemorySearchRequestSchema.parse({ query: 'contracts' }).query).toBe('contracts');
    expect(
      ReflectionRecordSchema.parse({
        id: 'reflection-1',
        taskId: 'task-1',
        kind: 'executionReflection',
        summary: 'Boundary held',
        createdAt: '2026-04-27T00:00:00.000Z'
      }).kind
    ).toBe('executionReflection');
    expect(
      UserProfileRecordSchema.parse({
        id: 'profile-1',
        userId: 'user-1',
        createdAt: '2026-04-27T00:00:00.000Z',
        updatedAt: '2026-04-27T00:00:00.000Z'
      }).userId
    ).toBe('user-1');
  });

  it('does not rely on the removed core memory host', () => {
    expect(existsSync(resolve(__dirname, '../../core/src/memory'))).toBe(false);
  });

  it('keeps persisted runtime-state snapshots decoupled from core memory and knowledge contracts', () => {
    const repositorySource = readFileSync(
      resolve(__dirname, '../src/repositories/runtime-state-repository.ts'),
      'utf8'
    );
    const taskSource = readFileSync(resolve(__dirname, '../src/repositories/runtime-state-task.types.ts'), 'utf8');

    expect(repositorySource).not.toContain("import('@agent/core').ExecutionTrace");
    expect(taskSource).not.toMatch(/import\('@agent\/core'\)\.Knowledge(?:Ingestion|Index)StateRecord/);
    expect(taskSource).not.toMatch(/import\('@agent\/core'\)\.(?:AgentMessageRecord|AgentExecutionState)/);
  });
});
