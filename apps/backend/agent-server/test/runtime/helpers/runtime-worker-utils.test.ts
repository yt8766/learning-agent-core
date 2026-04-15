import { describe, expect, it } from 'vitest';

import {
  inferCapabilityCategory,
  inferCapabilityRequiresApproval,
  inferCapabilityRiskLevel,
  resolveInstalledSkillMinistry,
  resolveInstalledSkillModel,
  toCapabilityDisplayName,
  toMinistryDisplayName
} from '../../../src/runtime/helpers/runtime-worker-utils';

describe('runtime-worker-utils', () => {
  it('会格式化 capability 名称和风险等级', () => {
    expect(toCapabilityDisplayName('github.search_repos')).toBe('Github Search Repos');
    expect(inferCapabilityRiskLevel('browser.open_page')).toBe('high');
    expect(inferCapabilityRequiresApproval('browser.capture_screenshot')).toBe(true);
    expect(inferCapabilityCategory('github.create_issue_comment')).toBe('action');
  });

  it('会为 installed skill 推断 ministry 和 model', () => {
    const skill = {
      requiredCapabilities: ['browser.capture_screenshot'],
      requiredTools: []
    } as any;

    expect(resolveInstalledSkillMinistry(skill)).toBe('bingbu-ops');
    expect(
      resolveInstalledSkillModel(
        {
          research: 'research-model',
          reviewer: 'review-model',
          executor: 'exec-model',
          manager: 'manager-model'
        },
        skill
      )
    ).toBe('exec-model');
  });

  it('文档与交付类 installed skill 会收敛到礼部新域', () => {
    const skill = {
      requiredCapabilities: ['documentation.generate_openapi'],
      requiredTools: []
    } as any;

    expect(resolveInstalledSkillMinistry(skill)).toBe('libu-delivery');
  });

  it('会覆盖 review code search 和默认 ministry 分支', () => {
    const models = {
      research: 'research-model',
      reviewer: 'review-model',
      executor: 'exec-model',
      manager: 'manager-model'
    };

    expect(resolveInstalledSkillMinistry({ requiredCapabilities: ['security.review'], requiredTools: [] } as any)).toBe(
      'xingbu-review'
    );
    expect(resolveInstalledSkillMinistry({ requiredCapabilities: ['code.refactor'], requiredTools: [] } as any)).toBe(
      'gongbu-code'
    );
    expect(
      resolveInstalledSkillMinistry({ requiredCapabilities: ['knowledge.search'], requiredTools: [] } as any)
    ).toBe('hubu-search');
    expect(resolveInstalledSkillMinistry({ requiredCapabilities: [], requiredTools: [] } as any)).toBe('libu-delivery');

    expect(
      resolveInstalledSkillModel(models, { requiredCapabilities: ['security.review'], requiredTools: [] } as any)
    ).toBe('review-model');
    expect(
      resolveInstalledSkillModel(models, { requiredCapabilities: ['code.refactor'], requiredTools: [] } as any)
    ).toBe('exec-model');
    expect(
      resolveInstalledSkillModel(models, { requiredCapabilities: ['knowledge.search'], requiredTools: [] } as any)
    ).toBe('research-model');
    expect(resolveInstalledSkillModel(models, { requiredCapabilities: [], requiredTools: [] } as any)).toBe(
      'manager-model'
    );
  });

  it('会回退 capability 分类和 ministry 展示名称', () => {
    expect(inferCapabilityRiskLevel('memory.lookup')).toBe('low');
    expect(inferCapabilityRequiresApproval('memory.lookup')).toBe(false);
    expect(inferCapabilityCategory('memory.lookup')).toBe('knowledge');
    expect(toMinistryDisplayName('hubu-search')).toContain('户部');
    expect(toMinistryDisplayName('custom-ministry')).toBe('custom-ministry');
    expect(toMinistryDisplayName()).toBe('未知部');
  });
});
