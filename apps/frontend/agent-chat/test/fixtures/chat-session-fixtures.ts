import type { ChatCheckpointRecord, ChatEventRecord } from '@/types/chat';

// Legacy executionMode aliases stay in fixtures only to verify canonical executionPlan.mode normalization.
export function buildChatCheckpoint(overrides: Partial<ChatCheckpointRecord> = {}): ChatCheckpointRecord {
  return {
    sessionId: 'session-1',
    taskId: 'task-1',
    traceCursor: 0,
    messageCursor: 0,
    approvalCursor: 0,
    learningCursor: 0,
    pendingApprovals: [],
    agentStates: [],
    graphState: {
      status: 'running',
      currentStep: 'replying'
    },
    thinkState: {
      messageId: 'assistant-1',
      thinkingDurationMs: 500,
      title: '正在思考',
      content: '正在分析你的问题并组织接下来的处理。',
      loading: true,
      blink: true
    },
    createdAt: '2026-03-28T00:00:00.000Z',
    updatedAt: '2026-03-28T00:00:00.000Z',
    ...overrides
  };
}

export function buildChatEvent(type: string, sessionId = 'session-1'): ChatEventRecord {
  return {
    id: `evt-${type}`,
    sessionId,
    type,
    at: '2026-03-28T00:00:01.000Z',
    payload: {}
  } as ChatEventRecord;
}

export function buildPendingPlanQuestionCheckpoint(): ChatCheckpointRecord {
  return buildChatCheckpoint({
    // Legacy compatibility sample: canonical UI reads this as executionPlan.mode = plan.
    executionMode: 'planning-readonly',
    // activeInterrupt is the persisted 司礼监 / InterruptController projection in stored checkpoints.
    activeInterrupt: {
      id: 'interrupt-1',
      status: 'pending',
      mode: 'blocking',
      source: 'graph',
      kind: 'user-input',
      resumeStrategy: 'command',
      payload: {
        interactionKind: 'plan-question',
        questionSet: {
          title: '方案确认'
        }
      },
      createdAt: '2026-03-29T00:00:00.000Z'
    },
    planDraft: {
      summary: '',
      autoResolved: [],
      openQuestions: [],
      assumptions: []
    }
  });
}
