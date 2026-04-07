import { describe, expect, it } from 'vitest';

import {
  SUPERVISOR_DIRECT_REPLY_PROMPT,
  buildSupervisorDirectReplyUserPrompt
} from '../../../../src/flows/supervisor/prompts/supervisor-plan-prompts';

describe('supervisor direct reply prompts', () => {
  it('encourages conversational answers instead of workflow-style summaries', () => {
    expect(SUPERVISOR_DIRECT_REPLY_PROMPT).toContain('优先像成熟聊天助手一样自然回答');
    expect(SUPERVISOR_DIRECT_REPLY_PROMPT).toContain('不要把回答写成任务汇报、流程汇报或公文式总结');
    expect(SUPERVISOR_DIRECT_REPLY_PROMPT).toContain('只做简短总结或回顾');
    expect(SUPERVISOR_DIRECT_REPLY_PROMPT).toContain('默认使用短段落');
  });

  it('keeps temporal context and goal in the user prompt', () => {
    const prompt = buildSupervisorDirectReplyUserPrompt('上面的还有什么优化的地方');

    expect(prompt).toContain('当前绝对日期：');
    expect(prompt).toContain('目标：上面的还有什么优化的地方');
  });

  it('adds recap guidance for conversation recall prompts', () => {
    const prompt = buildSupervisorDirectReplyUserPrompt('我们刚刚聊了什么？');

    expect(prompt).toContain('当前问题属于会话回顾类追问');
    expect(prompt).toContain('不要复读上一轮完整答案');
    expect(prompt).toContain('目标：我们刚刚聊了什么？');
  });
});
