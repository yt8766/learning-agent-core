import { describe, expect, it } from 'vitest';

import { applyReactiveCompactRetry, buildContextCompressionResult } from '../../src/utils/context-compression-pipeline';

describe('context-compression-pipeline', () => {
  it('produces audit stages and offloads large log-like context into artifacts', () => {
    const result = buildContextCompressionResult({
      goal: '诊断兵部执行失败',
      context: 'stderr log stack trace error '.repeat(20),
      planDraft: { summary: '检查日志' } as any,
      plan: undefined,
      trace: new Array(20).fill({ id: 'trace' }) as any
    });

    expect(result.compressionApplied).toBe(true);
    expect(result.artifactCount).toBeGreaterThan(0);
    expect(result.pipelineAudit.map(item => item.stage)).toEqual(
      expect.arrayContaining(['large_result_offload', 'micro_compression', 'history_trim', 'projection'])
    );
  });

  it('keeps short non-log context mostly unchanged and records no-op audit reasons', () => {
    const result = buildContextCompressionResult({
      goal: '整理计划',
      context: '短上下文',
      planDraft: undefined,
      plan: { summary: '补齐测试' } as any,
      trace: new Array(2).fill({ id: 'trace' }) as any
    });

    expect(result.summary).toBe('整理计划 | 短上下文 | 补齐测试');
    expect(result.compressionApplied).toBe(false);
    expect(result.artifactCount).toBe(0);
    expect(result.compressedMessageCount).toBe(2);
    expect(result.pipelineAudit).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: 'large_result_offload',
          applied: false,
          reason: '未检测到大结果语义。'
        }),
        expect.objectContaining({
          stage: 'micro_compression',
          applied: false,
          reason: '无需微压缩。'
        }),
        expect.objectContaining({
          stage: 'history_trim',
          applied: false,
          reason: '无需裁剪历史 trace。'
        })
      ])
    );
  });

  it('adds a reactive compact retry audit record and truncates long summaries', () => {
    const result = applyReactiveCompactRetry(
      buildContextCompressionResult({
        goal: '长上下文',
        context: 'x'.repeat(500),
        planDraft: undefined,
        plan: undefined,
        trace: []
      }),
      'token_limit',
      'fallback'
    );

    expect(result.reactiveRetryCount).toBe(1);
    expect(result.pipelineAudit.at(-1)).toEqual(
      expect.objectContaining({
        stage: 'reactive_compact_retry',
        triggeredBy: 'token_limit'
      })
    );
    expect(result.summary.endsWith('...')).toBe(true);
    expect(result.summary.length).toBeLessThanOrEqual(180);
  });

  it('falls back to the provided summary when the original summary is empty', () => {
    const result = applyReactiveCompactRetry(
      {
        summary: '',
        compressionApplied: false,
        compressionSource: 'heuristic',
        compressedMessageCount: 0,
        artifactCount: 0,
        originalCharacterCount: 0,
        compactedCharacterCount: 0,
        reactiveRetryCount: 0,
        pipelineAudit: []
      },
      'manual_retry',
      'fallback-summary'
    );

    expect(result.summary).toBe('fallback-summary');
    expect(result.reactiveRetryCount).toBe(1);
    expect(result.pipelineAudit).toEqual([
      expect.objectContaining({
        stage: 'reactive_compact_retry',
        triggeredBy: 'manual_retry',
        compactedSize: 'fallback-summary'.length
      })
    ]);
  });
});
