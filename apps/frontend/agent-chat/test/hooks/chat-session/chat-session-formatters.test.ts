import { describe, expect, it } from 'vitest';

import { CHECKPOINT_REFRESH_EVENT_TYPES } from '@/hooks/chat-session/chat-session-formatters';

describe('chat-session-formatters', () => {
  it('refreshes checkpoint on early planning and research events so skill cards can appear before final answer', () => {
    expect(CHECKPOINT_REFRESH_EVENT_TYPES.has('manager_planned')).toBe(true);
    expect(CHECKPOINT_REFRESH_EVENT_TYPES.has('skill_resolved')).toBe(true);
    expect(CHECKPOINT_REFRESH_EVENT_TYPES.has('libu_routed')).toBe(true);
    expect(CHECKPOINT_REFRESH_EVENT_TYPES.has('ministry_started')).toBe(true);
    expect(CHECKPOINT_REFRESH_EVENT_TYPES.has('ministry_reported')).toBe(true);
    expect(CHECKPOINT_REFRESH_EVENT_TYPES.has('research_progress')).toBe(true);
  });
});
