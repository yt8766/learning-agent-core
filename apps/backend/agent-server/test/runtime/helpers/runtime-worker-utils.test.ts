import { describe, expect, it } from 'vitest';

import {
  inferCapabilityCategory,
  inferCapabilityRequiresApproval,
  inferCapabilityRiskLevel,
  resolveInstalledSkillMinistry,
  resolveInstalledSkillModel,
  toCapabilityDisplayName
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
});
