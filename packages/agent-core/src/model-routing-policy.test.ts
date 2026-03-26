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

  it('已安装技能 worker 在目标匹配时会优先路由', () => {
    const registry = new WorkerRegistry();
    registry.register({
      id: 'installed-skill:release_check',
      ministry: 'bingbu-ops',
      kind: 'installed-skill',
      displayName: 'Release Check 已安装技能',
      defaultModel: 'glm-4.6',
      supportedCapabilities: ['release-ops', 'terminal'],
      reviewPolicy: 'self-check',
      tags: ['release', 'check'],
      preferredContexts: ['发布前检查', 'release check']
    });

    const policy = new ModelRoutingPolicy(registry);
    const route = policy.resolveRoute('bingbu-ops', '请执行发布前检查并准备 ship');

    expect(route).toEqual(
      expect.objectContaining({
        ministry: 'bingbu-ops',
        workerId: 'installed-skill:release_check'
      })
    );
  });

  it('personal profile 不会命中 company worker', () => {
    const policy = new ModelRoutingPolicy(new WorkerRegistry());
    const route = policy.resolveRoute('hubu-search', '请查询飞书知识库里的发布规范', {
      profile: 'personal'
    });

    expect(route).toEqual(
      expect.objectContaining({
        ministry: 'hubu-search',
        workerId: 'hubu-search-core'
      })
    );
  });

  it('profile 不兼容的 connector 依赖会阻止 worker 被命中', () => {
    const registry = new WorkerRegistry();
    registry.register({
      id: 'installed-skill:repo_refactor',
      ministry: 'gongbu-code',
      kind: 'installed-skill',
      displayName: 'Repo Refactor',
      defaultModel: 'glm-4.6',
      supportedCapabilities: ['code-generation', 'refactor'],
      reviewPolicy: 'self-check',
      tags: ['repo', 'refactor'],
      requiredConnectors: ['repo']
    });

    const policy = new ModelRoutingPolicy(registry);
    const route = policy.resolveRoute('gongbu-code', '请帮我做 repo refactor', {
      profile: 'personal'
    });

    expect(route).toEqual(
      expect.objectContaining({
        ministry: 'gongbu-code',
        workerId: 'gongbu-code-core'
      })
    );
  });
});
