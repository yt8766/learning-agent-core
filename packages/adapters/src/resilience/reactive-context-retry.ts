import type { ContextFilterRecord, TaskRecord } from '@agent/core';

import type { ChatMessage } from '../contracts/llm/llm-provider.types';

type PipelineAuditEntry = NonNullable<
  NonNullable<ContextFilterRecord['filteredContextSlice']>['pipelineAudit']
>[number];

interface ContextCompactionResult {
  summary: string;
  compressionApplied: boolean;
  compressionSource: 'heuristic' | 'llm';
  compressedMessageCount: number;
  artifactCount: number;
  originalCharacterCount: number;
  compactedCharacterCount: number;
  reactiveRetryCount: number;
  pipelineAudit: PipelineAuditEntry[];
}

export interface ReactiveContextRetryContext {
  goal: string;
  onContextCompaction?: (payload: { trigger: string; result: ContextCompactionResult }) => Promise<void> | void;
}

const CONTEXT_OVERFLOW_PATTERN =
  /(maximum context length|context length|context window|token limit|too many tokens|prompt is too long|context overflow)/i;

export function isLikelyContextOverflow(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return CONTEXT_OVERFLOW_PATTERN.test(message);
}

export function buildCompactedMessages(messages: ChatMessage[], summary: string): ChatMessage[] {
  const systemMessages = messages.filter(message => message.role === 'system').slice(0, 1);
  const trailingMessages = messages
    .filter(message => message.role !== 'system')
    .slice(-2)
    .map(message => ({
      ...message,
      content: message.content.length > 240 ? `${message.content.slice(0, 237)}...` : message.content
    }));

  return [
    ...systemMessages,
    {
      role: 'system',
      content: `Earlier context compacted for retry:\n${summary}`
    },
    ...trailingMessages
  ];
}

export async function withReactiveContextRetry<T>(params: {
  context: ReactiveContextRetryContext;
  trigger: string;
  messages: ChatMessage[];
  invoke: (messages: ChatMessage[]) => Promise<T>;
}) {
  try {
    return await params.invoke(params.messages);
  } catch (error) {
    if (!isLikelyContextOverflow(error)) {
      throw error;
    }

    const compacted = applyReactiveCompactRetry(
      buildContextCompressionResult({
        goal: params.context.goal,
        context: params.messages.map(message => `${message.role}: ${message.content}`).join('\n'),
        planDraft: undefined,
        plan: undefined,
        trace: []
      }),
      params.trigger,
      '上下文已压缩重试。'
    );
    await params.context.onContextCompaction?.({
      trigger: params.trigger,
      result: compacted
    });
    return params.invoke(buildCompactedMessages(params.messages, compacted.summary));
  }
}

function buildContextCompressionResult(task: Pick<TaskRecord, 'goal' | 'context' | 'planDraft' | 'plan' | 'trace'>) {
  const rawSegments = [task.goal, task.context, task.planDraft?.summary, task.plan?.summary].filter(
    (value): value is string => Boolean(value)
  );
  const originalText = rawSegments.join(' | ');
  const artifactIds: string[] = [];
  const pipelineAudit: ContextCompactionResult['pipelineAudit'] = [];
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
    compactedCharacterCount: compacted.length,
    reactiveRetryCount: 0,
    originalCharacterCount,
    pipelineAudit
  } satisfies ContextCompactionResult;
}

function applyReactiveCompactRetry(result: ContextCompactionResult, trigger: string, fallbackSummary: string) {
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
        stage: 'reactive_compact_retry' as const,
        applied: true,
        reason: '模型上下文过大，执行应急压缩重试。',
        originalSize: result.compactedCharacterCount,
        compactedSize: compactedSummary.length,
        triggeredBy: trigger
      }
    ]
  };
}
