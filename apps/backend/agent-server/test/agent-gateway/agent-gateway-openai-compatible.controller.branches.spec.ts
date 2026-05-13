import { BadRequestException, HttpException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AgentGatewayOpenAICompatibleController } from '../../src/api/agent-gateway/agent-gateway-openai-compatible.controller';

function createController(overrides: Record<string, any> = {}) {
  const auth = {
    authenticate: vi.fn(async () => ({
      client: { id: 'client-1' },
      apiKey: { id: 'key-1', scopes: ['chat.completions'] }
    })),
    ...overrides.auth
  };
  const runtimeEngine = {
    listModels: vi.fn(() => ({
      data: [{ id: 'gpt-4', object: 'model', created: Date.now(), owned_by: 'openai' }]
    })),
    invoke: vi.fn(async () => ({
      model: 'gpt-4',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      route: { providerKind: 'openai' },
      choices: [{ message: { role: 'assistant', content: 'Hello' }, finish_reason: 'stop', index: 0 }]
    })),
    stream: vi.fn(async function* () {
      yield { type: 'delta', delta: { content: 'Hello' } };
      yield { type: 'usage', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } };
    }),
    ...overrides.runtimeEngine
  };
  const accounting = {
    assertQuota: vi.fn(async () => {}),
    recordSuccess: vi.fn(async () => {}),
    ...overrides.accounting
  };
  const streaming = {
    writeOpenAIChatSse: vi.fn(async () => {}),
    toOpenAIChatSse: vi.fn(async () => 'data: [DONE]\n\n'),
    ...overrides.streaming
  };
  return new AgentGatewayOpenAICompatibleController(auth, runtimeEngine, accounting, streaming);
}

describe('AgentGatewayOpenAICompatibleController - branch coverage', () => {
  describe('models endpoint', () => {
    it('returns models list', async () => {
      const controller = createController();
      const result = await controller.models('Bearer test-key');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('gpt-4');
    });
  });

  describe('chatCompletions - validation', () => {
    it('rejects invalid body', async () => {
      const controller = createController();
      await expect(controller.chatCompletions('Bearer key', {})).rejects.toThrow(BadRequestException);
    });

    it('rejects null body', async () => {
      const controller = createController();
      await expect(controller.chatCompletions('Bearer key', null)).rejects.toThrow(BadRequestException);
    });

    it('rejects body with empty messages', async () => {
      const controller = createController();
      await expect(controller.chatCompletions('Bearer key', { model: 'gpt-4', messages: [] })).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('chatCompletions - non-streaming', () => {
    it('returns completion response', async () => {
      const controller = createController();
      const result = await controller.chatCompletions('Bearer key', {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false
      });
      expect(result).toBeDefined();
    });

    it('handles various message content types', async () => {
      const controller = createController();
      // Test with a simple string content message
      const result = await controller.chatCompletions('Bearer key', {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello world this is a longer message' }],
        stream: false
      });
      expect(result).toBeDefined();
    });
  });

  describe('chatCompletions - streaming', () => {
    it('writes SSE when response object is provided', async () => {
      const controller = createController({
        streaming: {
          writeOpenAIChatSse: vi.fn(async (response: any) => {
            response.setHeader('Content-Type', 'text/event-stream');
            response.write('data: [DONE]\n\n');
            response.end();
          })
        }
      });
      const mockResponse = {
        setHeader: vi.fn(),
        write: vi.fn(),
        end: vi.fn()
      };
      const result = await controller.chatCompletions(
        'Bearer key',
        { model: 'gpt-4', messages: [{ role: 'user', content: 'Hello' }], stream: true },
        mockResponse
      );
      expect(result).toBeUndefined();
      expect(mockResponse.setHeader).toHaveBeenCalled();
    });

    it('returns SSE string when no response object', async () => {
      const controller = createController();
      const result = await controller.chatCompletions('Bearer key', {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true
      });
      expect(result).toBeDefined();
    });

    it('handles stream write error', async () => {
      const controller = createController({
        streaming: {
          writeOpenAIChatSse: vi.fn(async () => {
            throw new Error('write failed');
          })
        }
      });
      const mockResponse = { setHeader: vi.fn(), write: vi.fn(), end: vi.fn() };
      await expect(
        controller.chatCompletions(
          'Bearer key',
          { model: 'gpt-4', messages: [{ role: 'user', content: 'Hello' }], stream: true },
          mockResponse
        )
      ).rejects.toThrow();
    });

    it('handles stream toSse error', async () => {
      const controller = createController({
        streaming: {
          toOpenAIChatSse: vi.fn(async () => {
            throw new Error('sse failed');
          })
        }
      });
      await expect(
        controller.chatCompletions('Bearer key', {
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
          stream: true
        })
      ).rejects.toThrow();
    });
  });

  describe('chatCompletions - invoke error handling', () => {
    it('wraps non-HttpException errors', async () => {
      const controller = createController({
        runtimeEngine: {
          listModels: vi.fn(() => ({ data: [] })),
          invoke: vi.fn(async () => {
            throw new Error('provider error');
          }),
          stream: vi.fn(async function* () {})
        }
      });
      await expect(
        controller.chatCompletions('Bearer key', {
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
          stream: false
        })
      ).rejects.toThrow(HttpException);
    });

    it('wraps HttpException without OpenAI error format', async () => {
      const controller = createController({
        runtimeEngine: {
          listModels: vi.fn(() => ({ data: [] })),
          invoke: vi.fn(async () => {
            throw new HttpException({ code: 'rate_limited', message: 'Too many requests' }, 429);
          }),
          stream: vi.fn(async function* () {})
        }
      });
      await expect(
        controller.chatCompletions('Bearer key', {
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
          stream: false
        })
      ).rejects.toThrow(HttpException);
    });

    it('passes through HttpException with OpenAI error format', async () => {
      const controller = createController({
        runtimeEngine: {
          listModels: vi.fn(() => ({ data: [] })),
          invoke: vi.fn(async () => {
            throw new HttpException(
              { error: { code: 'invalid_request', type: 'invalid_request_error', message: 'Bad request' } },
              400
            );
          }),
          stream: vi.fn(async function* () {})
        }
      });
      await expect(
        controller.chatCompletions('Bearer key', {
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
          stream: false
        })
      ).rejects.toThrow(HttpException);
    });

    it('handles HttpException with 500 status', async () => {
      const controller = createController({
        runtimeEngine: {
          listModels: vi.fn(() => ({ data: [] })),
          invoke: vi.fn(async () => {
            throw new HttpException('Internal error', 500);
          }),
          stream: vi.fn(async function* () {})
        }
      });
      await expect(
        controller.chatCompletions('Bearer key', {
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
          stream: false
        })
      ).rejects.toThrow(HttpException);
    });

    it('handles HttpException with string response', async () => {
      const controller = createController({
        runtimeEngine: {
          listModels: vi.fn(() => ({ data: [] })),
          invoke: vi.fn(async () => {
            throw new HttpException('plain text error', 400);
          }),
          stream: vi.fn(async function* () {})
        }
      });
      await expect(
        controller.chatCompletions('Bearer key', {
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
          stream: false
        })
      ).rejects.toThrow(HttpException);
    });
  });
});
