import { describe, expect, it } from 'vitest';

import { SUPERVISOR_DIRECT_REPLY_PROMPT, buildSupervisorDirectReplySystemPrompt } from '../src';

describe('@agent/agents-supervisor public prompt exports', () => {
  it('exports direct reply prompt rules for high-quality basic technical explanations', () => {
    const systemPrompt = buildSupervisorDirectReplySystemPrompt();

    for (const prompt of [SUPERVISOR_DIRECT_REPLY_PROMPT, systemPrompt]) {
      expect(prompt).toContain('先给一句核心结论');
      expect(prompt).toContain('对比表');
      expect(prompt).toContain('类比');
      expect(prompt).toContain('关键机制');
      expect(prompt).toContain('生命周期');
      expect(prompt).toContain('读写状态');
      expect(prompt).toContain('常见误区');
      expect(prompt).toContain('最小命令示例');
      expect(prompt).toContain('避免任务汇报口吻');
    }
  });
});
