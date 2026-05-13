import { describe, expect, it, vi } from 'vitest';

import { createStdioSessionClient, extractStdioContentText } from '../../src/mcp/mcp-stdio-session';
import type { StdioSessionRecord } from '../../src/mcp/mcp-stdio-session';

function makeSession(overrides: Partial<StdioSessionRecord> = {}): StdioSessionRecord {
  return {
    child: {
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: { setEncoding: vi.fn(), on: vi.fn() },
      stderr: { setEncoding: vi.fn(), on: vi.fn() },
      kill: vi.fn(),
      on: vi.fn()
    } as any,
    pending: new Map(),
    nextId: 1,
    stdoutBuffer: '',
    stderrBuffer: '',
    initialized: Promise.resolve(),
    createdAt: '2026-05-01T00:00:00.000Z',
    lastActivityAt: '2026-05-01T00:00:00.000Z',
    requestCount: 0,
    close: vi.fn(),
    ...overrides
  };
}

describe('createStdioSessionClient', () => {
  describe('send', () => {
    it('writes JSON message to stdin', () => {
      const session = makeSession();
      const client = createStdioSessionClient(session);

      client.send({ method: 'test', id: 1 });

      expect(session.child.stdin!.write).toHaveBeenCalledWith('{"method":"test","id":1}\n');
    });

    it('increments request count and updates lastActivityAt', () => {
      const session = makeSession();
      const client = createStdioSessionClient(session);

      client.send({ method: 'test' });

      expect(session.requestCount).toBe(1);
      expect(session.lastActivityAt).not.toBe('2026-05-01T00:00:00.000Z');
    });

    it('throws when stdin is unavailable', () => {
      const session = makeSession({ child: { stdin: null } as any });
      const client = createStdioSessionClient(session);

      expect(() => client.send({ method: 'test' })).toThrow('stdio_stdin_unavailable');
    });
  });

  describe('awaitResponse', () => {
    it('resolves when matching pending response is resolved', async () => {
      const session = makeSession();
      const client = createStdioSessionClient(session);

      const promise = client.awaitResponse(1, 5000);

      // Simulate resolving
      const waiter = session.pending.get(1);
      expect(waiter).toBeDefined();
      waiter!.resolve({ result: 'ok' });

      const result = await promise;
      expect(result).toEqual({ result: 'ok' });
    });

    it('rejects when matching pending response is rejected', async () => {
      const session = makeSession();
      const client = createStdioSessionClient(session);

      const promise = client.awaitResponse(1, 5000);

      const waiter = session.pending.get(1);
      waiter!.reject(new Error('server error'));

      await expect(promise).rejects.toThrow('server error');
    });

    it('rejects with timeout after timeoutMs', async () => {
      const session = makeSession();
      const client = createStdioSessionClient(session);

      const promise = client.awaitResponse(1, 1);

      await expect(promise).rejects.toThrow('stdio_timeout_1');
    }, 10000);
  });

  describe('nextId', () => {
    it('increments and returns next id', () => {
      const session = makeSession();
      const client = createStdioSessionClient(session);

      expect(client.nextId()).toBe(1);
      expect(client.nextId()).toBe(2);
      expect(client.nextId()).toBe(3);
    });
  });

  describe('close', () => {
    it('delegates to session.close', () => {
      const session = makeSession();
      const client = createStdioSessionClient(session);

      client.close();

      expect(session.close).toHaveBeenCalled();
    });
  });
});

describe('extractStdioContentText', () => {
  it('extracts text from content array', () => {
    const result = extractStdioContentText({
      content: [
        { type: 'text', text: 'line 1' },
        { type: 'text', text: 'line 2' }
      ]
    });

    expect(result).toBe('line 1\nline 2');
  });

  it('filters out non-text items', () => {
    const result = extractStdioContentText({
      content: [{ type: 'text', text: 'ok' }, { type: 'image' }, { text: undefined }]
    });

    expect(result).toBe('ok');
  });

  it('returns empty string when content is not an array', () => {
    expect(extractStdioContentText({})).toBe('');
    expect(extractStdioContentText({ content: 'not-array' as any })).toBe('');
  });

  it('returns empty string when content is empty array', () => {
    expect(extractStdioContentText({ content: [] })).toBe('');
  });

  it('handles content items without text property', () => {
    const result = extractStdioContentText({
      content: [{ type: 'text' }, { type: 'text', text: 'valid' }]
    });

    expect(result).toBe('valid');
  });
});
