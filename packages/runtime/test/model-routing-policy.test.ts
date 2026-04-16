import { describe, expect, it } from 'vitest';

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
});
