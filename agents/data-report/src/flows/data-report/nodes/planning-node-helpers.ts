import type { ZodType } from 'zod/v4';

import { generateObjectWithRetry } from '../../../utils/llm-retry';
import type { ChatMessage } from '@agent/adapters';
import type { DataReportJsonNodeModelSelector } from '@agent/core';
import type { DataReportGenerationNode, DataReportSandpackGraphState } from '../../../types/data-report';
import { resolveFirstModelSelectorCandidate } from '../../../utils/model-selection';

const DEFAULT_NODE_MODEL_SELECTORS: Partial<Record<DataReportGenerationNode, DataReportJsonNodeModelSelector>> = {
  analysisNode: { tier: 'fast', role: 'manager' },
  intentNode: { tier: 'fast', role: 'manager' },
  styleGenNode: { tier: 'fast', role: 'manager' }
};

function resolveNodeModelId(state: DataReportSandpackGraphState, node: DataReportGenerationNode) {
  const override = state.nodeModelOverrides?.[node];
  if (override) {
    return override;
  }

  return (
    resolveFirstModelSelectorCandidate({
      llm: state.llm,
      selector: DEFAULT_NODE_MODEL_SELECTORS[node],
      explicitModelId: state.modelId
    }) ?? state.modelId
  );
}

export async function generateDataReportNodeObject<T>(params: {
  state: DataReportSandpackGraphState;
  node: DataReportGenerationNode;
  contractName: string;
  contractVersion: string;
  schema: ZodType<T>;
  systemPrompt: string;
  userContent: string;
}): Promise<T | null> {
  const { state, node, contractName, contractVersion, schema, systemPrompt, userContent } = params;
  if (!state.llm?.isConfigured() || typeof state.llm.generateObject !== 'function') {
    return null;
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent }
  ];

  try {
    return await generateObjectWithRetry<T>({
      llm: state.llm,
      contractName,
      contractVersion,
      messages,
      schema,
      options: {
        role: 'manager',
        modelId: resolveNodeModelId(state, node),
        temperature: typeof state.temperature === 'number' ? state.temperature : 0.1,
        maxTokens: state.maxTokens
      }
    });
  } catch {
    return null;
  }
}
