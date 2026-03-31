import { describe, expect, it } from 'vitest';

import {
  sanitizeTaskContextForModel,
  stripOperationalBoilerplate
} from '../../../src/shared/prompts/runtime-output-sanitizer';

describe('runtime-output-sanitizer', () => {
  it('removes operational battle reports from final user-facing content', () => {
    const result = stripOperationalBoilerplate(`
首辅已在本地技能库中命中 5 个可复用候选。
当前由增长投放专家主导，并发征询 直播互动专家、技术架构专家。
户部已开始检索资料与上下文。
户部战报：当前最值得复用的是上一轮的增长诊断。
兵部已接到任务，正在执行方案。

真正应该显示给用户的答复。
    `);

    expect(result).toBe('真正应该显示给用户的答复。');
  });

  it('sanitizes task context before it is sent back into the model', () => {
    const result = sanitizeTaskContextForModel(`
已分派给 research：收集与目标相关的上下文、文档与规范：/browse 你感觉前一个大模型返回的结果“不专业”。
首辅先从历史经验中命中了 4 条记忆和 0 条规则，本轮会优先基于这些经验继续规划。
当前由增长投放专家主导，并发征询 直播互动专家、技术架构专家。

用户真正的问题是：你感觉前一个大模型返回的结果“不专业”，还有什么专业建议？
    `);

    expect(result).toContain('用户真正的问题是：你感觉前一个大模型返回的结果“不专业”，还有什么专业建议？');
    expect(result).not.toContain('已分派给 research');
    expect(result).not.toContain('/browse');
    expect(result).not.toContain('首辅先从历史经验中命中了');
  });
});
