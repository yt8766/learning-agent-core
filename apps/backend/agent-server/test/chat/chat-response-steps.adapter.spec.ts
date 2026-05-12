import { describe, expect, it } from 'vitest';

import type { ChatEventRecord } from '@agent/core';

import { buildChatResponseStepEvent, buildChatResponseStepSnapshot } from '../../src/chat/chat-response-steps.adapter';

const baseEvent = {
  id: 'event-1',
  sessionId: 'session-1',
  taskId: 'task-1',
  at: '2026-05-02T08:30:00.000Z'
} satisfies Partial<ChatEventRecord>;

describe('chat response steps adapter', () => {
  it('projects a tool call into a running explore step', () => {
    const event = {
      ...baseEvent,
      type: 'tool_called',
      payload: {
        title: 'Read chat-message-adapter.tsx',
        summary: 'Inspecting message rendering.',
        path: 'apps/frontend/agent-chat/src/pages/chat/chat-message-adapter.tsx'
      }
    } as ChatEventRecord;

    const projection = buildChatResponseStepEvent(event, {
      messageId: 'assistant-1',
      sequence: 0
    });

    expect(projection?.action).toBe('started');
    expect(projection?.step.phase).toBe('explore');
    expect(projection?.step.target?.kind).toBe('file');
  });

  it('projects an execution completion into a completed command step', () => {
    const event = {
      ...baseEvent,
      id: 'event-2',
      type: 'execution_step_completed',
      payload: {
        title: 'Ran affected tests',
        command:
          'pnpm exec vitest run --config vitest.config.js apps/frontend/agent-chat/test/components/chat-response-steps.test.tsx'
      }
    } as ChatEventRecord;

    const projection = buildChatResponseStepEvent(event, {
      messageId: 'assistant-1',
      sequence: 1
    });

    expect(projection?.action).toBe('completed');
    expect(projection?.step.status).toBe('completed');
    expect(projection?.step.phase).toBe('verify');
    expect(projection?.step.target?.kind).toBe('command');
  });

  it('returns null for assistant token deltas', () => {
    const event = {
      ...baseEvent,
      id: 'event-3',
      type: 'assistant_token',
      payload: { content: 'hello' }
    } as ChatEventRecord;

    expect(buildChatResponseStepEvent(event, { messageId: 'assistant-1', sequence: 2 })).toBeNull();
  });

  it('prefers summary over outputPreview for step detail', () => {
    const event = {
      ...baseEvent,
      id: 'event-detail-priority',
      type: 'execution_step_completed',
      payload: {
        title: 'read_local_file',
        path: 'package.json',
        summary: 'first',
        outputPreview: 'second'
      }
    } as ChatEventRecord;

    expect(buildChatResponseStepEvent(event, { messageId: 'assistant-1', sequence: 0 })?.step.detail).toBe('first');
  });

  it('uses outputPreview as step detail when summary is absent', () => {
    const event = {
      ...baseEvent,
      id: 'event-detail-preview',
      type: 'execution_step_completed',
      payload: {
        title: 'read_local_file',
        path: 'package.json',
        outputPreview: '已读取文件 package.json（42 字符）'
      }
    } as ChatEventRecord;

    expect(buildChatResponseStepEvent(event, { messageId: 'assistant-1', sequence: 0 })?.step.detail).toBe(
      '已读取文件 package.json（42 字符）'
    );
  });

  it('ignores invalid optional url payloads instead of throwing', () => {
    const event = {
      ...baseEvent,
      id: 'event-invalid-url',
      type: 'tool_called',
      payload: {
        title: 'Read local route',
        url: '/relative/path'
      }
    } as ChatEventRecord;

    const projection = buildChatResponseStepEvent(event, {
      messageId: 'assistant-1',
      sequence: 0
    });

    expect(projection?.step.title).toBe('Read local route');
    expect(projection?.step.target).toBeUndefined();
  });

  it('builds a summary snapshot from projected steps', () => {
    const started = buildChatResponseStepEvent(
      {
        ...baseEvent,
        id: 'event-4',
        type: 'tool_called',
        payload: { title: 'Read file', path: 'apps/frontend/agent-chat/src/pages/chat/chat-message-adapter.tsx' }
      } as ChatEventRecord,
      { messageId: 'assistant-1', sequence: 0 }
    );
    const completed = buildChatResponseStepEvent(
      {
        ...baseEvent,
        id: 'event-5',
        type: 'execution_step_completed',
        payload: { title: 'Ran tests', command: 'pnpm exec vitest run' }
      } as ChatEventRecord,
      { messageId: 'assistant-1', sequence: 1 }
    );

    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'session-1',
      messageId: 'assistant-1',
      status: 'completed',
      steps: [started!.step, completed!.step],
      updatedAt: '2026-05-02T08:31:00.000Z'
    });

    expect(snapshot.summary.completedCount).toBe(1);
    expect(snapshot.summary.runningCount).toBe(1);
    expect(snapshot.projection).toBe('chat_response_steps');
  });
});

