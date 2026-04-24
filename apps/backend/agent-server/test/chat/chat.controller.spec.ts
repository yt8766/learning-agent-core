import { describe, expect, it, vi } from 'vitest';

import { ChatController } from '../../src/chat/chat.controller';
import { createChatService, createRequest, createResponse, createSseResponse } from './chat.controller.test-helpers';

describe('ChatController', () => {
  it('delegates query endpoints to ChatService', () => {
    const chatService = createChatService();
    const controller = new ChatController(chatService as never);
    const request = createRequest();
    const response = createResponse();

    expect(controller.listSessions()).toEqual(['session-1']);
    expect(controller.listAvailableModels()).toEqual([
      { id: 'minimax/MiniMax-M2.7', displayName: 'MiniMax-M2.7', providerId: 'minimax' }
    ]);
    expect(controller.getSession('session-1', response as never)).toEqual({ id: 'session-1' });
    expect(controller.listMessages(request as never, response as never, 'session-1')).toEqual([
      { sessionId: 'session-1', role: 'user', content: 'hello' }
    ]);
    expect(controller.listEvents(request as never, response as never, 'session-1')).toEqual([
      { sessionId: 'session-1', type: 'session_started' }
    ]);
    expect(controller.getCheckpoint(request as never, response as never, 'session-1')).toEqual({
      sessionId: 'session-1',
      taskId: 'task-1'
    });
  });

  it('prefers explicit sessionId in action endpoints and writes the cookie', () => {
    const chatService = createChatService();
    const controller = new ChatController(chatService as never);
    const request = createRequest();
    const response = createResponse();

    controller.approve(request as never, response as never, {
      actor: 'tester',
      intent: 'write_file',
      sessionId: 'session-1'
    });
    controller.reject(request as never, response as never, {
      actor: 'tester',
      intent: 'write_file',
      sessionId: 'session-1'
    });
    controller.confirmLearning(request as never, response as never, {
      actor: 'tester',
      candidateIds: ['candidate-1'],
      sessionId: 'session-1'
    });
    controller.appendMessage(request as never, response as never, {
      sessionId: 'session-1',
      message: '继续执行',
      modelId: 'minimax/MiniMax-M2.7'
    });
    controller.createSession({ title: '新会话' }, response as never);
    controller.recover(request as never, response as never, { sessionId: 'session-1' });

    expect(chatService.approve).toHaveBeenCalledWith('session-1', {
      actor: 'tester',
      intent: 'write_file',
      sessionId: 'session-1'
    });
    expect(chatService.reject).toHaveBeenCalledWith('session-1', {
      actor: 'tester',
      intent: 'write_file',
      sessionId: 'session-1'
    });
    expect(chatService.confirmLearning).toHaveBeenCalledWith('session-1', {
      actor: 'tester',
      candidateIds: ['candidate-1'],
      sessionId: 'session-1'
    });
    expect(chatService.appendMessage).toHaveBeenCalledWith('session-1', {
      message: '继续执行',
      modelId: 'minimax/MiniMax-M2.7'
    });
    expect(chatService.recover).toHaveBeenCalledWith('session-1');
    expect(response.cookie).toHaveBeenCalled();
  });

  it('replays historical non-token events and keeps realtime assistant_token events', () => {
    const unsubscribe = vi.fn();
    const chatService = createChatService();
    const controller = new ChatController(chatService as never);
    let pushedListener: ((event: unknown) => void) | undefined;
    const response = createSseResponse();
    const request = {
      headers: {},
      on: vi.fn()
    };

    chatService.listEvents.mockReturnValue([
      { sessionId: 'session-1', type: 'session_started' },
      {
        sessionId: 'session-1',
        type: 'assistant_token',
        payload: { messageId: 'msg-1', content: '你' }
      }
    ]);
    chatService.subscribe.mockImplementation((_id, next) => {
      pushedListener = next;
      return unsubscribe;
    });

    controller.stream(request as never, response as never, 'session-1');

    expect(response.write).toHaveBeenCalledWith(': stream-open\n\n');
    expect(response.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify({ sessionId: 'session-1', type: 'session_started' })}\n\n`
    );
    expect(response.write).not.toHaveBeenCalledWith(
      `data: ${JSON.stringify({
        sessionId: 'session-1',
        type: 'assistant_token',
        payload: { messageId: 'msg-1', content: '你' }
      })}\n\n`
    );

    pushedListener?.({
      sessionId: 'session-1',
      type: 'assistant_token',
      payload: { messageId: 'msg-1', content: '好' }
    });

    expect(response.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify({
        sessionId: 'session-1',
        type: 'assistant_token',
        payload: { messageId: 'msg-1', content: '好' }
      })}\n\n`
    );

    const closeHandler = request.on.mock.calls.find(call => call[0] === 'close')?.[1];
    closeHandler?.();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(response.end).toHaveBeenCalledTimes(1);
  });

  it('streams direct llm responses over POST /chat SSE', async () => {
    const chatService = createChatService();
    const controller = new ChatController(chatService as never);
    const response = createSseResponse();

    await controller.streamDirectChat(
      {
        message: '你好',
        systemPrompt: '你是一个助手'
      } as never,
      response as never
    );

    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(response.write).toHaveBeenCalledWith(': keep-alive\n\n');
    expect(response.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify({ type: 'token', data: { content: '你' } })}\n\n`
    );
    expect(response.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify({ type: 'token', data: { content: '好' } })}\n\n`
    );
    expect(response.write).toHaveBeenCalledWith(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    expect(response.end).toHaveBeenCalledTimes(1);
  });

  it('streams stage events and final sandpack files for data-report preview requests', async () => {
    const chatService = createChatService();
    chatService.resolveDirectResponseMode.mockReturnValue('preview');
    const controller = new ChatController(chatService as never);
    const response = createSseResponse();

    await controller.streamDirectChat(
      {
        message: '参考 bonusCenterData 生成多个数据报表页面'
      } as never,
      response as never
    );

    expect(chatService.resolveDirectResponseMode).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '参考 bonusCenterData 生成多个数据报表页面'
      })
    );
    expect(chatService.streamSandpackPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '参考 bonusCenterData 生成多个数据报表页面'
      }),
      expect.any(Function)
    );
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(response.write).toHaveBeenCalledWith(': keep-alive\n\n');
    expect(response.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify({ type: 'stage', data: { stage: 'analysis', progressPercent: 5, status: 'pending' } })}\n\n`
    );
    expect(response.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify({
        type: 'files',
        data: {
          files: {
            '/App.tsx': 'export default function App() { return null; }',
            '/routes.ts': 'export const reportRoutes = [];',
            '/index.tsx': 'export default function Preview() { return null; }'
          }
        }
      })}\n\n`
    );
    expect(response.write).toHaveBeenCalledWith(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    expect(response.end).toHaveBeenCalledTimes(1);
  });

  it('accepts duyi-figma-make style request fields and preserves SSE envelope shape', async () => {
    const chatService = createChatService();
    const controller = new ChatController(chatService as never);
    const response = createSseResponse();

    await controller.streamDirectChat(
      {
        messages: [{ role: 'user', content: '继续' }],
        projectId: 'project-1',
        mockConfig: { preset: 'default' }
      } as never,
      response as never
    );

    expect(chatService.streamChat).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: '继续' }],
        projectId: 'project-1',
        mockConfig: { preset: 'default' }
      }),
      expect.any(Function)
    );
    expect(response.write).toHaveBeenCalledWith(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  });

  it('streams structured report-schema events and includes the final status payload', async () => {
    const chatService = createChatService();
    chatService.resolveDirectResponseMode.mockReturnValue('report-schema');
    const controller = new ChatController(chatService as never);
    const response = createSseResponse();

    await controller.streamDirectChat(
      {
        message: '生成 Bonus Center 报表 JSON',
        responseFormat: 'report-schema'
      } as never,
      response as never
    );

    expect(chatService.streamReportSchema).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '生成 Bonus Center 报表 JSON',
        responseFormat: 'report-schema'
      }),
      expect.any(Function)
    );
    expect(response.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify({
        type: 'schema_failed',
        data: {
          error: {
            errorCode: 'report_schema_generation_failed',
            errorMessage: 'provider exploded',
            retryable: true
          },
          runtime: {
            executionPath: 'partial-llm',
            cacheHit: false,
            nodeDurations: {
              sectionSchemaNode: 12
            }
          }
        }
      })}\n\n`
    );
    expect(response.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify({
        type: 'done',
        data: {
          content: '{"status":"failed"}',
          status: 'failed',
          bundle: {
            version: 'report-bundle.v1',
            kind: 'report-bundle',
            meta: {
              bundleId: 'bundle-1',
              title: 'Bonus Center',
              mode: 'single-document'
            },
            documents: []
          },
          runtime: {
            executionPath: 'partial-llm',
            cacheHit: false,
            nodeDurations: {
              sectionSchemaNode: 12
            }
          }
        }
      })}\n\n`
    );
  });
});
