import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';

import { normalizeDirectMessages, extractDirectGoal } from '../../src/chat/chat-direct-response.helpers';

describe('normalizeDirectMessages', () => {
  it('normalizes messages from dto.messages array', () => {
    const result = normalizeDirectMessages({
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi there' }
      ]
    } as any);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ role: 'user', content: 'hello' });
    expect(result[1]).toEqual({ role: 'assistant', content: 'hi there' });
  });

  it('filters out messages with empty content', () => {
    const result = normalizeDirectMessages({
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'user', content: '   ' },
        { role: 'user', content: '' }
      ]
    } as any);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('hello');
  });

  it('trims message content', () => {
    const result = normalizeDirectMessages({
      messages: [{ role: 'user', content: '  hello  ' }]
    } as any);
    expect(result[0].content).toBe('hello');
  });

  it('falls back to dto.message when messages is empty after filtering', () => {
    const result = normalizeDirectMessages({
      message: 'fallback message'
    } as any);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ role: 'user', content: 'fallback message' });
  });

  it('falls back to dto.message when messages is not an array', () => {
    const result = normalizeDirectMessages({
      message: 'only message'
    } as any);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('only message');
  });

  it('throws BadRequestException when no messages and no message', () => {
    expect(() => normalizeDirectMessages({} as any)).toThrow(BadRequestException);
  });

  it('throws BadRequestException when messages is empty array and no message', () => {
    expect(() => normalizeDirectMessages({ messages: [] } as any)).toThrow(BadRequestException);
  });

  it('throws BadRequestException when all messages have empty content and no message', () => {
    expect(() =>
      normalizeDirectMessages({
        messages: [{ role: 'user', content: '   ' }]
      } as any)
    ).toThrow(BadRequestException);
  });

  it('prepends system prompt when provided', () => {
    const result = normalizeDirectMessages({
      messages: [{ role: 'user', content: 'hello' }],
      systemPrompt: 'You are a helper'
    } as any);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ role: 'system', content: 'You are a helper' });
    expect(result[1].content).toBe('hello');
  });

  it('does not prepend system prompt when it is empty', () => {
    const result = normalizeDirectMessages({
      messages: [{ role: 'user', content: 'hello' }],
      systemPrompt: '   '
    } as any);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('user');
  });

  it('trims system prompt content', () => {
    const result = normalizeDirectMessages({
      messages: [{ role: 'user', content: 'hello' }],
      systemPrompt: '  system instructions  '
    } as any);
    expect(result[0].content).toBe('system instructions');
  });

  it('handles null message content in messages array', () => {
    const result = normalizeDirectMessages({
      messages: [
        { role: 'user', content: null },
        { role: 'user', content: 'valid' }
      ],
      message: 'fallback'
    } as any);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('valid');
  });

  it('handles undefined messages field', () => {
    const result = normalizeDirectMessages({
      messages: undefined,
      message: 'fallback'
    } as any);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('fallback');
  });
});

describe('extractDirectGoal', () => {
  it('extracts non-system messages content joined by newlines', () => {
    const result = extractDirectGoal({
      messages: [
        { role: 'system', content: 'system prompt' },
        { role: 'user', content: 'first question' },
        { role: 'assistant', content: 'first answer' },
        { role: 'user', content: 'second question' }
      ]
    } as any);
    expect(result).toBe('first question\nfirst answer\nsecond question');
  });

  it('trims the result', () => {
    const result = extractDirectGoal({
      messages: [{ role: 'user', content: '  hello  ' }]
    } as any);
    expect(result).toBe('hello');
  });

  it('falls back to message field', () => {
    const result = extractDirectGoal({ message: 'direct message' } as any);
    expect(result).toBe('direct message');
  });
});
