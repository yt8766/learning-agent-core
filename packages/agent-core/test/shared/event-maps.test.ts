import { describe, expect, it } from 'vitest';

import { TASK_MESSAGE_EVENT_MAP, TRACE_EVENT_MAP } from '../../src/utils/event-maps';

describe('event maps', () => {
  it('maps trace events to chat event record types, including aliases and governance events', () => {
    expect(TRACE_EVENT_MAP.decree_received).toBe('decree_received');
    expect(TRACE_EVENT_MAP.supervisor_planned).toBe('supervisor_planned');
    expect(TRACE_EVENT_MAP.dispatch).toBe('subtask_dispatched');
    expect(TRACE_EVENT_MAP.research).toBe('research_progress');
    expect(TRACE_EVENT_MAP.execute).toBe('tool_called');
    expect(TRACE_EVENT_MAP.review).toBe('review_completed');
    expect(TRACE_EVENT_MAP.manager_plan).toBe('manager_planned');
    expect(TRACE_EVENT_MAP.manager_replan).toBe('manager_planned');
    expect(TRACE_EVENT_MAP.planning_readonly_guard).toBe('research_progress');
    expect(TRACE_EVENT_MAP.approval_gate).toBe('interrupt_pending');
    expect(TRACE_EVENT_MAP.approval_rejected_with_feedback).toBe('interrupt_rejected_with_feedback');
    expect(TRACE_EVENT_MAP.budget_exhausted).toBe('budget_exhausted');
    expect(TRACE_EVENT_MAP.finish).toBe('session_finished');
    expect(TRACE_EVENT_MAP.memory_write).toBe('learning_pending_confirmation');
    expect(TRACE_EVENT_MAP.rule_write).toBe('learning_pending_confirmation');
    expect(TRACE_EVENT_MAP.skill_extract).toBe('learning_pending_confirmation');
  });

  it('maps task message event types to frontend chat event types', () => {
    expect(TASK_MESSAGE_EVENT_MAP.dispatch).toBe('subtask_dispatched');
    expect(TASK_MESSAGE_EVENT_MAP.research_result).toBe('research_progress');
    expect(TASK_MESSAGE_EVENT_MAP.execution_result).toBe('tool_called');
    expect(TASK_MESSAGE_EVENT_MAP.review_result).toBe('review_completed');
    expect(TASK_MESSAGE_EVENT_MAP.summary).toBe('assistant_message');
  });
});
