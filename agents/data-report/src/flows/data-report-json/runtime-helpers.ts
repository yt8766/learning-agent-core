import type {
  DataReportJsonArtifactEvent,
  DataReportJsonGenerationError,
  DataReportJsonGenerationNode,
  DataReportJsonGraphHandlers,
  DataReportJsonGraphState,
  DataReportJsonRuntimeMeta,
  DataReportJsonSection
} from '../../types/data-report-json';
import { runJsonAnalysisNode, runJsonPatchIntentNode, runJsonSchemaSpecNode } from './nodes';
import { buildPartialPageSchema } from './nodes/shared';
import { resolveDataReportJsonNodeModelCandidates } from './model-policy';

export const SPLIT_BLOCK_TIMEOUT_MS = 2_500;

function resolveExecutionPath(params: {
  input: DataReportJsonGraphState;
  llmAttempted: boolean;
  llmSucceeded: boolean;
}): DataReportJsonRuntimeMeta['executionPath'] {
  if (!params.llmAttempted) {
    return 'structured-fast-lane';
  }
  if (params.llmSucceeded && !params.input.reportSchemaInput && !params.input.currentSchema) {
    return 'llm';
  }
  return 'partial-llm';
}

export function buildRuntimeMeta(params: {
  input: DataReportJsonGraphState;
  cacheHit: boolean;
  nodeDurations: Partial<Record<DataReportJsonGenerationNode, number>>;
  llmAttempted: boolean;
  llmSucceeded: boolean;
}): DataReportJsonRuntimeMeta {
  return {
    cacheHit: params.cacheHit,
    executionPath: resolveExecutionPath(params),
    llmAttempted: params.llmAttempted,
    llmSucceeded: params.llmSucceeded,
    nodeDurations: params.nodeDurations
  };
}

export function mergeState(
  state: DataReportJsonGraphState,
  patch: Partial<DataReportJsonGraphState> | undefined
): DataReportJsonGraphState {
  if (!patch) {
    return state;
  }
  return {
    ...state,
    ...patch,
    warnings:
      patch.warnings || state.warnings
        ? Array.from(new Set([...(state.warnings ?? []), ...(patch.warnings ?? [])]))
        : undefined
  };
}

export function createGenerationError(params: {
  error: unknown;
  failedNode?: DataReportJsonGenerationNode;
  failedNodes?: DataReportJsonGenerationNode[];
  failedReports?: string[];
  elapsedMs: number;
}): DataReportJsonGenerationError {
  return {
    errorCode: 'report_schema_generation_failed',
    errorMessage: params.error instanceof Error ? params.error.message : 'report-schema generation failed',
    failedNode: params.failedNode,
    failedNodes: params.failedNodes,
    failedReports: params.failedReports,
    elapsedMs: params.elapsedMs,
    retryable: true
  };
}

export async function runNode(
  state: DataReportJsonGraphState,
  node: DataReportJsonGenerationNode,
  runner: (
    state: DataReportJsonGraphState,
    handlers: DataReportJsonGraphHandlers
  ) => Promise<Partial<DataReportJsonGraphState>>,
  handlers: DataReportJsonGraphHandlers
) {
  const modelId =
    node === 'validateNode'
      ? undefined
      : resolveDataReportJsonNodeModelCandidates(
          state,
          node as Exclude<DataReportJsonGenerationNode, 'validateNode'>
        )[0];
  state.onStage?.({ node, status: 'pending', modelId });
  try {
    return await runner(state, handlers);
  } catch (error) {
    state.onStage?.({ node, status: 'error', modelId });
    throw error;
  }
}