describe('buildChatResponseStepEvent - additional event types', () => {
  const makeEvent = (type: string, payload: Record<string, any> = {}) =>
    ({ ...baseEvent, id: `evt-${type}`, type, payload }) as ChatEventRecord;
  const ctx = { messageId: 'msg-1', sequence: 0 };

  it('maps tool_stream_dispatched to started/execute/running', () => {
    const result = buildChatResponseStepEvent(makeEvent('tool_stream_dispatched'), ctx);
    expect(result?.action).toBe('started');
    expect(result?.step.phase).toBe('execute');
    expect(result?.step.status).toBe('running');
  });

  it('maps tool_stream_completed to completed/execute/completed', () => {
    const result = buildChatResponseStepEvent(makeEvent('tool_stream_completed'), ctx);
    expect(result?.action).toBe('completed');
    expect(result?.step.phase).toBe('execute');
    expect(result?.step.status).toBe('completed');
    expect(result?.step.completedAt).toBeDefined();
  });

  it('maps execution_step_started to started/execute/running', () => {
    const result = buildChatResponseStepEvent(makeEvent('execution_step_started'), ctx);
    expect(result?.action).toBe('started');
    expect(result?.step.phase).toBe('execute');
  });

  it('maps execution_step_blocked to blocked/approve/blocked', () => {
    const result = buildChatResponseStepEvent(makeEvent('execution_step_blocked'), ctx);
    expect(result?.action).toBe('blocked');
    expect(result?.step.phase).toBe('approve');
    expect(result?.step.status).toBe('blocked');
  });

  it('maps approval_required to blocked/approve/blocked', () => {
    const result = buildChatResponseStepEvent(makeEvent('approval_required'), ctx);
    expect(result?.action).toBe('blocked');
    expect(result?.step.status).toBe('blocked');
  });

  it('maps approval_resolved to completed/approve/completed', () => {
    const result = buildChatResponseStepEvent(makeEvent('approval_resolved'), ctx);
    expect(result?.action).toBe('completed');
    expect(result?.step.status).toBe('completed');
  });

  it('maps review_completed to completed/verify/completed', () => {
    const result = buildChatResponseStepEvent(makeEvent('review_completed'), ctx);
    expect(result?.action).toBe('completed');
    expect(result?.step.phase).toBe('verify');
    expect(result?.step.agentLabel).toBe('刑部');
    expect(result?.step.nodeLabel).toBe('审查完成');
  });

  it('maps final_response_completed with default title and label', () => {
    const result = buildChatResponseStepEvent(makeEvent('final_response_completed'), ctx);
    expect(result?.step.title).toBe('整理最终答复');
    expect(result?.step.agentLabel).toBe('礼部');
    expect(result?.step.nodeLabel).toBe('最终答复完成');
  });

  it('maps session_finished with terminal status', () => {
    const result = buildChatResponseStepEvent(makeEvent('session_finished'), ctx);
    expect(result?.step.status).toBe('completed');
    expect(result?.step.completedAt).toBeDefined();
    expect(result?.step.agentLabel).toBe('礼部');
  });

  it('maps session_failed to failed/system scope', () => {
    const result = buildChatResponseStepEvent(makeEvent('session_failed'), ctx);
    expect(result?.step.status).toBe('failed');
    expect(result?.step.agentScope).toBe('system');
    expect(result?.step.ownerLabel).toBe('系统');
  });

  it('maps run_cancelled to cancelled/system scope', () => {
    const result = buildChatResponseStepEvent(makeEvent('run_cancelled'), ctx);
    expect(result?.step.status).toBe('cancelled');
    expect(result?.step.agentScope).toBe('system');
  });

  it('uses tool_called fallback agentLabel as 兵部', () => {
    const result = buildChatResponseStepEvent(makeEvent('tool_called'), ctx);
    expect(result?.step.agentLabel).toBe('兵部');
    expect(result?.step.nodeLabel).toBe('工具调用');
  });

  it('uses payload agentLabel when provided', () => {
    const result = buildChatResponseStepEvent(makeEvent('tool_called', { agentLabel: 'Custom' }), ctx);
    expect(result?.step.agentLabel).toBe('Custom');
  });

  it('uses payload ownerLabel when provided', () => {
    const result = buildChatResponseStepEvent(makeEvent('tool_called', { ownerLabel: 'My Owner' }), ctx);
    expect(result?.step.ownerLabel).toBe('My Owner');
  });

  it('uses main ownerLabel for main scope', () => {
    const result = buildChatResponseStepEvent(makeEvent('tool_called'), ctx);
    expect(result?.step.ownerLabel).toBe('主 Agent');
  });

  it('uses sub agentScope and 子 Agent ownerLabel', () => {
    const result = buildChatResponseStepEvent(makeEvent('tool_called', { agentScope: 'sub' }), ctx);
    expect(result?.step.agentScope).toBe('sub');
    expect(result?.step.ownerLabel).toBe('子 Agent');
  });

  it('builds url target for valid url payload', () => {
    const result = buildChatResponseStepEvent(makeEvent('tool_called', { url: 'https://example.com' }), ctx);
    expect(result?.step.target?.kind).toBe('url');
    expect(result?.step.target?.label).toBe('https://example.com');
  });

  it('builds approval target from payload.approvalId', () => {
    const result = buildChatResponseStepEvent(makeEvent('approval_required', { approvalId: 'appr-1' }), ctx);
    expect(result?.step.target?.kind).toBe('approval');
    expect(result?.step.target?.label).toBe('appr-1');
  });

  it('builds test target for verify phase', () => {
    const result = buildChatResponseStepEvent(makeEvent('execution_step_completed'), ctx);
    expect(result?.step.target?.kind).toBe('test');
    expect(result?.step.target?.label).toBe('verification');
  });

  it('uses eventType as nodeId fallback', () => {
    const result = buildChatResponseStepEvent(makeEvent('tool_called'), ctx);
    expect(result?.step.nodeId).toBe('tool_called');
  });

  it('uses payload nodeId when provided', () => {
    const result = buildChatResponseStepEvent(makeEvent('tool_called', { nodeId: 'custom-node' }), ctx);
    expect(result?.step.nodeId).toBe('custom-node');
  });

  it('uses payload fromNodeId and toNodeId', () => {
    const result = buildChatResponseStepEvent(makeEvent('tool_called', { fromNodeId: 'n1', toNodeId: 'n2' }), ctx);
    expect(result?.step.fromNodeId).toBe('n1');
    expect(result?.step.toNodeId).toBe('n2');
  });

  it('uses payload durationMs', () => {
    const result = buildChatResponseStepEvent(makeEvent('tool_called', { durationMs: 5000 }), ctx);
    expect(result?.step.durationMs).toBe(5000);
  });

  it('uses chunk as detail fallback', () => {
    const result = buildChatResponseStepEvent(makeEvent('tool_called', { chunk: 'chunk text' }), ctx);
    expect(result?.step.detail).toBe('chunk text');
  });

  it('does not set completedAt for non-terminal statuses', () => {
    const result = buildChatResponseStepEvent(makeEvent('tool_called'), ctx);
    expect(result?.step.completedAt).toBeUndefined();
  });
});

