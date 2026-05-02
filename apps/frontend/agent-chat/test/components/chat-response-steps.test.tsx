import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { ChatResponseStepsForMessage } from '../../src/lib/chat-response-step-projections';
import { QuickResponseSteps, ResponseStepSummary } from '../../src/components/chat-response-steps';

const state: ChatResponseStepsForMessage = {
  messageId: 'assistant-1',
  status: 'running',
  updatedAt: '2026-05-02T08:30:00.000Z',
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
      sourceEventType: 'tool_called'
    },
    {
      id: 'step-2',
      sessionId: 'session-1',
      messageId: 'assistant-1',
      sequence: 1,
      phase: 'verify',
      status: 'running',
      title: 'Ran pnpm exec vitest',
      startedAt: '2026-05-02T08:30:12.000Z',
      sourceEventId: 'event-2',
      sourceEventType: 'execution_step_started'
    }
  ]
};

describe('chat response step components', () => {
  it('renders running quick response steps', () => {
    const html = renderToStaticMarkup(<QuickResponseSteps responseSteps={state} />);

    expect(html).toContain('处理中 2 个步骤');
    expect(html).toContain('hidden');
    expect(html).toContain('Read chat-message-adapter.tsx');
    expect(html).toContain('Ran pnpm exec vitest');
  });

  it('renders completed summary and detail toggle', () => {
    const html = renderToStaticMarkup(<ResponseStepSummary responseSteps={{ ...state, status: 'completed' }} />);

    expect(html).toContain('处理中 2 个步骤');
    expect(html).toContain('chat-response-steps__chevron');
    expect(html).not.toContain('查看步骤细节');
  });
});
