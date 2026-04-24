import { describe, expect, it } from 'vitest';

import {
  buildQuickActionChips,
  buildWorkspaceFollowUpActions,
  buildWorkspaceShareText,
  shouldShowMissionControl
} from '../../../apps/frontend/agent-chat/src/pages/chat-home/chat-home-workbench-support';
import { buildWorkbenchSectionState } from '../../../apps/frontend/agent-chat/src/pages/chat-home/chat-home-workbench-sections';

function createChatHarness(overrides: Record<string, unknown> = {}) {
  return {
    activeSession: {
      id: 'session-chat-smoke',
      title: 'Agent chat smoke',
      status: 'running'
    },
    checkpoint: {
      sessionId: 'session-chat-smoke',
      taskId: 'task-chat-smoke',
      graphState: { status: 'running', currentStep: 'execute' },
      pendingApprovals: [{ id: 'approval-1', title: 'Approve guarded write' }],
      learningCandidates: [{ id: 'candidate-1', summary: 'Reuse stable contracts' }]
    },
    messages: [],
    events: [],
    pendingApprovals: [{ id: 'approval-1', title: 'Approve guarded write' }],
    learningSuggestions: [{ id: 'candidate-1', summary: 'Reuse stable contracts' }],
    evidenceItems: [{ id: 'evidence-1', summary: 'Controlled docs' }],
    skillReuseBadges: [{ id: 'skill-1', label: 'Verification' }],
    hasMessages: true,
    sendMessage: async () => undefined,
    ...overrides
  };
}

describe('agent-chat workspace smoke', () => {
  it('keeps OpenClaw workspace support helpers alive for chat, approvals, evidence, learning, and skill reuse', () => {
    const chat = createChatHarness();
    const sectionState = buildWorkbenchSectionState(chat as never, []);
    const settledChat = createChatHarness({
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'Workspace smoke completed.',
          sessionId: 'session-chat-smoke'
        }
      ]
    });

    expect(shouldShowMissionControl(chat as never)).toBe(true);
    expect(sectionState.workbenchItems.length).toBeGreaterThan(0);
    expect(buildQuickActionChips(settledChat as never).length).toBeGreaterThan(0);
    expect(buildWorkspaceFollowUpActions(settledChat as never).length).toBeGreaterThan(0);
    expect(buildWorkspaceShareText(chat as never)).toContain('Agent chat smoke');
  });
});
