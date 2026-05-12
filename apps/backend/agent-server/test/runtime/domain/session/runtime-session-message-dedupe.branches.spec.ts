import { describe, expect, it } from 'vitest';

import { dedupeSessionMessages } from '../../../../src/runtime/domain/session/runtime-session-message-dedupe';

function makeMessage(overrides: Record<string, any> = {}) {
  return {
    id: 'msg-1',
    role: 'assistant' as const,
    content: 'Hello world',
    conversationId: 'conv-1',
    createdAt: '2026-05-01T00:00:00.000Z',
    ...overrides
  };
}

describe('dedupeSessionMessages', () => {
  it('returns empty array for empty input', () => {
    expect(dedupeSessionMessages([])).toEqual([]);
  });

  it('keeps non-duplicate messages', () => {
    const messages = [
      makeMessage({ id: 'msg-1', content: 'First message' }),
      makeMessage({ id: 'msg-2', content: 'Second message' })
    ];
    const result = dedupeSessionMessages(messages);
    expect(result).toHaveLength(2);
  });

  it('collapses assistant messages with same content and same identity', () => {
    const messages = [
      makeMessage({ id: 'msg-1', taskId: 'task-1', content: 'Same content' }),
      makeMessage({ id: 'msg-2', taskId: 'task-1', content: 'Same content' })
    ];
    const result = dedupeSessionMessages(messages);
    expect(result).toHaveLength(1);
  });

  it('collapses when left starts with right and same identity', () => {
    const messages = [
      makeMessage({ id: 'msg-1', taskId: 'task-1', content: 'Hello world and more' }),
      makeMessage({ id: 'msg-2', taskId: 'task-1', content: 'Hello world' })
    ];
    const result = dedupeSessionMessages(messages);
    expect(result).toHaveLength(1);
  });

  it('collapses when right starts with left and same identity', () => {
    const messages = [
      makeMessage({ id: 'msg-1', taskId: 'task-1', content: 'Hello' }),
      makeMessage({ id: 'msg-2', taskId: 'task-1', content: 'Hello world' })
    ];
    const result = dedupeSessionMessages(messages);
    expect(result).toHaveLength(1);
  });

  it('does not collapse user messages', () => {
    const messages = [
      makeMessage({ id: 'msg-1', role: 'user', content: 'Same content' }),
      makeMessage({ id: 'msg-2', role: 'user', content: 'Same content' })
    ];
    const result = dedupeSessionMessages(messages);
    expect(result).toHaveLength(2);
  });

  it('does not collapse when roles differ', () => {
    const messages = [
      makeMessage({ id: 'msg-1', role: 'user', content: 'Same content' }),
      makeMessage({ id: 'msg-2', role: 'assistant', content: 'Same content' })
    ];
    const result = dedupeSessionMessages(messages);
    expect(result).toHaveLength(2);
  });

  it('does not collapse when content is empty', () => {
    const messages = [makeMessage({ id: 'msg-1', content: '' }), makeMessage({ id: 'msg-2', content: '' })];
    const result = dedupeSessionMessages(messages);
    expect(result).toHaveLength(2);
  });

  it('does not collapse when content is whitespace only', () => {
    const messages = [makeMessage({ id: 'msg-1', content: '   ' }), makeMessage({ id: 'msg-2', content: '   ' })];
    const result = dedupeSessionMessages(messages);
    expect(result).toHaveLength(2);
  });

  it('uses taskId for identity matching', () => {
    const messages = [
      makeMessage({ id: 'msg-1', taskId: 'task-1', content: 'Same content' }),
      makeMessage({ id: 'msg-2', taskId: 'task-1', content: 'Same content' })
    ];
    const result = dedupeSessionMessages(messages);
    expect(result).toHaveLength(1);
  });

  it('does not collapse when taskIds differ', () => {
    const messages = [
      makeMessage({ id: 'msg-1', taskId: 'task-1', content: 'Same content' }),
      makeMessage({ id: 'msg-2', taskId: 'task-2', content: 'Same content' })
    ];
    const result = dedupeSessionMessages(messages);
    expect(result).toHaveLength(2);
  });

  it('extracts task identity from stream message prefix', () => {
    const messages = [
      makeMessage({ id: 'progress_stream_abc', content: 'Same content' }),
      makeMessage({ id: 'progress_stream_abc', content: 'Same content' })
    ];
    const result = dedupeSessionMessages(messages);
    expect(result).toHaveLength(1);
  });

  it('extracts task identity from direct_reply prefix', () => {
    const messages = [
      makeMessage({ id: 'direct_reply_xyz', content: 'Same content' }),
      makeMessage({ id: 'direct_reply_xyz', content: 'Same content' })
    ];
    const result = dedupeSessionMessages(messages);
    expect(result).toHaveLength(1);
  });

  it('extracts task identity from summary_stream prefix', () => {
    const messages = [
      makeMessage({ id: 'summary_stream_def', content: 'Same content' }),
      makeMessage({ id: 'summary_stream_def', content: 'Same content' })
    ];
    const result = dedupeSessionMessages(messages);
    expect(result).toHaveLength(1);
  });

  it('does not collapse when stream prefixes produce different identities', () => {
    const messages = [
      makeMessage({ id: 'progress_stream_abc', content: 'Same content' }),
      makeMessage({ id: 'direct_reply_xyz', content: 'Same content' })
    ];
    const result = dedupeSessionMessages(messages);
    expect(result).toHaveLength(2);
  });

  it('prefers non-transient message when left is transient', () => {
    // Both must share identity (same taskId) and content must prefix-match for collapse
    const messages = [
      makeMessage({ id: 'progress_stream_abc', taskId: 'task-1', content: 'Hello' }),
      makeMessage({ id: 'msg-2', taskId: 'task-1', content: 'Hello world' })
    ];
    const result = dedupeSessionMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('msg-2');
  });

  it('prefers non-transient message when right is transient', () => {
    const messages = [
      makeMessage({ id: 'msg-1', taskId: 'task-1', content: 'Hello world' }),
      makeMessage({ id: 'progress_stream_abc', taskId: 'task-1', content: 'Hello' })
    ];
    const result = dedupeSessionMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('msg-1');
  });

  it('picks longer content when both are transient and same identity', () => {
    // Same id prefix 'progress_stream_abc' gives same identity 'abc', and content must prefix-match
    const messages = [
      makeMessage({ id: 'progress_stream_abc', content: 'Hello' }),
      makeMessage({ id: 'progress_stream_abc', content: 'Hello world extra' })
    ];
    const result = dedupeSessionMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Hello world extra');
  });

  it('picks longer content when neither is transient and same identity', () => {
    const messages = [
      makeMessage({ id: 'msg-1', content: 'Hello' }),
      makeMessage({ id: 'msg-1', content: 'Hello world extra' })
    ];
    const result = dedupeSessionMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Hello world extra');
  });

  it('uses right createdAt when right has it', () => {
    const messages = [
      makeMessage({ id: 'progress_stream_abc', taskId: 'task-1', content: 'Hello', createdAt: '2026-05-01' }),
      makeMessage({ id: 'msg-2', taskId: 'task-1', content: 'Hello world', createdAt: '2026-05-02' })
    ];
    const result = dedupeSessionMessages(messages);
    expect(result[0].createdAt).toBe('2026-05-02');
  });

  it('falls back to left createdAt when right is empty', () => {
    const messages = [
      makeMessage({ id: 'progress_stream_abc', taskId: 'task-1', content: 'Hello', createdAt: '2026-05-01' }),
      makeMessage({ id: 'msg-2', taskId: 'task-1', content: 'Hello world', createdAt: '' })
    ];
    const result = dedupeSessionMessages(messages);
    expect(result[0].createdAt).toBe('2026-05-01');
  });

  it('uses message id as identity when no taskId and no stream prefix', () => {
    const messages = [
      makeMessage({ id: 'custom-id', content: 'Same content' }),
      makeMessage({ id: 'custom-id', content: 'Same content' })
    ];
    const result = dedupeSessionMessages(messages);
    expect(result).toHaveLength(1);
  });

  it('does not collapse when regular ids differ and no taskId', () => {
    const messages = [
      makeMessage({ id: 'id-1', content: 'Same content' }),
      makeMessage({ id: 'id-2', content: 'Same content' })
    ];
    const result = dedupeSessionMessages(messages);
    expect(result).toHaveLength(2);
  });
});
