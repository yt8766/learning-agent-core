import { describe, expect, it } from 'vitest';

import { appendDataReportContext, buildDataReportContract } from '../src';

describe('shared data-report contract helpers', () => {
  it('builds a bonus-center contract and appends it into task context', () => {
    const contract = buildDataReportContract('生成一个 bonus center data 数据报表页面', '先搭一个可扩展的容器');

    expect(contract.templateRef).toBe('bonusCenterData');
    expect(contract.scope).toBe('shell-first');
    expect(contract.contextBlock).toContain('数据报表任务契约');
    expect(appendDataReportContext('已有上下文', contract)).toContain('已有上下文');
    expect(appendDataReportContext('已有上下文', contract)).toContain('bonusCenterData');
  });
});
