import type { ContextFilterRecord } from '@agent/core';
import type { RuntimeTaskRecord } from '../runtime/runtime-task.types';

type PipelineAudit = NonNullable<ContextFilterRecord['filteredContextSlice']['pipelineAudit']>;

export interface ContextCompressionResult {
  summary: string;
  compressionApplied: boolean;
  compressionSource: 'heuristic' | 'llm';
  compressedMessageCount: number;
  artifactCount: number;
  originalCharacterCount: number;
  compactedCharacterCount: number;
  reactiveRetryCount: number;
  pipelineAudit: PipelineAudit;
}

export function buildContextCompressionResult(
  task: Pick<RuntimeTaskRecord, 'goal' | 'context' | 'planDraft' | 'plan' | 'trace'>
) {
  const rawSegments = [task.goal, task.context, task.planDraft?.summary, task.plan?.summary].filter(
    (value): value is string => Boolean(value)
  );
  const originalText = rawSegments.join(' | ');
  const artifactIds: string[] = [];
  const pipelineAudit: PipelineAudit = [];
  let compacted = originalText;

  const originalCharacterCount = originalText.length;
  const traceOverflow = Math.max(0, (task.trace?.length ?? 0) - 12);
  const artifactCount = /(?:error|stack|trace|log|stdout|stderr)/i.test(originalText) ? 1 : 0;
  if (artifactCount > 0) {
    artifactIds.push(`artifact:${task.goal.slice(0, 24)}`);
    compacted = compacted.replace(/\s+/g, ' ');
  }
  pipelineAudit.push({
    stage: 'large_result_offload',
    applied: artifactCount > 0,
    reason: artifactCount > 0 ? '检测到日志/报错语义，转为 artifact 引用。' : '未检测到大结果语义。',
    originalSize: originalCharacterCount,
    compactedSize: compacted.length,
    artifactIds
  });

  const microCompressed = compacted.length > 240 ? `${compacted.slice(0, 237)}...` : compacted;
  pipelineAudit.push({
    stage: 'micro_compression',
    applied: microCompressed.length !== compacted.length,
    reason: microCompressed.length !== compacted.length ? '摘要超过 240 字符，执行微压缩。' : '无需微压缩。',
    originalSize: compacted.length,
    compactedSize: microCompressed.length
  });
  compacted = microCompressed;

  pipelineAudit.push({
    stage: 'history_trim',
    applied: traceOverflow > 0,
    reason: traceOverflow > 0 ? `隐藏 ${traceOverflow} 条中间 trace。` : '无需裁剪历史 trace。',
    triggeredBy: 'trace_count'
  });

  pipelineAudit.push({
    stage: 'projection',
    applied: true,
    reason: '已生成面向 strategy/ministry/fallback 的投影视图。'
  });

  pipelineAudit.push({
    stage: 'conversation_summary',
    applied: true,
    reason: '已生成上下文摘要视图。',
    originalSize: originalCharacterCount,
    compactedSize: compacted.length
  });

  return {
    summary: compacted,
    compressionApplied: compacted !== originalText || artifactCount > 0 || traceOverflow > 0,
    compressionSource: 'heuristic' as const,
    compressedMessageCount: Math.min(task.trace?.length ?? 0, 12),
    artifactCount,
    originalCharacterCount,
    compactedCharacterCount: compacted.length,
    reactiveRetryCount: 0,
    pipelineAudit
  } satisfies ContextCompressionResult;
}

export function applyReactiveCompactRetry(
  result: ContextCompressionResult,
  trigger: string,
  fallbackSummary: string
): ContextCompressionResult {
  const compactedSummary =
    result.summary.length > 180 ? `${result.summary.slice(0, 177)}...` : result.summary || fallbackSummary;
  return {
    ...result,
    summary: compactedSummary,
    compactedCharacterCount: compactedSummary.length,
    reactiveRetryCount: result.reactiveRetryCount + 1,
    pipelineAudit: [
      ...result.pipelineAudit,
      {
        stage: 'reactive_compact_retry',
        applied: true,
        reason: '模型上下文过大，执行应急压缩重试。',
        originalSize: result.compactedCharacterCount,
        compactedSize: compactedSummary.length,
        triggeredBy: trigger
      }
    ]
  };
}
