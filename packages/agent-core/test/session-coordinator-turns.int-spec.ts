import { describe, expect, it } from 'vitest';

import { SessionCoordinator } from '../src/session/session-coordinator';
import {
  createLlmProvider,
  createOrchestrator,
  createRuntimeRepository,
  flushAsyncWork
} from './session-coordinator.test.utils';

describe('SessionCoordinator multi-turn integration', () => {
  it('passes recent turns and the latest question together into the orchestrator on follow-up turns', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({
      title: '多轮追问',
      message: '先分析 VIP 承接问题'
    });
    await flushAsyncWork();

    await coordinator.appendMessage(session.id, {
      message: '再看看支付和 ROI 的优化空间'
    });
    await flushAsyncWork();

    expect(orchestrator.createTask).toHaveBeenCalledTimes(2);

    const secondTurn = (orchestrator.createTask as any).mock.calls[1][0];

    expect(secondTurn.goal).toBe('再看看支付和 ROI 的优化空间');
    expect(secondTurn.sessionId).toBe(session.id);
    expect(secondTurn.recentTurns).toEqual([
      { role: 'user', content: '先分析 VIP 承接问题' },
      { role: 'assistant', content: 'Execution completed successfully.' },
      { role: 'user', content: '再看看支付和 ROI 的优化空间' }
    ]);
    expect(secondTurn.context).toContain('user: 先分析 VIP 承接问题');
    expect(secondTurn.context).toContain('assistant: Execution completed successfully.');
    expect(secondTurn.context).toContain('当前用户最新问题：\n再看看支付和 ROI 的优化空间');
  });
});