export async function runNodeWithTimeout(
  state: DataReportJsonGraphState,
  node: DataReportJsonGenerationNode,
  runner: (
    state: DataReportJsonGraphState,
    handlers: DataReportJsonGraphHandlers
  ) => Promise<Partial<DataReportJsonGraphState>>,
  handlers: DataReportJsonGraphHandlers,
  timeoutMs: number
) {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      runNode(state, node, runner, handlers),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          state.onStage?.({
            node,
            status: 'error',
            degraded: true,
            details: { timeoutMs, source: 'llm', attemptedLlm: true, degraded: true, fallbackReason: 'timeout' }
          });
          reject(new Error(`${node} timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ]);
    return result;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export function resolveStrictFragmentTimeoutMs() {
  // Strict LLM fragments rely on provider-level cancellation instead of a local graph timer.
  return undefined;
}

function buildDeterministicFallbackState(state: DataReportJsonGraphState) {
  return { ...state, strictLlmBrandNew: false, llm: undefined };
}

export async function runNodeWithTimeoutFallback(
  state: DataReportJsonGraphState,
  node: 'filterSchemaNode' | 'dataSourceNode' | 'metricsBlockNode' | 'chartBlockNode' | 'tableBlockNode',
  runner: (
    state: DataReportJsonGraphState,
    handlers: DataReportJsonGraphHandlers
  ) => Promise<Partial<DataReportJsonGraphState>>,
  handlers: DataReportJsonGraphHandlers,
  timeoutMs: number | undefined
) {
  try {
    return typeof timeoutMs === 'number'
      ? await runNodeWithTimeout(state, node, runner, handlers, timeoutMs)
      : await runNode(state, node, runner, handlers);
  } catch (error) {
    if (state.strictLlmBrandNew) {
      throw error;
    }
    const fallbackReason = error instanceof Error ? error.message : String(error);
    const patch = await runner(buildDeterministicFallbackState(state), handlers);
    return mergeState({ warnings: state.warnings } as DataReportJsonGraphState, {
      ...patch,
      warnings: [...(state.warnings ?? []), `${node} timeout fallback: ${fallbackReason}`]
    });
  }
}

function buildProgressiveSchema(state: DataReportJsonGraphState) {
  const progressiveSections =
    state.sections ??
    (state.sectionPlan
      ? [
          {
            ...state.sectionPlan,
            blocks: [state.sectionMetricsBlock, state.sectionChartBlock, state.sectionTableBlock].filter(
              (block): block is DataReportJsonSection['blocks'][number] => Boolean(block)
            )
          }
        ]
      : undefined);
  return buildPartialPageSchema({ ...state, sections: progressiveSections });
}

export function emitArtifact(state: DataReportJsonGraphState, event: Omit<DataReportJsonArtifactEvent, 'schema'>) {
  state.onArtifact?.({ ...event, schema: buildProgressiveSchema(state) });
}

export async function runNodeWithRetry(
  state: DataReportJsonGraphState,
  node: 'metricsBlockNode' | 'chartBlockNode' | 'tableBlockNode',
  runner: (
    state: DataReportJsonGraphState,
    handlers: DataReportJsonGraphHandlers
  ) => Promise<Partial<DataReportJsonGraphState>>,
  handlers: DataReportJsonGraphHandlers,
  timeoutMs?: number
) {
  const modelCandidates = resolveDataReportJsonNodeModelCandidates(state, node);
  const maxAttempts = state.strictLlmBrandNew ? 2 : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const attemptState =
      attempt === 0
        ? state
        : {
            ...state,
            temperature: 0,
            nodeModelOverrides: {
              ...state.nodeModelOverrides,
              [node]: modelCandidates[Math.min(attempt, modelCandidates.length - 1)]
            }
          };

    try {
      return typeof timeoutMs === 'number'
        ? await runNodeWithTimeout(attemptState, node, runner, handlers, timeoutMs)
        : await runNode(attemptState, node, runner, handlers);
    } catch (error) {
      lastError = error;
      if (error instanceof Error && error.message.includes('timeout after')) {
        break;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`${node} failed after retries`);
}

export async function runSharedPrelude(input: DataReportJsonGraphState, handlers: DataReportJsonGraphHandlers) {
  input.onStage?.({ node: 'planningNode', status: 'pending' });
  const strictFragmentTimeoutMs = resolveStrictFragmentTimeoutMs();
  try {
    let state = mergeState(
      { ...input, warnings: input.warnings ?? [] },
      await runNode({ ...input, warnings: input.warnings ?? [] }, 'analysisNode', runJsonAnalysisNode, handlers)
    );

    if (state.currentSchema && state.modificationRequest) {
      state = mergeState(state, await runNode(state, 'patchIntentNode', runJsonPatchIntentNode, handlers));
    }

    if (!state.currentSchema) {
      state = mergeState(
        state,
        strictFragmentTimeoutMs
          ? await runNodeWithTimeout(state, 'schemaSpecNode', runJsonSchemaSpecNode, handlers, strictFragmentTimeoutMs)
          : await runNode(state, 'schemaSpecNode', runJsonSchemaSpecNode, handlers)
      );
    }

    input.onStage?.({
      node: 'planningNode',
      status: 'success',
      details: {
        childNodes: [
          'analysisNode',
          state.currentSchema && state.modificationRequest ? 'patchIntentNode' : undefined,
          state.currentSchema ? undefined : 'schemaSpecNode'
        ].filter(Boolean)
      }
    });

    return state;
  } catch (error) {
    input.onStage?.({
      node: 'planningNode',
      status: 'error',
      details: {
        failedPrelude: true,
        fallbackReason: error instanceof Error ? error.message : String(error)
      }
    });
    throw error;
  }
}
