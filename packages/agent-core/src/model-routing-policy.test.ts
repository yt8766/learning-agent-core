import { describe, expect, it } from 'vitest';

import { ModelRoutingPolicy } from './governance/model-routing-policy';
import { WorkerRegistry } from './governance/worker-registry';

describe('model-routing-policy', () => {
  it('兵部在发布类任务上可以覆盖默认模型', () => {
    const policy = new ModelRoutingPolicy(new WorkerRegistry());
    const route = policy.resolveRoute('bingbu-ops', '请帮我执行发布前检查并 deploy');

    expect(route).toEqual(
      expect.objectContaining({
        ministry: 'bingbu-ops',
        selectedModel: 'glm-5'
      })
    );
  });
});
