import { describe, expect, it } from 'vitest';

import {
  CHECKPOINT_REFRESH_EVENT_TYPES,
  MESSAGE_VISIBLE_EVENT_TYPES,
  STARTER_PROMPT,
  PENDING_ASSISTANT_PREFIX,
  PENDING_USER_PREFIX,
  LOCAL_USER_EPHEMERAL_SLUG,
  LOCAL_USER_EPHEMERAL_ID_PREFIX,
  formatSessionTime,
  getSessionStatusLabel,
  getMessageRoleLabel
} from '@/hooks/chat-session/chat-session-formatters';

describe('chat-session-formatters', () => {
  it('refreshes checkpoint on early planning and research events so skill cards can appear before final answer', () => {
    expect(CHECKPOINT_REFRESH_EVENT_TYPES.has('manager_planned')).toBe(true);
    expect(CHECKPOINT_REFRESH_EVENT_TYPES.has('skill_resolved')).toBe(true);
    expect(CHECKPOINT_REFRESH_EVENT_TYPES.has('libu_routed')).toBe(true);
    expect(CHECKPOINT_REFRESH_EVENT_TYPES.has('ministry_started')).toBe(true);
    expect(CHECKPOINT_REFRESH_EVENT_TYPES.has('ministry_reported')).toBe(true);
    expect(CHECKPOINT_REFRESH_EVENT_TYPES.has('research_progress')).toBe(true);
  });

  describe('constants', () => {
    it('STARTER_PROMPT is empty string', () => {
      expect(STARTER_PROMPT).toBe('');
    });

    it('PENDING_ASSISTANT_PREFIX has correct value', () => {
      expect(PENDING_ASSISTANT_PREFIX).toBe('pending_assistant_');
    });

    it('PENDING_USER_PREFIX has correct value', () => {
      expect(PENDING_USER_PREFIX).toBe('pending_user_');
    });

    it('LOCAL_USER_EPHEMERAL_SLUG has correct value', () => {
      expect(LOCAL_USER_EPHEMERAL_SLUG).toBe('local-user');
    });

    it('LOCAL_USER_EPHEMERAL_ID_PREFIX matches slug prefix', () => {
      expect(LOCAL_USER_EPHEMERAL_ID_PREFIX).toBe('local-user_');
    });
  });

  describe('CHECKPOINT_REFRESH_EVENT_TYPES', () => {
    it('includes all expected event types', () => {
      expect(CHECKPOINT_REFRESH_EVENT_TYPES.has('interrupt_pending')).toBe(true);
      expect(CHECKPOINT_REFRESH_EVENT_TYPES.has('interrupt_resumed')).toBe(true);
      expect(CHECKPOINT_REFRESH_EVENT_TYPES.has('approval_required')).toBe(true);
      expect(CHECKPOINT_REFRESH_EVENT_TYPES.has('approval_resolved')).toBe(true);
      expect(CHECKPOINT_REFRESH_EVENT_TYPES.has('run_cancelled')).toBe(true);
      expect(CHECKPOINT_REFRESH_EVENT_TYPES.has('learning_pending_confirmation')).toBe(true);
      expect(CHECKPOINT_REFRESH_EVENT_TYPES.has('learning_confirmed')).toBe(true);
      expect(CHECKPOINT_REFRESH_EVENT_TYPES.has('final_response_completed')).toBe(true);
      expect(CHECKPOINT_REFRESH_EVENT_TYPES.has('session_finished')).toBe(true);
      expect(CHECKPOINT_REFRESH_EVENT_TYPES.has('session_failed')).toBe(true);
    });

    it('excludes non-refresh event types', () => {
      expect(CHECKPOINT_REFRESH_EVENT_TYPES.has('assistant_token')).toBe(false);
      expect(CHECKPOINT_REFRESH_EVENT_TYPES.has('conversation_compacted')).toBe(false);
    });
  });

  describe('MESSAGE_VISIBLE_EVENT_TYPES', () => {
    it('includes expected visible types', () => {
      expect(MESSAGE_VISIBLE_EVENT_TYPES.has('conversation_compacted')).toBe(true);
      expect(MESSAGE_VISIBLE_EVENT_TYPES.has('interrupt_pending')).toBe(true);
      expect(MESSAGE_VISIBLE_EVENT_TYPES.has('approval_required')).toBe(true);
      expect(MESSAGE_VISIBLE_EVENT_TYPES.has('run_cancelled')).toBe(true);
      expect(MESSAGE_VISIBLE_EVENT_TYPES.has('run_resumed')).toBe(true);
    });

    it('excludes non-visible types', () => {
      expect(MESSAGE_VISIBLE_EVENT_TYPES.has('assistant_token')).toBe(false);
      expect(MESSAGE_VISIBLE_EVENT_TYPES.has('session_finished')).toBe(false);
    });
  });

  describe('formatSessionTime', () => {
    it('returns "--" for undefined input', () => {
      expect(formatSessionTime(undefined)).toBe('--');
    });

    it('returns "--" for empty string', () => {
      expect(formatSessionTime('')).toBe('--');
    });

    it('formats valid ISO date string', () => {
      const result = formatSessionTime('2026-03-28T12:00:00.000Z');
      expect(result).not.toBe('--');
      expect(result).toBeTruthy();
    });
  });

  describe('getSessionStatusLabel', () => {
    it('returns "运行中" for running', () => {
      expect(getSessionStatusLabel('running')).toBe('运行中');
    });

    it('returns "待澄清方案" for waiting_interrupt', () => {
      expect(getSessionStatusLabel('waiting_interrupt')).toBe('待澄清方案');
    });

    it('returns "待审批" for waiting_approval', () => {
      expect(getSessionStatusLabel('waiting_approval')).toBe('待审批');
    });

    it('returns "待确认入库" for waiting_learning_confirmation', () => {
      expect(getSessionStatusLabel('waiting_learning_confirmation')).toBe('待确认入库');
    });

    it('returns "已取消" for cancelled', () => {
      expect(getSessionStatusLabel('cancelled')).toBe('已取消');
    });

    it('returns "已完成" for completed', () => {
      expect(getSessionStatusLabel('completed')).toBe('已完成');
    });

    it('returns "失败" for failed', () => {
      expect(getSessionStatusLabel('failed')).toBe('失败');
    });

    it('returns "未开始" for undefined', () => {
      expect(getSessionStatusLabel(undefined)).toBe('未开始');
    });

    it('returns "未开始" for unknown status', () => {
      expect(getSessionStatusLabel('unknown')).toBe('未开始');
    });

    it('returns "未开始" for idle', () => {
      expect(getSessionStatusLabel('idle')).toBe('未开始');
    });
  });

  describe('getMessageRoleLabel', () => {
    it('returns "用户" for user', () => {
      expect(getMessageRoleLabel('user')).toBe('用户');
    });

    it('returns "AI" for assistant', () => {
      expect(getMessageRoleLabel('assistant')).toBe('AI');
    });

    it('returns "系统" for system', () => {
      expect(getMessageRoleLabel('system')).toBe('系统');
    });
  });
});
