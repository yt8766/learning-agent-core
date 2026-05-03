import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  foldChatResponseStepProjection,
  initialChatResponseStepsState
} from '../../src/lib/chat-response-step-projections';
import { QuickResponseSteps, ResponseStepSummary } from '../../src/components/chat-response-steps';
import { responseStepsState as state } from './chat-response-steps.fixtures';

describe('chat response step components', () => {
  it('renders running quick response steps', () => {
    const html = renderToStaticMarkup(<QuickResponseSteps responseSteps={state} />);

    expect(html).toContain('处理中 2 个步骤');
    expect(html).toContain('用时 10s');
    expect(html).not.toContain('<ol class="chat-response-steps__list" hidden');
    expect(html).toContain('chat-response-steps--agent-os is-running');
    expect(html).toContain('open=""');
    expect(html).toContain('探索');
    expect(html).toContain('Read chat-message-adapter.tsx');
    expect(html).toContain('验证');
    expect(html).toContain('Ran pnpm exec vitest');
    expect(html).not.toContain('主 Agent');
    expect(html).not.toContain('首辅');
    expect(html).not.toContain('接收请求');
    expect(html).not.toContain('request-received → route-selection');
  });

  it('renders inline Agent OS groups with user-readable steps only', () => {
    const html = renderToStaticMarkup(
      <QuickResponseSteps
        responseSteps={{
          ...state,
          displayMode: 'agent_execution',
          agentOsGroups: [
            {
              kind: 'exploration',
              title: '探索',
              summary: '已查看 1 个上下文',
              status: 'completed',
              steps: [
                {
                  ...state.steps[0],
                  title: '查看 chat-message-adapter.tsx',
                  nodeId: undefined,
                  nodeLabel: undefined,
                  fromNodeId: undefined,
                  toNodeId: undefined
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
                  ...state.steps[1],
                  title: '运行 agent-chat response steps tests',
                  agentLabel: '礼部',
                  nodeId: undefined
                }
              ]
            }
          ]
        }}
      />
    );

    expect(html).toContain('探索');
    expect(html).toContain('已查看 1 个上下文');
    expect(html).toContain('查看 chat-message-adapter.tsx');
    expect(html).toContain('验证');
    expect(html).toContain('运行 agent-chat response steps tests');
    expect(html).not.toContain('request-received');
    expect(html).not.toContain('route-selection');
    expect(html).not.toContain('主 Agent');
    expect(html).not.toContain('礼部');
  });

  it('does not construct legacy groups when projection did not provide Agent OS groups', () => {
    const html = renderToStaticMarkup(
      <QuickResponseSteps
        responseSteps={{
          messageId: state.messageId,
          status: 'running',
          updatedAt: state.updatedAt,
          summary: state.summary,
          steps: state.steps
        }}
      />
    );

    expect(html).toContain('chat-response-steps--agent-os is-running');
    expect(html).not.toContain('Read chat-message-adapter.tsx');
    expect(html).not.toContain('Ran pnpm exec vitest');
  });

  it('renders completed execution summaries collapsed by default', () => {
    const html = renderToStaticMarkup(
      <ResponseStepSummary
        responseSteps={{
          ...state,
          status: 'completed',
          displayMode: 'agent_execution',
          agentOsGroups: [
            {
              kind: 'execution',
              title: '执行',
              summary: 'Ran 1 command',
              status: 'completed',
              steps: [state.steps[1]]
            }
          ]
        }}
      />
    );

    expect(html).toContain('处理中 2 个步骤');
    expect(html).toContain('<details class="chat-response-steps chat-response-steps--agent-os is-complete">');
    expect(html).not.toContain('open=""');
    expect(html).toContain('执行');
    expect(html).toContain('Ran 1 command');
    expect(html).not.toContain('request-received → route-selection');
  });

  it('does not render response steps for answer-only final-response snapshots', () => {
    const html = renderToStaticMarkup(
      <ResponseStepSummary
        responseSteps={{
          messageId: 'assistant-answer',
          status: 'completed',
          updatedAt: '2026-05-03T09:00:00.000Z',
          displayMode: 'answer_only',
          summary: {
            title: '已思考',
            completedCount: 1,
            runningCount: 0,
            blockedCount: 0,
            failedCount: 0
          },
          steps: [
            {
              id: 'step-final',
              sessionId: 'session-1',
              messageId: 'assistant-answer',
              sequence: 0,
              phase: 'summarize',
              status: 'completed',
              title: '整理最终回复',
              startedAt: '2026-05-03T09:00:00.000Z',
              completedAt: '2026-05-03T09:00:00.000Z',
              sourceEventId: 'event-final',
              sourceEventType: 'final_response_completed'
            }
          ],
          agentOsGroups: []
        }}
      />
    );

    expect(html).toBe('');
  });

  it('renders completed summary detail metadata', () => {
    const html = renderToStaticMarkup(
      <ResponseStepSummary responseSteps={{ ...state, status: 'completed', displayMode: 'agent_execution' }} />
    );

    expect(html).toContain('chat-response-steps__chevron');
    expect(html).not.toContain('子 Agent');
    expect(html).toContain('运行受影响测试');
    expect(html).not.toContain('查看步骤细节');
  });

  it('does not render agent scope labels in inline Agent OS steps', () => {
    const html = renderToStaticMarkup(
      <QuickResponseSteps
        responseSteps={{
          ...state,
          agentOsGroups: state.agentOsGroups.map(group => ({
            ...group,
            steps: group.steps.map(step => ({
              ...step,
              ownerLabel: undefined
            }))
          })),
          steps: [
            {
              ...state.steps[0],
              ownerLabel: undefined,
              agentScope: 'main'
            },
            {
              ...state.steps[1],
              ownerLabel: undefined,
              agentScope: 'sub'
            }
          ]
        }}
      />
    );

    expect(html).not.toContain('主 Agent');
    expect(html).not.toContain('子 Agent');
  });

  it('derives agent execution groups for legacy snapshots', () => {
    const nextState = foldChatResponseStepProjection(initialChatResponseStepsState(), {
      projection: 'chat_response_steps',
      sessionId: 'session-1',
      messageId: state.messageId,
      status: 'running',
      steps: state.steps,
      summary: state.summary,
      updatedAt: state.updatedAt
    });

    const responseSteps = nextState.byMessageId[state.messageId];

    expect(responseSteps.displayMode).toBe('agent_execution');
    expect(responseSteps.agentOsGroups?.map(group => group.kind)).toEqual(['exploration', 'collaboration']);
    expect(responseSteps.agentOsGroups?.[0]?.steps[0]).not.toHaveProperty('nodeId');
    expect(responseSteps.agentOsGroups?.[0]?.steps[0]).not.toHaveProperty('toNodeId');
  });

  it('derives answer-only mode for final-response-only events', () => {
    const nextState = foldChatResponseStepProjection(initialChatResponseStepsState(), {
      projection: 'chat_response_step',
      action: 'completed',
      step: {
        id: 'step-final',
        sessionId: 'session-1',
        messageId: 'assistant-answer',
        sequence: 0,
        phase: 'summarize',
        status: 'completed',
        title: '整理最终回复',
        startedAt: '2026-05-03T09:00:00.000Z',
        completedAt: '2026-05-03T09:00:00.000Z',
        sourceEventId: 'event-final',
        sourceEventType: 'final_response_completed'
      }
    });

    const responseSteps = nextState.byMessageId['assistant-answer'];

    expect(responseSteps.displayMode).toBe('answer_only');
    expect(responseSteps.agentOsGroups).toEqual([]);
    expect(responseSteps.summary.title).toBe('已思考');
  });

  it('excludes final-response delivery steps from derived visible action counts', () => {
    const stateWithExecution = foldChatResponseStepProjection(initialChatResponseStepsState(), {
      projection: 'chat_response_step',
      action: 'started',
      step: {
        id: 'step-command',
        sessionId: 'session-1',
        messageId: 'assistant-command',
        sequence: 0,
        phase: 'execute',
        status: 'running',
        title: 'Run pnpm test',
        target: {
          kind: 'command',
          label: 'pnpm test'
        },
        startedAt: '2026-05-03T09:00:00.000Z',
        sourceEventId: 'event-command',
        sourceEventType: 'execution_step_started'
      }
    });

    const nextState = foldChatResponseStepProjection(stateWithExecution, {
      projection: 'chat_response_step',
      action: 'completed',
      step: {
        id: 'step-final',
        sessionId: 'session-1',
        messageId: 'assistant-command',
        sequence: 1,
        phase: 'summarize',
        status: 'completed',
        title: '整理最终回复',
        startedAt: '2026-05-03T09:00:01.000Z',
        completedAt: '2026-05-03T09:00:01.000Z',
        sourceEventId: 'event-final',
        sourceEventType: 'final_response_completed'
      }
    });

    const responseSteps = nextState.byMessageId['assistant-command'];

    expect(responseSteps.displayMode).toBe('agent_execution');
    expect(responseSteps.agentOsGroups?.map(group => group.kind)).toEqual(['execution', 'delivery']);
    expect(responseSteps.summary.title).toBe('处理中 1 个动作');
  });
});
