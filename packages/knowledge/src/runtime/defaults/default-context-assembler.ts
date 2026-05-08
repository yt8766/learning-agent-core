import type { RetrievalHit } from '../../index';

import type { ContextAssembler, ContextAssemblyOptions, ContextAssemblyResult } from '../stages/context-assembler';
import type { NormalizedRetrievalRequest } from '../types/retrieval-runtime.types';
import { DEFAULT_CONTEXT_SEPARATOR } from './retrieval-runtime-defaults';

const APPROX_CHARS_PER_TOKEN = 4;
const MIN_TRUNCATED_PART_CHARS = 24;

export class DefaultContextAssembler implements ContextAssembler {
  async assemble(
    hits: RetrievalHit[],
    _request: NormalizedRetrievalRequest,
    options: ContextAssemblyOptions = {}
  ): Promise<ContextAssemblyResult> {
    const budgetTokens = resolveBudgetTokens(options);
    const budgetChars = budgetTokens === undefined ? undefined : Math.max(0, budgetTokens * APPROX_CHARS_PER_TOKEN);
    const selectedHitIds: string[] = [];
    const droppedHitIds: string[] = [];
    const truncatedHitIds: string[] = [];
    const parts: string[] = [];
    let usedChars = 0;

    for (const [index, hit] of hits.entries()) {
      const part = `[${index + 1}] ${hit.title}\n${hit.content}`;
      const separator = parts.length > 0 ? DEFAULT_CONTEXT_SEPARATOR : '';
      const nextLength = separator.length + part.length;

      if (budgetChars === undefined || usedChars + nextLength <= budgetChars) {
        parts.push(part);
        usedChars += nextLength;
        selectedHitIds.push(hit.chunkId);
        continue;
      }

      const remainingChars = budgetChars - usedChars - separator.length;
      if (remainingChars > MIN_TRUNCATED_PART_CHARS) {
        parts.push(truncateText(part, remainingChars));
        usedChars = budgetChars;
        selectedHitIds.push(hit.chunkId);
        truncatedHitIds.push(hit.chunkId);
      } else {
        droppedHitIds.push(hit.chunkId);
      }

      for (const droppedHit of hits.slice(index + 1)) {
        droppedHitIds.push(droppedHit.chunkId);
      }
      break;
    }

    const contextBundle = parts.join(DEFAULT_CONTEXT_SEPARATOR);

    return {
      contextBundle,
      diagnostics: {
        strategy: budgetTokens === undefined ? 'default-concat' : 'default-budgeted-concat',
        budgetTokens,
        estimatedTokens: estimateTokens(contextBundle),
        selectedHitIds,
        droppedHitIds,
        truncatedHitIds,
        orderingStrategy: 'ranked'
      }
    };
  }
}

function resolveBudgetTokens(options: ContextAssemblyOptions): number | undefined {
  const budget = options.budget;
  if (!budget) {
    return undefined;
  }

  const reserved =
    (budget.reservedOutputTokens ?? 0) +
    (budget.systemTokens ?? 0) +
    (budget.queryTokens ?? 0) +
    (budget.historyTokens ?? 0);
  return Math.max(0, budget.maxContextTokens - reserved);
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / APPROX_CHARS_PER_TOKEN);
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  if (maxChars <= 3) {
    return text.slice(0, maxChars);
  }

  return `${text.slice(0, maxChars - 3).trimEnd()}...`;
}
