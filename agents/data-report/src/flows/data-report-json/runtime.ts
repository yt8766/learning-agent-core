import type {
  DataReportJsonGenerateResult,
  DataReportJsonGenerationNode,
  DataReportJsonGraphHandlers,
  DataReportJsonGraphState
} from '../../types/data-report-json';
import { resolveNodeScopedPatchTarget, resolveNodeScopedPatchTargetFromIntents } from './nodes/shared';
import { shouldUseSplitSingleReportLane } from './model-policy';
import {
  DATA_REPORT_JSON_ARTIFACT_CACHE_ENABLED,
  DATA_REPORT_JSON_ARTIFACT_CACHE_TTL,
  buildArtifactCacheKey,
  isArtifactCacheExpired,
  readArtifactCache,
  writeArtifactCache
} from './runtime-cache';
import { buildRuntimeMeta, createGenerationError, runSharedPrelude } from './runtime-helpers';
import { runBundleLane, runNodeScopedPatchLane, runSplitSingleReportLane, runStandardLane } from './runtime-lanes';

export async function executeDataReportJsonGraph(
  input: DataReportJsonGraphState,
  handlers: DataReportJsonGraphHandlers = {}
): Promise<DataReportJsonGenerateResult> {
  const startedAt = Date.now();
  const artifactCacheKey = buildArtifactCacheKey(input);
  const nodeStartedAt = new Map<DataReportJsonGenerationNode, number>();
  const nodeDurations: Partial<Record<DataReportJsonGenerationNode, number>> = {};
  let llmAttempted = false;
  let llmSucceeded = false;
  const instrumentedInput: DataReportJsonGraphState = {
    ...input,
    onStage: event => {
      if (event.status === 'pending') {
        nodeStartedAt.set(event.node, Date.now());
      } else {
        const startedAtMs = nodeStartedAt.get(event.node);
        if (startedAtMs) {
          nodeDurations[event.node] = Date.now() - startedAtMs;
        }
      }

      if (event.details?.attemptedLlm === true || event.details?.source === 'llm') {
        llmAttempted = true;
      }

      if (event.details?.source === 'llm') {
        llmSucceeded = true;
      }

      input.onStage?.(event);
    }
  };

  try {
    if (
      DATA_REPORT_JSON_ARTIFACT_CACHE_ENABLED &&
      !instrumentedInput.disableCache &&
      artifactCacheKey &&
      !instrumentedInput.currentSchema
    ) {
      const cache = await readArtifactCache();
      const cached = cache.get(artifactCacheKey);
      if (cached && !isArtifactCacheExpired(cached)) {
        return {
          ...cached.result,
          elapsedMs: Date.now() - startedAt,
          reportSummaries: cached.result.reportSummaries?.map(summary => ({
            ...summary,
            cacheHit: true
          })),
          runtime: buildRuntimeMeta({
            input: instrumentedInput,
            cacheHit: true,
            nodeDurations: cached.result.runtime?.nodeDurations ?? {},
            llmAttempted:
              cached.result.runtime?.llmAttempted ?? cached.result.runtime?.executionPath !== 'structured-fast-lane',
            llmSucceeded: cached.result.runtime?.llmSucceeded ?? cached.result.runtime?.executionPath === 'llm'
          })
        };
      }
    }

    const preludeState = await runSharedPrelude(instrumentedInput, handlers);
    const result =
      preludeState.currentSchema &&
      (resolveNodeScopedPatchTargetFromIntents(preludeState.patchIntents) ??
        resolveNodeScopedPatchTarget(preludeState.modificationRequest))
        ? await runNodeScopedPatchLane(preludeState, handlers, startedAt)
        : shouldUseSplitSingleReportLane(preludeState)
          ? await runSplitSingleReportLane(preludeState, handlers, startedAt)
          : preludeState.analysis?.scope === 'multiple'
            ? await runBundleLane(preludeState, handlers, startedAt)
            : await runStandardLane(preludeState, handlers, startedAt);
    const runtime = buildRuntimeMeta({
      input: instrumentedInput,
      cacheHit: false,
      nodeDurations,
      llmAttempted,
      llmSucceeded
    });
    const resultWithRuntime = {
      ...result,
      runtime
    };

    if (
      DATA_REPORT_JSON_ARTIFACT_CACHE_ENABLED &&
      !instrumentedInput.disableCache &&
      artifactCacheKey &&
      result.status === 'success'
    ) {
      const now = new Date().toISOString();
      (await readArtifactCache()).set(artifactCacheKey, {
        createdAt: now,
        updatedAt: now,
        ttlMs: DATA_REPORT_JSON_ARTIFACT_CACHE_TTL,
        result: resultWithRuntime
      });
      await writeArtifactCache();
    }

    return resultWithRuntime;
  } catch (error) {
    const generationError = createGenerationError({
      error,
      failedNode: instrumentedInput.failedNode,
      failedNodes: instrumentedInput.failedNode ? [instrumentedInput.failedNode] : undefined,
      elapsedMs: Date.now() - startedAt
    });
    return {
      status: 'failed',
      content: JSON.stringify({ status: 'failed', error: generationError }, null, 2),
      error: generationError,
      runtime: buildRuntimeMeta({
        input: instrumentedInput,
        cacheHit: false,
        nodeDurations,
        llmAttempted,
        llmSucceeded
      }),
      elapsedMs: Date.now() - startedAt
    };
  }
}
