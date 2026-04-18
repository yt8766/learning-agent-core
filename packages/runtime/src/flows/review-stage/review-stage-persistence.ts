import { applyReactiveCompactRetry, buildContextCompressionResult } from '../../utils/context-compression-pipeline';
import type { RuntimeTaskRecord } from '../../runtime/runtime-task.types';

export function resolveExecutionSummaryForPersistence(task: RuntimeTaskRecord, executionSummary: string) {
  const shouldCompact =
    executionSummary.length > 1200 || /(stderr|stdout|stack|trace|error|failed|exception)/i.test(executionSummary);
  const existingSlice = task.contextFilterState?.filteredContextSlice;
  const baseCompression = existingSlice
    ? {
        summary: existingSlice.summary,
        compressionApplied: existingSlice.compressionApplied ?? false,
        compressionSource: existingSlice.compressionSource ?? ('heuristic' as const),
        compressedMessageCount: existingSlice.compressedMessageCount ?? 0,
        artifactCount: existingSlice.artifactCount ?? 0,
        originalCharacterCount: existingSlice.originalCharacterCount ?? executionSummary.length,
        compactedCharacterCount: existingSlice.compactedCharacterCount ?? existingSlice.summary.length,
        reactiveRetryCount: existingSlice.reactiveRetryCount ?? 0,
        pipelineAudit: existingSlice.pipelineAudit ?? []
      }
    : buildContextCompressionResult({
        goal: task.goal,
        context: executionSummary,
        planDraft: task.planDraft,
        plan: task.plan,
        trace: task.trace
      });
  if (!shouldCompact) {
    return {
      summary: executionSummary,
      wasCompacted: false,
      compression: baseCompression
    };
  }
  const compacted = applyReactiveCompactRetry(baseCompression, 'review-stage', '执行摘要已压缩。');
  if (task.contextFilterState) {
    task.contextFilterState.filteredContextSlice = {
      ...task.contextFilterState.filteredContextSlice,
      summary: compacted.summary,
      compressionApplied: compacted.compressionApplied,
      compressionSource: compacted.compressionSource,
      compressedMessageCount: compacted.compressedMessageCount,
      artifactCount: compacted.artifactCount,
      originalCharacterCount: compacted.originalCharacterCount,
      compactedCharacterCount: compacted.compactedCharacterCount,
      reactiveRetryCount: compacted.reactiveRetryCount,
      pipelineAudit: compacted.pipelineAudit
    };
  }
  return {
    summary: compacted.summary || executionSummary,
    wasCompacted: true,
    compression: compacted
  };
}
