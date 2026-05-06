import type { NormalizedChatResponseStepsForMessage } from '../../src/utils/chat-response-step-projections';

export const responseStepsState: NormalizedChatResponseStepsForMessage = {
  messageId: 'assistant-1',
  status: 'running',
  updatedAt: '2026-05-02T08:30:00.000Z',
  displayMode: 'agent_execution',
  agentOsGroups: [
    {
      kind: 'exploration',
      title: '探索',
      summary: '已查看 1 个上下文',
      status: 'completed',
      steps: [
        {
          id: 'step-1',
          sessionId: 'session-1',
          messageId: 'assistant-1',
          sequence: 0,
          phase: 'explore',
          status: 'completed',
          title: 'Read chat-message-adapter.tsx',
          startedAt: '2026-05-02T08:30:00.000Z',
          completedAt: '2026-05-02T08:30:10.000Z',
          sourceEventId: 'event-1',
          sourceEventType: 'tool_called',
          agentScope: 'main',
          agentLabel: '首辅',
          ownerLabel: '主 Agent',
          durationMs: 10000
        }
      ]
    },
    {
      kind: 'verification',
      title: '验证',
      summary: '验证 1 项',
      status: 'running',
      steps: [
        {
          id: 'step-2',
          sessionId: 'session-1',
          messageId: 'assistant-1',
          sequence: 1,
          phase: 'verify',
          status: 'running',
          title: 'Ran pnpm exec vitest',
          detail: '运行受影响测试',
          startedAt: '2026-05-02T08:30:12.000Z',
          sourceEventId: 'event-2',
          sourceEventType: 'execution_step_started',
          agentScope: 'sub',
          agentLabel: '兵部',
          ownerLabel: '子 Agent'
        }
      ]
    }
  ],
  summary: {
    title: '处理中 2 个步骤',
    completedCount: 1,
    runningCount: 1,
    blockedCount: 0,
    failedCount: 0
  },
  steps: [
    {
      id: 'step-1',
      sessionId: 'session-1',
      messageId: 'assistant-1',
      sequence: 0,
      phase: 'explore',
      status: 'completed',
      title: 'Read chat-message-adapter.tsx',
      startedAt: '2026-05-02T08:30:00.000Z',
      completedAt: '2026-05-02T08:30:10.000Z',
      sourceEventId: 'event-1',
      sourceEventType: 'tool_called',
      agentScope: 'main',
      agentLabel: '首辅',
      ownerLabel: '主 Agent',
      nodeId: 'request-received',
      nodeLabel: '接收请求',
      toNodeId: 'route-selection',
      durationMs: 10000
    },
    {
      id: 'step-2',
      sessionId: 'session-1',
      messageId: 'assistant-1',
      sequence: 1,
      phase: 'verify',
      status: 'running',
      title: 'Ran pnpm exec vitest',
      detail: '运行受影响测试',
      startedAt: '2026-05-02T08:30:12.000Z',
      sourceEventId: 'event-2',
      sourceEventType: 'execution_step_started',
      agentScope: 'sub',
      agentLabel: '兵部',
      ownerLabel: '子 Agent',
      nodeId: 'verify'
    }
  ]
};
