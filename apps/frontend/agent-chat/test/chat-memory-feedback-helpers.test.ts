import { describe, expect, it } from 'vitest';

import {
  buildForgetMemoryOverridePayload,
  buildSessionMemoryOverridePayload,
  buildSessionOnlyMemoryOverridePayload,
  extractMemoryOverrideSeed
} from '../src/pages/chat-home/chat-memory-feedback-helpers';

describe('chat memory feedback helpers', () => {
  it('extracts override seed from memory evidence detail', () => {
    const seed = extractMemoryOverrideSeed({
      id: 'source-1',
      taskId: 'task-1',
      sourceType: 'memory_reuse',
      trustClass: 'internal',
      summary: '已命中历史记忆：用户偏好我先给结论。',
      detail: {
        memoryId: 'memory-1',
        memoryType: 'preference',
        tags: ['user-style', 'workspace:a']
      },
      createdAt: '2026-04-16T00:00:00.000Z'
    });

    expect(seed).toEqual({
      memoryId: 'memory-1',
      memoryType: 'preference',
      tags: ['user-style', 'workspace:a'],
      originalSummary: '用户偏好我先给结论。'
    });
  });

  it('builds a session-scoped override payload from explicit correction text', () => {
    const payload = buildSessionMemoryOverridePayload(
      {
        id: 'source-1',
        taskId: 'task-1',
        sourceType: 'memory_reuse',
        trustClass: 'internal',
        summary: '已命中历史记忆：默认自动提交代码。',
        detail: {
          memoryId: 'memory-1',
          memoryType: 'constraint',
          tags: ['project:a']
        },
        createdAt: '2026-04-16T00:00:00.000Z'
      },
      '当前会话里不要自动提交代码。'
    );

    expect(payload).toEqual({
      memoryId: 'memory-1',
      summary: '当前会话里不要自动提交代码。',
      content: '当前会话里不要自动提交代码。',
      tags: ['project:a'],
      memoryType: 'constraint',
      scopeType: 'session',
      reason: 'agent-chat explicit correction: 默认自动提交代码。'
    });
  });

  it('builds a session-only payload that pins the current memory just for this session', () => {
    const payload = buildSessionOnlyMemoryOverridePayload({
      id: 'source-1',
      taskId: 'task-1',
      sourceType: 'memory_reuse',
      trustClass: 'internal',
      summary: '已命中历史记忆：当前项目默认先跑测试再改代码。',
      detail: {
        memoryId: 'memory-1',
        memoryType: 'procedure',
        tags: ['project:a']
      },
      createdAt: '2026-04-16T00:00:00.000Z'
    });

    expect(payload).toEqual({
      memoryId: 'memory-1',
      summary: '当前项目默认先跑测试再改代码。',
      content: '当前项目默认先跑测试再改代码。',
      tags: ['project:a'],
      memoryType: 'procedure',
      scopeType: 'session',
      reason: 'agent-chat session-only pin: 当前项目默认先跑测试再改代码。'
    });
  });

  it('builds a forget payload that tells the current session to ignore the memory', () => {
    const payload = buildForgetMemoryOverridePayload({
      id: 'source-1',
      taskId: 'task-1',
      sourceType: 'memory_reuse',
      trustClass: 'internal',
      summary: '已命中历史记忆：默认自动提交代码。',
      detail: {
        memoryId: 'memory-1',
        memoryType: 'constraint',
        tags: ['project:a']
      },
      createdAt: '2026-04-16T00:00:00.000Z'
    });

    expect(payload).toEqual({
      memoryId: 'memory-1',
      summary: '当前会话忽略这条记忆：默认自动提交代码。',
      content: '当前会话忽略这条记忆：默认自动提交代码。',
      tags: ['project:a'],
      memoryType: 'constraint',
      scopeType: 'session',
      reason: 'agent-chat forget memory for this session: 默认自动提交代码。'
    });
  });
});
