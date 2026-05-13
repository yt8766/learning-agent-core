import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { normalizeDirectMessages, extractDirectGoal } from '../../src/chat/chat-direct-response.helpers';

describe('normalizeDirectMessages', () => {
  it('normalizes messages from dto.messages', () => {
    const result = normalizeDirectMessages({
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi there' }
      ]
    } as any);
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe('user');
    expect(result[0].content).toBe('hello');
  });

  it('filters empty messages', () => {
    const result = normalizeDirectMessages({
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'user', content: '' },
        { role: 'user', content: '   ' },
        { role: 'user', content: null }
      ]
    } as any);
    expect(result).toHaveLength(1);
  });

  it('falls back to dto.message when messages is empty', () => {
    const result = normalizeDirectMessages({
      messages: [],
      message: 'fallback message'
    } as any);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('fallback message');
  });

  it('falls back to dto.message when messages is not array', () => {
    const result = normalizeDirectMessages({
      message: 'fallback message'
    } as any);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('fallback message');
  });

  it('throws when no messages and no message', () => {
    expect(() => normalizeDirectMessages({} as any)).toThrow(BadRequestException);
    expect(() => normalizeDirectMessages({ messages: [] } as any)).toThrow(BadRequestException);
    expect(() => normalizeDirectMessages({ message: '' } as any)).toThrow(BadRequestException);
    expect(() => normalizeDirectMessages({ message: '   ' } as any)).toThrow(BadRequestException);
  });

  it('prepends system prompt when present', () => {
    const result = normalizeDirectMessages({
      message: 'hello',
      systemPrompt: 'You are a helpful assistant'
    } as any);
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe('system');
    expect(result[0].content).toBe('You are a helpful assistant');
    expect(result[1].role).toBe('user');
  });

  it('does not prepend empty system prompt', () => {
    const result = normalizeDirectMessages({
      message: 'hello',
      systemPrompt: ''
    } as any);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('user');
  });

  it('trims message content', () => {
    const result = normalizeDirectMessages({
      messages: [{ role: 'user', content: '  hello  ' }]
    } as any);
    expect(result[0].content).toBe('hello');
  });
});

describe('extractDirectGoal', () => {
  it('extracts non-system message content', () => {
    const result = extractDirectGoal({
      messages: [
        { role: 'system', content: 'system prompt' },
        { role: 'user', content: 'what is 2+2?' }
      ]
    } as any);
    expect(result).toBe('what is 2+2?');
  });

  it('joins multiple user messages', () => {
    const result = extractDirectGoal({
      messages: [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'response' },
        { role: 'user', content: 'second' }
      ]
    } as any);
    expect(result).toBe('first\nresponse\nsecond');
  });

  it('falls back to message field', () => {
    const result = extractDirectGoal({ message: 'simple goal' } as any);
    expect(result).toBe('simple goal');
  });
});
