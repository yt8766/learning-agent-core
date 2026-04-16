import type { TaskRecord } from '@agent/shared';
import { buildContextCompressionResult } from '../../utils/context-compression-pipeline';
import type { RuntimeAgentGraphState } from '../../types/chat-graph';
import { buildContextFilterAudienceSlices, orderRuntimeDispatches } from './dispatch-stage-helpers';
import type { PlanningCallbacks } from './pipeline-stage-node.types';

export async function runDispatchStage(
  task: TaskRecord,
  state: RuntimeAgentGraphState,
  callbacks: PlanningCallbacks
): Promise<Partial<RuntimeAgentGraphState>> {
  callbacks.ensureTaskNotCancelled(task);
  callbacks.syncTaskRuntime(task, {
    currentStep: 'dispatch',
    retryCount: state.retryCount,
    maxRetries: state.maxRetries
  });
  task.mainChainNode = 'context_filter';
  task.currentNode = 'context_filter';
  const orderedDispatches = orderRuntimeDispatches(state.dispatches);
  const seededDispatchOrder = task.contextFilterState?.dispatchOrder ?? [];
  const dispatchOrder = Array.from(
    new Set([...seededDispatchOrder, ...orderedDispatches.map(dispatch => dispatch.kind)])
  ) as Array<'strategy' | 'ministry' | 'fallback'>;
  const compression = buildContextCompressionResult(task);
  const filteredContextSlice = {
    summary: compression.summary,
    historyTraceCount: Math.min(task.trace.length, 12),
    evidenceCount: task.externalSources?.length ?? 0,
    specialistCount: [task.specialistLead, ...(task.supportingSpecialists ?? [])].filter(Boolean).length,
    ministryCount: Array.from(new Set((task.modelRoute ?? []).map(item => item.ministry))).length,
    compressionApplied: compression.compressionApplied,
    compressionSource: compression.compressionSource,
    compressedMessageCount: compression.compressedMessageCount,
    artifactCount: compression.artifactCount,
    originalCharacterCount: compression.originalCharacterCount,
    compactedCharacterCount: compression.compactedCharacterCount,
    reactiveRetryCount: compression.reactiveRetryCount,
    pipelineAudit: compression.pipelineAudit
  };
  task.contextFilterState = {
    node: 'context_filter',
    status: 'completed',
    filteredContextSlice,
    audienceSlices: buildContextFilterAudienceSlices(task, orderedDispatches),
    dispatchOrder,
    noiseGuards: Array.from(
      new Set([
        ...(task.contextFilterState?.noiseGuards ?? []),
        'filtered_system_battle_reports',
        'deduped_thought_copy',
        'trimmed_irrelevant_history'
      ])
    ),
    hiddenTraceCount: Math.max(0, task.trace.length - filteredContextSlice.historyTraceCount),
    redactedKeys: ['messages.raw', 'toolUsageSummary.debug'],
    createdAt: task.contextFilterState?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  callbacks.recordDispatches(task, orderedDispatches);
  callbacks.addTrace(task, 'context_filter', '文书科已完成上下文压缩与脱敏切片。', {
    filteredContextSlice,
    hiddenTraceCount: task.contextFilterState.hiddenTraceCount,
    dispatchOrder,
    audienceSlices: task.contextFilterState.audienceSlices
  });
  await callbacks.persistAndEmitTask(task);
  return { currentStep: 'dispatch', dispatches: orderedDispatches };
}
