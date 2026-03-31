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
});
