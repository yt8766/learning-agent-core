import { describe, expect, it, vi } from 'vitest';

import type { LlmProvider } from '@agent/adapters';

import { ChatService } from '../../src/chat/chat.service';
import {
  createCapabilityIntentService,
  createRuntimeHost,
  createRuntimeSessionService
} from './chat.service.test-helpers';

describe('ChatService', () => {
  it('将查询类方法委托给 RuntimeSessionService', () => {
    const runtimeSessionService = createRuntimeSessionService();
    const capabilityIntentsService = createCapabilityIntentService();
    const service = new ChatService(runtimeSessionService, capabilityIntentsService);

    expect(service.listSessions()).toEqual(['session-1']);
    expect(service.getSession('session-1')).toEqual({ id: 'session-1' });
    expect(service.listMessages('session-1')).toEqual([{ sessionId: 'session-1', role: 'user', content: 'hello' }]);
    expect(service.listEvents('session-1')).toEqual([{ sessionId: 'session-1', type: 'user_message' }]);
    expect(service.getCheckpoint('session-1')).toEqual({ sessionId: 'session-1', taskId: 'task-1' });
  });

  it('将写操作方法委托给 RuntimeSessionService', () => {
    const runtimeSessionService = createRuntimeSessionService();
    const capabilityIntentsService = createCapabilityIntentService();
    const service = new ChatService(runtimeSessionService, capabilityIntentsService);

    expect(service.createSession({ title: '测试会话' })).toEqual({ id: 'session-1', title: '测试会话' });
    return service.appendMessage('session-1', { message: '继续' }).then(result => {
      expect(result).toEqual({ sessionId: 'session-1', message: '继续' });
      expect(runtimeSessionService.appendSessionMessage).toHaveBeenCalledWith('session-1', { message: '继续' });
    });
  });

  it('命中 capability intent 时优先返回内联响应', async () => {
    const runtimeSessionService = createRuntimeSessionService();
    const capabilityIntentsService = createCapabilityIntentService();
    const service = new ChatService(runtimeSessionService, capabilityIntentsService);
    (capabilityIntentsService.tryHandle as never as ReturnType<typeof vi.fn>).mockResolvedValue({
      sessionId: 'session-1',
      role: 'assistant',
      content: '已创建 skill'
    });

    await expect(service.appendMessage('session-1', { message: '帮我创建一个 skill' })).resolves.toEqual({
      sessionId: 'session-1',
      role: 'assistant',
      content: '已创建 skill'
    });
    expect(runtimeSessionService.appendSessionMessage).not.toHaveBeenCalled();
  });

  it('继续校验其他写操作委托', () => {
    const runtimeSessionService = createRuntimeSessionService();
    const capabilityIntentsService = createCapabilityIntentService();
    const service = new ChatService(runtimeSessionService, capabilityIntentsService);

    expect(service.approve('session-1', { actor: 'tester', approvalId: 'approval-1', sessionId: 'session-1' })).toEqual(
      { sessionId: 'session-1', action: 'approve', actor: 'tester', approvalId: 'approval-1' }
    );
    expect(service.reject('session-1', { actor: 'tester', approvalId: 'approval-1', sessionId: 'session-1' })).toEqual({
      sessionId: 'session-1',
      action: 'reject',
      actor: 'tester',
      approvalId: 'approval-1'
    });
    expect(
      service.confirmLearning('session-1', { actor: 'tester', candidateIds: ['memory-1'], sessionId: 'session-1' })
    ).toEqual({ sessionId: 'session-1', actor: 'tester', candidateIds: ['memory-1'] });
    expect(service.recover('session-1')).toEqual({ sessionId: 'session-1', recovered: true });
    expect(service.recoverToCheckpoint({ sessionId: 'session-1', reason: 'test' })).toEqual({
      id: 'session-1',
      recovered: true
    });
    expect(service.cancel('session-1', { actor: 'tester', reason: 'stop' })).toEqual({
      sessionId: 'session-1',
      cancelled: true,
      actor: 'tester',
      reason: 'stop'
    });
  });

  it('暴露订阅能力给 SSE 使用', () => {
    const unsubscribe = vi.fn();
    const runtimeSessionService = createRuntimeSessionService();
    runtimeSessionService.subscribeSession = vi.fn(() => unsubscribe) as never;
    const capabilityIntentsService = createCapabilityIntentService();
    const service = new ChatService(runtimeSessionService, capabilityIntentsService);

    expect(service.subscribe('session-1', vi.fn())).toBe(unsubscribe);
  });

  it('streams direct model output for the SSE chat endpoint', async () => {
    const service = new ChatService(
      createRuntimeSessionService(),
      createCapabilityIntentService(),
      createRuntimeHost()
    );
    const runtimeHost = createRuntimeHost();
    const push = vi.fn();
    const chatService = new ChatService(createRuntimeSessionService(), createCapabilityIntentService(), runtimeHost);

    const result = await chatService.streamChat({ message: '你好', systemPrompt: '你是一个助手' }, push);

    expect(push).toHaveBeenNthCalledWith(1, { type: 'token', data: { content: '你' } });
    expect(push).toHaveBeenNthCalledWith(2, { type: 'token', data: { content: '好' } });
    expect(result).toEqual({ content: '你好' });
    expect((runtimeHost.llmProvider as unknown as LlmProvider).streamText).toHaveBeenCalled();
    expect(service).toBeDefined();
  });

  it('retries direct model output when the first attempt fails with a retryable format error', async () => {
    const runtimeHost = createRuntimeHost();
    const streamText = vi
      .fn()
      .mockRejectedValueOnce(new Error('invalid json shape'))
      .mockImplementationOnce(async (_messages, _options, onToken) => {
        onToken('修');
        onToken('复');
        return '修复';
      });

    runtimeHost.llmProvider = { isConfigured: vi.fn(() => true), streamText } as unknown as LlmProvider;
    const service = new ChatService(createRuntimeSessionService(), createCapabilityIntentService(), runtimeHost);

    await expect(service.streamChat({ message: '你好' }, vi.fn())).resolves.toEqual({ content: '修复' });
    expect(streamText).toHaveBeenCalledTimes(2);
  });

  it('detects data-report direct requests and resolves explicit direct response modes', async () => {
    const service = new ChatService(
      createRuntimeSessionService(),
      createCapabilityIntentService(),
      createRuntimeHost()
    );

    expect(service.resolveDirectResponseMode({ message: '参考 bonusCenterData 生成多个数据报表页面' })).toBe(
      'sandpack'
    );
    expect(service.resolveDirectResponseMode({ message: '生成一个后台页面', responseFormat: 'sandpack' })).toBe(
      'sandpack'
    );
    expect(service.resolveDirectResponseMode({ message: '生成一个后台页面', responseFormat: 'preview' })).toBe(
      'preview'
    );
    expect(
      service.resolveDirectResponseMode({ message: '生成 Bonus Center 报表 JSON', responseFormat: 'report-schema' })
    ).toBe('report-schema');
  });

  it('can still return explicit sandpack preview files without calling the LLM', async () => {
    const runtimeHost = createRuntimeHost();
    const service = new ChatService(createRuntimeSessionService(), createCapabilityIntentService(), runtimeHost);

    const sandpackFiles = await service.generateSandpackPreview({
      message: '参考 bonusCenterData 生成多个数据报表页面',
      responseFormat: 'preview'
    });

    expect(sandpackFiles).toHaveProperty('/App.tsx');
    expect(sandpackFiles).toHaveProperty('/src/pages/dataDashboard/bonusCenterData/index.tsx');
    expect((runtimeHost.llmProvider as unknown as LlmProvider).streamText).not.toHaveBeenCalled();
  });
});
