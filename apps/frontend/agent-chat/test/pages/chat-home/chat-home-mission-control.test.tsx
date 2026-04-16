import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SessionMissionControl } from '@/pages/chat-home/chat-home-mission-control';

describe('chat-home-mission-control', () => {
  it('renders the current skill execution summary when a compiled skill step is running', () => {
    const html = renderToStaticMarkup(
      <SessionMissionControl
        chat={
          {
            pendingApprovals: [],
            checkpoint: {
              taskId: 'task_1',
              graphState: {
                status: 'running',
                currentStep: 'execute'
              },
              currentWorker: 'bingbu-ops',
              currentMinistry: 'bingbu-ops',
              currentSkillExecution: {
                skillId: 'user-skill:lark-notify',
                displayName: 'Lark notify skill',
                phase: 'execute',
                stepIndex: 2,
                totalSteps: 3,
                title: 'Send Lark notification',
                instruction: 'Send the final release note to Lark.',
                updatedAt: '2026-03-29T08:00:00.000Z'
              },
              agentStates: [],
              externalSources: [],
              reusedMemories: [],
              reusedRules: [],
              reusedSkills: []
            }
          } as never
        }
      />
    );

    expect(html).toContain('Lark notify skill');
    expect(html).toContain('2/3');
    expect(html).toContain('Send Lark notification');
    expect(html).toContain('Send the final release note to Lark.');
  });

  it('shows why a memory was used when memory reuse evidence carries ranking reasons', () => {
    const html = renderToStaticMarkup(
      <SessionMissionControl
        chat={
          {
            pendingApprovals: [],
            refreshSessionDetail: async () => undefined,
            checkpoint: {
              taskId: 'task_memory_1',
              graphState: {
                status: 'running',
                currentStep: 'plan'
              },
              agentStates: [],
              externalSources: [
                {
                  id: 'memory-source-1',
                  taskId: 'task_memory_1',
                  sourceType: 'memory_reuse',
                  trustClass: 'internal',
                  summary: '已命中历史记忆：该项目禁止自动提交代码。',
                  detail: {
                    memoryId: 'memory-1',
                    reason: 'entity matched; same scope; strong relevance',
                    score: 0.91,
                    scopeType: 'task'
                  },
                  createdAt: '2026-04-16T00:00:00.000Z'
                }
              ],
              reusedMemories: ['memory-1'],
              reusedRules: [],
              reusedSkills: []
            }
          } as never
        }
      />
    );

    expect(html).toContain('memory:该项目禁止自动提交代码');
    expect(html).toContain('Why this memory was used');
    expect(html).toContain('采用原因：entity matched; same scope; strong relevance · score 0.91');
    expect(html).toContain('scope task');
  });
});