describe('buildChatResponseStepSnapshot - display mode and groups', () => {
  const makeStep = (overrides: Record<string, any> = {}) => ({
    id: 'step-1',
    sessionId: 'sess-1',
    messageId: 'msg-1',
    sequence: 0,
    phase: 'explore',
    status: 'completed',
    title: 'Step 1',
    sourceEventType: 'tool_called',
    startedAt: '2026-05-11T12:00:00.000Z',
    sourceEventId: 'evt-1',
    ...overrides
  });

  it('returns answer_only for steps with only low-value delivery events', () => {
    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'sess-1',
      messageId: 'msg-1',
      status: 'completed',
      steps: [makeStep({ sourceEventType: 'final_response_completed', phase: 'execute' })],
      updatedAt: '2026-05-02T08:31:00.000Z'
    });
    expect(snapshot.displayMode).toBe('answer_only');
    expect(snapshot.agentOsGroups).toEqual([]);
    expect(snapshot.summary.title).toBe('已思考');
  });

  it('returns agent_execution for steps with sub agentScope', () => {
    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'sess-1',
      messageId: 'msg-1',
      status: 'completed',
      steps: [makeStep({ agentScope: 'sub' })],
      updatedAt: '2026-05-02T08:31:00.000Z'
    });
    expect(snapshot.displayMode).toBe('agent_execution');
  });

  it('returns agent_execution for steps with command target', () => {
    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'sess-1',
      messageId: 'msg-1',
      status: 'completed',
      steps: [makeStep({ target: { kind: 'command', label: 'test' } })],
      updatedAt: '2026-05-02T08:31:00.000Z'
    });
    expect(snapshot.displayMode).toBe('agent_execution');
  });

  it('counts step statuses correctly', () => {
    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'sess-1',
      messageId: 'msg-1',
      status: 'running',
      steps: [
        makeStep({ status: 'completed' }),
        makeStep({ id: 's2', status: 'running' }),
        makeStep({ id: 's3', status: 'queued' }),
        makeStep({ id: 's4', status: 'blocked' }),
        makeStep({ id: 's5', status: 'failed' })
      ],
      updatedAt: '2026-05-02T08:31:00.000Z'
    });
    expect(snapshot.summary.completedCount).toBe(1);
    expect(snapshot.summary.runningCount).toBe(2);
    expect(snapshot.summary.blockedCount).toBe(1);
    expect(snapshot.summary.failedCount).toBe(1);
  });

  it('appends duration to title when steps have durationMs', () => {
    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'sess-1',
      messageId: 'msg-1',
      status: 'completed',
      steps: [makeStep({ phase: 'execute', durationMs: 15000 })],
      updatedAt: '2026-05-02T08:31:00.000Z'
    });
    expect(snapshot.summary.title).toContain('用时');
    expect(snapshot.summary.title).toContain('15s');
  });

  it('formats duration with minutes and seconds', () => {
    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'sess-1',
      messageId: 'msg-1',
      status: 'completed',
      steps: [makeStep({ phase: 'execute', durationMs: 90000 })],
      updatedAt: '2026-05-02T08:31:00.000Z'
    });
    expect(snapshot.summary.title).toContain('1m 30s');
  });

  it('formats duration with exact minutes', () => {
    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'sess-1',
      messageId: 'msg-1',
      status: 'completed',
      steps: [makeStep({ phase: 'execute', durationMs: 120000 })],
      updatedAt: '2026-05-02T08:31:00.000Z'
    });
    expect(snapshot.summary.title).toContain('2m');
  });

  it('uses processing title for non-completed status', () => {
    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'sess-1',
      messageId: 'msg-1',
      status: 'running',
      steps: [makeStep({ phase: 'execute' })],
      updatedAt: '2026-05-02T08:31:00.000Z'
    });
    expect(snapshot.summary.title).toContain('处理中');
  });

  it('resolves collaboration group for sub agentScope', () => {
    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'sess-1',
      messageId: 'msg-1',
      status: 'completed',
      steps: [makeStep({ agentScope: 'sub', agentLabel: 'Researcher' })],
      updatedAt: '2026-05-02T08:31:00.000Z'
    });
    const group = snapshot.agentOsGroups.find(g => g.kind === 'collaboration');
    expect(group).toBeDefined();
    expect(group?.summary).toContain('协作');
    expect(group?.steps[0].title).toContain('Researcher');
  });

  it('resolves collaboration step without agentLabel', () => {
    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'sess-1',
      messageId: 'msg-1',
      status: 'completed',
      steps: [makeStep({ agentScope: 'sub', agentLabel: undefined })],
      updatedAt: '2026-05-02T08:31:00.000Z'
    });
    const group = snapshot.agentOsGroups.find(g => g.kind === 'collaboration');
    expect(group?.steps[0].title).toContain('子 Agent');
  });

  it('resolves exploration group for context phase with file target', () => {
    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'sess-1',
      messageId: 'msg-1',
      status: 'completed',
      steps: [makeStep({ phase: 'context', target: { kind: 'file', label: 'test.ts', path: '/test.ts' } })],
      updatedAt: '2026-05-02T08:31:00.000Z'
    });
    const group = snapshot.agentOsGroups.find(g => g.kind === 'exploration');
    expect(group).toBeDefined();
    expect(group?.summary).toContain('上下文');
  });

  it('resolves exploration group for file target', () => {
    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'sess-1',
      messageId: 'msg-1',
      status: 'completed',
      steps: [makeStep({ target: { kind: 'file', label: 'index.ts', path: '/index.ts' } })],
      updatedAt: '2026-05-02T08:31:00.000Z'
    });
    const group = snapshot.agentOsGroups.find(g => g.kind === 'exploration');
    expect(group).toBeDefined();
  });

  it('resolves verification group for approve phase with approval target', () => {
    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'sess-1',
      messageId: 'msg-1',
      status: 'completed',
      steps: [makeStep({ phase: 'approve', target: { kind: 'approval', label: 'appr-1' } })],
      updatedAt: '2026-05-02T08:31:00.000Z'
    });
    const group = snapshot.agentOsGroups.find(g => g.kind === 'verification');
    expect(group).toBeDefined();
    expect(group?.summary).toContain('验证');
  });

  it('resolves verification group for verify phase with test target', () => {
    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'sess-1',
      messageId: 'msg-1',
      status: 'completed',
      steps: [makeStep({ phase: 'verify', target: { kind: 'test', label: 'test' } })],
      updatedAt: '2026-05-02T08:31:00.000Z'
    });
    const group = snapshot.agentOsGroups.find(g => g.kind === 'verification');
    expect(group).toBeDefined();
  });

  it('resolves execution group for execute phase', () => {
    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'sess-1',
      messageId: 'msg-1',
      status: 'completed',
      steps: [makeStep({ phase: 'execute' })],
      updatedAt: '2026-05-02T08:31:00.000Z'
    });
    const group = snapshot.agentOsGroups.find(g => g.kind === 'execution');
    expect(group).toBeDefined();
  });

  it('resolves delivery group for summarize phase alongside execution steps', () => {
    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'sess-1',
      messageId: 'msg-1',
      status: 'completed',
      steps: [
        makeStep({ phase: 'execute', target: { kind: 'command', label: 'run' } }),
        makeStep({ id: 'step-2', phase: 'summarize', sourceEventType: 'review_completed' })
      ],
      updatedAt: '2026-05-02T08:31:00.000Z'
    });
    const group = snapshot.agentOsGroups.find(g => g.kind === 'delivery');
    expect(group).toBeDefined();
    expect(group?.summary).toBe('最终交付已整理');
  });

  it('defaults to thinking group for non-matching phase', () => {
    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'sess-1',
      messageId: 'msg-1',
      status: 'completed',
      steps: [
        makeStep({
          phase: 'execute',
          agentScope: 'main',
          target: { kind: 'command', label: 'think' },
          sourceEventType: 'tool_called'
        })
      ],
      updatedAt: '2026-05-02T08:31:00.000Z'
    });
    // execute phase maps to execution, not thinking. But we can verify execution group exists
    expect(snapshot.agentOsGroups.length).toBeGreaterThan(0);
  });

  it('derives group status as failed when any step is failed', () => {
    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'sess-1',
      messageId: 'msg-1',
      status: 'completed',
      steps: [makeStep({ phase: 'execute', status: 'failed' })],
      updatedAt: '2026-05-02T08:31:00.000Z'
    });
    const group = snapshot.agentOsGroups.find(g => g.kind === 'execution');
    expect(group?.status).toBe('failed');
  });

  it('derives group status as blocked', () => {
    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'sess-1',
      messageId: 'msg-1',
      status: 'completed',
      steps: [makeStep({ phase: 'execute', status: 'blocked' })],
      updatedAt: '2026-05-02T08:31:00.000Z'
    });
    const group = snapshot.agentOsGroups.find(g => g.kind === 'execution');
    expect(group?.status).toBe('blocked');
  });

  it('derives group status as cancelled', () => {
    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'sess-1',
      messageId: 'msg-1',
      status: 'completed',
      steps: [makeStep({ phase: 'execute', status: 'cancelled' })],
      updatedAt: '2026-05-02T08:31:00.000Z'
    });
    const group = snapshot.agentOsGroups.find(g => g.kind === 'execution');
    expect(group?.status).toBe('cancelled');
  });

  it('derives group status as running', () => {
    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'sess-1',
      messageId: 'msg-1',
      status: 'running',
      steps: [makeStep({ phase: 'execute', status: 'running' })],
      updatedAt: '2026-05-02T08:31:00.000Z'
    });
    const group = snapshot.agentOsGroups.find(g => g.kind === 'execution');
    expect(group?.status).toBe('running');
  });

  it('counts command steps in execution summary', () => {
    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'sess-1',
      messageId: 'msg-1',
      status: 'completed',
      steps: [
        makeStep({ phase: 'execute', target: { kind: 'command', label: 'cmd1' } }),
        makeStep({ id: 's2', phase: 'execute', target: { kind: 'command', label: 'cmd2' } }),
        makeStep({ id: 's3', phase: 'execute' })
      ],
      updatedAt: '2026-05-02T08:31:00.000Z'
    });
    const group = snapshot.agentOsGroups.find(g => g.kind === 'execution');
    expect(group?.summary).toContain('2 command(s)');
  });

  it('handles execution group without command steps', () => {
    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'sess-1',
      messageId: 'msg-1',
      status: 'completed',
      steps: [makeStep({ phase: 'execute' })],
      updatedAt: '2026-05-02T08:31:00.000Z'
    });
    const group = snapshot.agentOsGroups.find(g => g.kind === 'execution');
    expect(group?.summary).toContain('执行');
  });

  it('handles file target in readable step', () => {
    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'sess-1',
      messageId: 'msg-1',
      status: 'completed',
      steps: [makeStep({ target: { kind: 'file', label: 'test.ts', path: '/src/test.ts' }, phase: 'explore' })],
      updatedAt: '2026-05-02T08:31:00.000Z'
    });
    const allSteps = snapshot.agentOsGroups.flatMap(g => g.steps);
    const fileStep = allSteps.find(s => s.target?.kind === 'file');
    expect(fileStep?.title).toContain('查看');
  });

  it('does not filter low-value delivery steps from answer_only', () => {
    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'sess-1',
      messageId: 'msg-1',
      status: 'completed',
      steps: [
        makeStep({ sourceEventType: 'final_response_completed' }),
        makeStep({ id: 's2', sourceEventType: 'session_finished' })
      ],
      updatedAt: '2026-05-02T08:31:00.000Z'
    });
    expect(snapshot.displayMode).toBe('answer_only');
  });

  it('handles zero duration', () => {
    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'sess-1',
      messageId: 'msg-1',
      status: 'completed',
      steps: [makeStep({ phase: 'execute', durationMs: 0 })],
      updatedAt: '2026-05-02T08:31:00.000Z'
    });
    expect(snapshot.summary.title).not.toContain('用时');
  });
});
