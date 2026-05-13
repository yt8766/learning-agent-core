import { describe, expect, it } from 'vitest';

import { KnowledgeServiceError, getErrorMessage } from '../../src/domains/knowledge/services/knowledge-service.error';

describe('KnowledgeServiceError', () => {
  it('creates error with code and message', () => {
    const error = new KnowledgeServiceError('test_code', 'test message');

    expect(error.code).toBe('test_code');
    expect(error.message).toBe('test message');
    expect(error.name).toBe('KnowledgeServiceError');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('getErrorMessage', () => {
  it('returns message from Error instance', () => {
    expect(getErrorMessage(new Error('test error'))).toBe('test error');
  });

  it('returns string representation for non-Error values', () => {
    expect(getErrorMessage('string error')).toBe('string error');
    expect(getErrorMessage(42)).toBe('42');
    expect(getErrorMessage(null)).toBe('null');
  });
});
