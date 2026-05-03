import { describe, expect, it, vi } from 'vitest';

import { KnowledgeFrontendMvpController, toSseFrame } from '../../src/knowledge/knowledge-frontend-mvp.controller';
import type { KnowledgeDocumentService } from '../../src/knowledge/knowledge-document.service';

const actor = { userId: 'user_1', username: 'dev', roles: ['user'] };

describe('knowledge chat SSE stream', () => {
  it('serializes SDK stream events as named SSE frames', () => {
    expect(toSseFrame({ type: 'answer.delta', runId: 'run_1', delta: 'hello' })).toBe(
      'event: answer.delta\ndata: {"type":"answer.delta","runId":"run_1","delta":"hello"}\n\n'
    );
  });

  it('writes stream chat events to the HTTP response and ends the stream', async () => {
    async function* streamChat() {
      yield { type: 'rag.started', runId: 'run_1' };
      yield { type: 'answer.delta', runId: 'run_1', delta: 'hello' };
      yield {
        type: 'answer.completed',
        runId: 'run_1',
        answer: { text: 'hello', noAnswer: false, citations: [] }
      };
      yield {
        type: 'rag.completed',
        runId: 'run_1',
        result: {
          runId: 'run_1',
          plan: {},
          retrieval: {},
          answer: { text: 'hello', noAnswer: false, citations: [] },
          diagnostics: {}
        }
      };
    }

    const documents = {
      streamChat: vi.fn(streamChat)
    } as unknown as KnowledgeDocumentService;
    const controller = new KnowledgeFrontendMvpController(documents);
    const response = {
      setHeader: vi.fn(),
      write: vi.fn(),
      end: vi.fn()
    };

    await controller.chat(
      actor,
      {
        message: 'stream please',
        stream: true
      },
      response
    );

    expect(documents.streamChat).toHaveBeenCalledWith(actor, {
      message: 'stream please',
      stream: true
    });
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream; charset=utf-8');
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache, no-transform');
    expect(response.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
    expect(response.write).toHaveBeenCalledWith('event: rag.started\ndata: {"type":"rag.started","runId":"run_1"}\n\n');
    expect(response.write).toHaveBeenCalledWith(
      'event: answer.delta\ndata: {"type":"answer.delta","runId":"run_1","delta":"hello"}\n\n'
    );
    expect(response.end).toHaveBeenCalledOnce();
  });

  it('writes non-stream chat responses as JSON when the route owns the response', async () => {
    const chatResponse = {
      conversationId: 'conv_1',
      userMessage: { id: 'msg_user', conversationId: 'conv_1', role: 'user', content: 'hello', createdAt: 'now' },
      assistantMessage: {
        id: 'msg_assistant',
        conversationId: 'conv_1',
        role: 'assistant',
        content: 'answer',
        createdAt: 'now'
      },
      answer: 'answer',
      citations: [],
      traceId: 'trace_1'
    };
    const documents = {
      chat: vi.fn(async () => chatResponse)
    } as unknown as KnowledgeDocumentService;
    const controller = new KnowledgeFrontendMvpController(documents);
    const response = {
      setHeader: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      json: vi.fn()
    };

    await expect(
      controller.chat(
        actor,
        {
          message: 'hello',
          stream: false
        },
        response
      )
    ).resolves.toBeUndefined();

    expect(documents.chat).toHaveBeenCalledWith(actor, {
      message: 'hello',
      stream: false
    });
    expect(response.json).toHaveBeenCalledWith(chatResponse);
    expect(response.write).not.toHaveBeenCalled();
    expect(response.end).not.toHaveBeenCalled();
  });
});
