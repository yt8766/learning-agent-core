import { describe, expect, it } from 'vitest';

import { loadSettings, type RoutingPolicyRecord } from '@agent/config';
import { ModelRoutingPolicy } from '../src/governance/model-routing-policy';
import { WorkerRegistry } from '../src/governance/worker-registry';

describe('model-routing-policy', () => {
  it('prefers an explicitly requested model over ministry defaults', () => {
    const policy = new ModelRoutingPolicy(new WorkerRegistry());

    const route = policy.resolveRoute('gongbu-code', '实现一个按钮组件', undefined, 'minimax/MiniMax-M2.7');

    expect(route).toEqual(
      expect.objectContaining({
        ministry: 'gongbu-code',
        selectedModel: 'minimax/MiniMax-M2.7',
        reason: '按用户显式指定覆盖为 minimax/MiniMax-M2.7'
      })
    );
  });

  it('uses active role routing models ahead of static worker defaults', () => {
    const routing: Partial<Record<'manager' | 'research' | 'executor' | 'reviewer', RoutingPolicyRecord>> = {
      manager: { primary: 'minimax/MiniMax-M2.7' },
      research: { primary: 'minimax/MiniMax-M2.5' },
      executor: { primary: 'minimax/MiniMax-M2.1' },
      reviewer: { primary: 'minimax/MiniMax-M2' }
    };
    const policy = new ModelRoutingPolicy(new WorkerRegistry(), routing);

    expect(policy.resolveRoute('libu-governance', '规划任务')?.selectedModel).toBe('minimax/MiniMax-M2.7');
    expect(policy.resolveRoute('hubu-search', '检索资料')?.selectedModel).toBe('minimax/MiniMax-M2.5');
    expect(policy.resolveRoute('gongbu-code', '实现功能')?.selectedModel).toBe('minimax/MiniMax-M2.1');
    expect(policy.resolveRoute('xingbu-review', '审查结果')?.selectedModel).toBe('minimax/MiniMax-M2');
  });

  it('honors ACTIVE_MODEL_PROVIDER=minimax through runtime settings routing', () => {
    const settings = loadSettings({
      workspaceRoot: process.cwd(),
      env: {
        ZHIPU_API_KEY: 'zhipu-key',
        MINIMAX_API_KEY: 'minimax-key',
        ACTIVE_MODEL_PROVIDER: 'minimax',
        MINIMAX_EXECUTOR_MODEL: 'MiniMax-M2.1'
      } as unknown as NodeJS.ProcessEnv
    });
    const policy = new ModelRoutingPolicy(new WorkerRegistry(), settings.routing);

    expect(policy.resolveRoute('gongbu-code', '实现整个功能')?.selectedModel).toBe('minimax/MiniMax-M2.1');
  });
});
