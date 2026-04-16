import type { ZodType } from 'zod/v4';

import { generateObjectWithRetry } from '../../../utils/llm-retry';
import type { ChatMessage } from '@agent/adapters';
import type { DataReportGenerationNode, DataReportSandpackGraphState } from '../../../types/data-report';

const DEFAULT_NODE_MODEL_CANDIDATES: Partial<Record<DataReportGenerationNode, string[]>> = {
  analysisNode: ['glm-4.7-flash'],
  intentNode: ['glm-4.7-flash'],
  styleGenNode: ['glm-4.7-flash']
};

function resolveNodeModelId(state: DataReportSandpackGraphState, node: DataReportGenerationNode) {
  const override = state.nodeModelOverrides?.[node];
  if (override) {
    return override;
  }

  const supportedModels = new Set(
    typeof state.llm?.supportedModels === 'function' ? state.llm.supportedModels().map(model => model.id) : []
  );
  for (const candidate of DEFAULT_NODE_MODEL_CANDIDATES[node] ?? []) {
    if (supportedModels.has(candidate)) {
      return candidate;
    }
  }

  return state.modelId;
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
