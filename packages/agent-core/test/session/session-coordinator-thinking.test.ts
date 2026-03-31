import { describe, expect, it } from 'vitest';

import { SessionCoordinatorThinking } from '../../src/session/session-coordinator-thinking';
import { buildPlanningReadonlyTask, buildWaitingApprovalTask } from '../fixtures/task-fixtures';

// Fixtures intentionally keep a legacy alias input so think-state output can prove canonical plan-mode copy.
describe('SessionCoordinatorThinking interrupt vocabulary', () => {
  it('uses interrupt-first copy in think state and thought chain for approval gate', () => {
    const thinking = new SessionCoordinatorThinking({} as never, undefined, undefined);
    const task = buildWaitingApprovalTask() as any;

    const thinkState = thinking.buildThinkState(task, 'msg-1');
    const thoughtChain = thinking.buildThoughtChain(task, 'msg-1');

    expect(thinkState?.title).toBe('等待阻塞式中断确认');
    expect(thinkState?.content).toContain('阻塞式中断确认点');
    expect(thoughtChain[0]).toEqual(
      expect.objectContaining({
        title: '阻塞式中断确认',
        description: '系统已暂停在阻塞式中断确认点，等待你拍板。'
      })
    );
    expect(thoughtChain[0]?.content).toContain('中断视角');
  });

  it('surfaces planning-readonly guardrails in think state', () => {
    // Legacy alias input still maps to canonical executionPlan.mode = plan copy in the rendered think state.
    const thinking = new SessionCoordinatorThinking({} as never, undefined, undefined);
    const task = buildPlanningReadonlyTask() as any;

    const thinkState = thinking.buildThinkState(task, 'msg-2');
    const thoughtChain = thinking.buildThoughtChain(task, 'msg-2');

    expect(thinkState?.content).toContain('计划只读阶段');
    expect(thinkState?.content).toContain('open-web');
    expect(thoughtChain[0]).toEqual(
      expect.objectContaining({
        title: '计划只读保护',
        description: '计划只读保护已启用，当前主动跳过高成本或有副作用的研究路径。'
      })
    );
  });
});
