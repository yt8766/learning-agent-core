import type {
  Citation,
  KnowledgeAnswerProvider,
  KnowledgeAnswerProviderInput,
  KnowledgeStructuredPlannerProvider,
  KnowledgeStructuredPlannerProviderInput,
  KnowledgeStructuredPlannerProviderResult
} from '@agent/knowledge';

import type { RagModelProfile } from '../domain/knowledge-document.types';
import type { KnowledgeSdkRuntimeProviderValue } from '../runtime/knowledge-sdk-runtime.provider';

export interface KnowledgeRagPlannerProviderOptions {
  preferredKnowledgeBaseIds?: string[];
}

interface KnowledgeDomainRagAnswerProvider extends KnowledgeAnswerProvider {
  getLastError?: () => Error | undefined;
}

type KnowledgeRagJsonValue =
  | string
  | number
  | boolean
  | null
  | KnowledgeRagJsonValue[]
  | { [key: string]: KnowledgeRagJsonValue };

export function createDeterministicKnowledgeRagPlannerProvider(
  options: KnowledgeRagPlannerProviderOptions = {}
): KnowledgeStructuredPlannerProvider {
  return {
    async plan(input: KnowledgeStructuredPlannerProviderInput): Promise<KnowledgeStructuredPlannerProviderResult> {
      const accessibleIds = input.accessibleKnowledgeBases.map(base => base.id);
      const preferredIds = new Set(options.preferredKnowledgeBaseIds ?? []);
      const selectedKnowledgeBaseIds =
        preferredIds.size > 0 ? accessibleIds.filter(id => preferredIds.has(id)) : accessibleIds;

      return {
        selectedKnowledgeBaseIds,
        queryVariants: [input.query],
        searchMode: input.policy.defaultSearchMode,
        selectionReason:
          preferredIds.size > 0
            ? 'Selected by explicit route constraints before SDK RAG.'
            : 'Selected all accessible knowledge bases by deterministic planner fallback.',
        confidence: 1,
        routingDecisions: accessibleIds.map(id => ({
          knowledgeBaseId: id,
          selected: selectedKnowledgeBaseIds.includes(id),
          source: 'deterministic',
          reason: selectedKnowledgeBaseIds.includes(id)
            ? 'Selected by deterministic knowledge-domain planner provider.'
            : 'Not selected by deterministic knowledge-domain planner provider.'
        }))
      };
    }
  };
}

export function createKnowledgeRagAnswerProvider(
  sdkRuntime: KnowledgeSdkRuntimeProviderValue,
  modelProfile?: Pick<RagModelProfile, 'answerModelId'>
): KnowledgeDomainRagAnswerProvider {
  if (!sdkRuntime.enabled) {
    return {
      async generate(input: KnowledgeAnswerProviderInput) {
        return {
          text:
            input.citations.length > 0
              ? input.citations
                  .map(citation => citation.quote)
                  .filter(isPresent)
                  .join('\n\n')
              : '未在当前知识库中找到足够依据。',
          citations: input.citations
        };
      }
    };
  }

  let lastError: Error | undefined;
  const chatProvider = sdkRuntime.runtime.chatProvider;
  const stream = chatProvider.stream?.bind(chatProvider);
  return {
    async generate(input: KnowledgeAnswerProviderInput) {
      lastError = undefined;
      const generated = await chatProvider
        .generate({
          ...(modelProfile?.answerModelId ? { model: modelProfile.answerModelId } : {}),
          messages: buildSdkChatMessages(input),
          metadata: input.metadata
        })
        .catch(error => {
          lastError = toError(error);
          return undefined;
        });
      if (!generated) {
        lastError ??= new Error('Knowledge answer provider failed.');
        return {
          text: 'Knowledge answer provider failed.',
          citations: input.citations
        };
      }
      return {
        text: generated.text,
        citations: input.citations,
        metadata: buildProviderMetadata(generated)
      };
    },
    ...(stream
      ? {
          async *stream(input: KnowledgeAnswerProviderInput) {
            lastError = undefined;
            try {
              for await (const event of stream({
                ...(modelProfile?.answerModelId ? { model: modelProfile.answerModelId } : {}),
                messages: buildSdkChatMessages(input),
                metadata: input.metadata
              })) {
                if (isStreamDeltaEvent(event)) {
                  yield {
                    textDelta: event.text,
                    ...(toJsonMetadata(event.metadata) ? { metadata: toJsonMetadata(event.metadata) } : {})
                  };
                  continue;
                }

                if (isStreamDoneEvent(event)) {
                  const metadata = toJsonMetadata(event.metadata);
                  if (event.result) {
                    yield {
                      result: {
                        text: event.result.text,
                        citations: input.citations,
                        metadata: buildProviderMetadata(event.result)
                      },
                      ...(metadata ? { metadata } : {})
                    };
                  } else if (metadata) {
                    yield { metadata };
                  }
                }
              }
            } catch (error) {
              lastError = toError(error);
              throw lastError;
            }
          }
        }
      : {}),
    getLastError() {
      return lastError;
    }
  };
}

export function readKnowledgeRagAnswerProviderError(provider: KnowledgeAnswerProvider): Error | undefined {
  const candidate = provider as KnowledgeDomainRagAnswerProvider;
  if (typeof candidate.getLastError === 'function') {
    return candidate.getLastError();
  }
  return undefined;
}

function buildSdkChatMessages(input: KnowledgeAnswerProviderInput) {
  const context = input.contextBundle?.trim() || buildCitationContext(input.citations);

  return [
    {
      role: 'system' as const,
      content: '你是知识库问答助手。必须只基于提供的 citations/context 回答；依据不足时明确说明依据不足。'
    },
    {
      role: 'system' as const,
      name: 'developer',
      content: `Context:\n${context}`
    },
    {
      role: 'user' as const,
      content: input.rewrittenQuery || input.originalQuery
    }
  ];
}

function buildCitationContext(citations: Citation[]): string {
  return citations.length > 0
    ? citations.map((citation, index) => `[${index + 1}] ${formatCitation(citation)}`).join('\n\n')
    : '未检索到可引用片段。';
}

function formatCitation(citation: Citation): string {
  return `${citation.title}\n${citation.quote ?? ''}`.trim();
}

function buildProviderMetadata(generated: { providerId?: string; model?: string }) {
  return Object.fromEntries(
    [
      ['provider', generated.providerId],
      ['model', generated.model]
    ].filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0)
  );
}

function isPresent(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(typeof error === 'string' && error.length > 0 ? error : 'Knowledge answer provider failed.');
}

function isStreamDeltaEvent(value: unknown): value is { type: 'delta'; text: string; metadata?: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'delta' &&
    'text' in value &&
    typeof value.text === 'string'
  );
}

function isStreamDoneEvent(value: unknown): value is {
  type: 'done';
  result?: { text: string; providerId?: string; model?: string };
  metadata?: unknown;
} {
  return typeof value === 'object' && value !== null && 'type' in value && value.type === 'done';
}

function toJsonMetadata(value: unknown): Record<string, KnowledgeRagJsonValue> | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }
  const metadata: Record<string, KnowledgeRagJsonValue> = {};
  for (const [key, item] of Object.entries(value)) {
    if (isJsonValue(item)) {
      metadata[key] = item;
    }
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function isJsonValue(value: unknown): value is KnowledgeRagJsonValue {
  if (value === null) {
    return true;
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return true;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (isPlainRecord(value)) {
    return Object.values(value).every(isJsonValue);
  }
  return false;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
