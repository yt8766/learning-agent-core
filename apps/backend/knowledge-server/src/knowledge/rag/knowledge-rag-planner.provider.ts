import {
  KnowledgeStructuredPlannerProviderResultSchema,
  type KnowledgeStructuredPlannerProvider,
  type KnowledgeStructuredPlannerProviderInput,
  type KnowledgeStructuredPlannerProviderResult
} from '@agent/knowledge';

import type { RagModelProfile } from '../domain/knowledge-document.types';

export interface KnowledgeRagPlannerProviderOptions {
  chatProvider: KnowledgeRagPlannerChatProvider;
  modelProfile: Pick<RagModelProfile, 'plannerModelId'>;
  preferredKnowledgeBaseIds?: string[];
}

interface KnowledgeRagPlannerChatProvider {
  generate(input: {
    model: string;
    messages: Array<{ role: 'system' | 'user'; content: string }>;
    metadata?: KnowledgeStructuredPlannerProviderInput['metadata'];
  }): Promise<{ text: string }>;
}

export function createKnowledgeRagPlannerProvider(
  options: KnowledgeRagPlannerProviderOptions
): KnowledgeStructuredPlannerProvider {
  return {
    async plan(input: KnowledgeStructuredPlannerProviderInput): Promise<KnowledgeStructuredPlannerProviderResult> {
      const generated = await options.chatProvider.generate({
        model: options.modelProfile.plannerModelId,
        messages: [
          {
            role: 'system',
            content: buildPlannerSystemPrompt()
          },
          {
            role: 'user',
            content: buildPlannerUserPrompt(input, options.preferredKnowledgeBaseIds ?? [])
          }
        ],
        metadata: input.metadata
      });

      return KnowledgeStructuredPlannerProviderResultSchema.parse(extractPlannerJson(generated.text));
    }
  };
}

export function extractPlannerJson(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return JSON.parse(trimmed);
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1]);
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error('Planner provider did not return JSON.');
}

function buildPlannerSystemPrompt(): string {
  return [
    'You are the structured pre-retrieval planner for a knowledge RAG SDK.',
    'Return JSON only. Do not include markdown, prose, comments, or code fences.',
    'The JSON must satisfy this shape:',
    '{',
    '  "rewrittenQuery": "optional rewritten search query",',
    '  "queryVariants": ["optional search variants"],',
    '  "selectedKnowledgeBaseIds": ["ids from accessible knowledge bases only"],',
    '  "searchMode": "hybrid",',
    '  "selectionReason": "short reason",',
    '  "confidence": 0.0',
    '}'
  ].join('\n');
}

function buildPlannerUserPrompt(
  input: KnowledgeStructuredPlannerProviderInput,
  preferredKnowledgeBaseIds: string[]
): string {
  return [
    `User query: ${input.query}`,
    '',
    `Default search mode: ${input.policy.defaultSearchMode}`,
    `Maximum selected knowledge bases: ${input.policy.maxSelectedKnowledgeBases}`,
    `Maximum query variants: ${input.policy.maxQueryVariants}`,
    `Preferred knowledge base ids: ${preferredKnowledgeBaseIds.length > 0 ? preferredKnowledgeBaseIds.join(', ') : '(none)'}`,
    '',
    'Accessible knowledge bases:',
    formatKnowledgeBases(input),
    '',
    'Select the most relevant accessible knowledge bases and generate concise search variants.'
  ].join('\n');
}

function formatKnowledgeBases(input: KnowledgeStructuredPlannerProviderInput): string {
  if (input.accessibleKnowledgeBases.length === 0) {
    return '(none)';
  }

  return input.accessibleKnowledgeBases
    .map(base =>
      [
        `- id: ${base.id}`,
        `  name: ${base.name}`,
        base.description ? `  description: ${base.description}` : undefined,
        base.tags && base.tags.length > 0 ? `  tags: ${base.tags.join(', ')}` : undefined,
        typeof base.documentCount === 'number' ? `  documentCount: ${base.documentCount}` : undefined,
        base.recentDocumentTitles && base.recentDocumentTitles.length > 0
          ? `  recentDocumentTitles: ${base.recentDocumentTitles.join('; ')}`
          : undefined,
        base.updatedAt ? `  updatedAt: ${base.updatedAt}` : undefined
      ]
        .filter(isPresent)
        .join('\n')
    )
    .join('\n');
}

function isPresent(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}
