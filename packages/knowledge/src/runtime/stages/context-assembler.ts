import type { RetrievalHit } from '../../index';

import type { NormalizedRetrievalRequest } from '../types/retrieval-runtime.types';

export interface PromptContextBudget {
  maxContextTokens: number;
  reservedOutputTokens?: number;
  systemTokens?: number;
  queryTokens?: number;
  historyTokens?: number;
}

export interface ContextAssemblyDiagnostics {
  strategy: string;
  budgetTokens?: number;
  estimatedTokens: number;
  selectedHitIds: string[];
  droppedHitIds: string[];
  truncatedHitIds: string[];
  orderingStrategy: string;
}

export interface ContextAssemblyOptions {
  budget?: PromptContextBudget;
}

export interface ContextAssemblyResult {
  contextBundle: string;
  diagnostics: ContextAssemblyDiagnostics;
}

export type ContextAssemblerOutput = string | ContextAssemblyResult;

export interface ContextAssembler {
  assemble(
    hits: RetrievalHit[],
    request: NormalizedRetrievalRequest,
    options?: ContextAssemblyOptions
  ): Promise<ContextAssemblerOutput>;
}
