import { describe, expect, it } from 'vitest';

import { TASK_MESSAGE_EVENT_MAP, TRACE_EVENT_MAP } from '../src/utils/event-maps';
import { buildContextCompressionResult } from '../src/utils/context-compression-pipeline';
import {
  buildFreshnessAnswerInstruction,
  buildTemporalContextBlock,
  isFreshnessSensitiveGoal
} from '../src/utils/prompts/temporal-context';
import { sanitizeTaskContextForModel } from '../src/utils/prompts/runtime-output-sanitizer';

describe('runtime utils', () => {
  it('keeps event map and prompt sanitization behavior stable', () => {
    expect(TRACE_EVENT_MAP.execute).toBe('tool_called');
    expect(TASK_MESSAGE_EVENT_MAP.summary).toBe('assistant_message');
    expect(isFreshnessSensitiveGoal('今天最新进展是什么')).toBe(true);
    expect(buildTemporalContextBlock(new Date('2026-04-15T08:00:00.000Z'))).toContain('2026-04-15');
    expect(buildFreshnessAnswerInstruction('最新消息', new Date('2026-04-15T08:00:00.000Z'))).toContain('2026-04-15');
    expect(sanitizeTaskContextForModel('首辅已完成规划，接下来会按步骤推进。\n\n保留这个结论')).toBe('保留这个结论');
  });

  it('builds heuristic context compression summaries', () => {
    const result = buildContextCompressionResult({
      goal: '排查错误日志',
      context: 'stderr stack trace log',
      planDraft: { summary: '先压缩上下文' },
      plan: { summary: '再执行恢复' },
      trace: new Array(14).fill({}) as never
    });

    expect(result.compressionApplied).toBe(true);
    expect(result.pipelineAudit.some(item => item.stage === 'large_result_offload')).toBe(true);
    expect(result.pipelineAudit.some(item => item.stage === 'history_trim')).toBe(true);
  });
});
