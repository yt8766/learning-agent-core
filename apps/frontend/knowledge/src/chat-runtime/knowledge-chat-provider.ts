import { AbstractChatProvider } from '@ant-design/x-sdk';
import { AbstractXRequestClass } from '@ant-design/x-sdk/es/x-request';

import type { KnowledgeFrontendApi } from '@/api/knowledge-api-provider';
import type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  Citation,
  KnowledgeChatStreamState,
  KnowledgeRagStreamEvent
} from '@/types/api';

export interface KnowledgeChatProviderInput {
  conversationId: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  metadata?: ChatRequest['metadata'];
  model?: string;
  stream?: boolean;
}

export interface KnowledgeChatProviderChunk {
  content: string;
  createdAt: string;
  citations?: Citation[];
  diagnostics?: ChatResponse['diagnostics'];
  route?: ChatResponse['route'];
  traceId?: string;
}

class KnowledgeChatRequest extends AbstractXRequestClass<
  KnowledgeChatProviderInput,
  KnowledgeChatProviderChunk,
  ChatMessage
> {
  private readonly api: KnowledgeFrontendApi;

  private readonly callbacks?: {
    onStreamEvent?: (event: KnowledgeRagStreamEvent) => void;
    onStreamStateChange?: (streamState: KnowledgeChatStreamState) => void;
  };

  private handler: Promise<void> = Promise.resolve();

  private requesting = false;

  override get asyncHandler() {
    return this.handler;
  }

  override get isTimeout() {
    return false;
  }

  override get isStreamTimeout() {
    return false;
  }

  override get isRequesting() {
    return this.requesting;
  }

  override get manual() {
    return true;
  }

  constructor(
    api: KnowledgeFrontendApi,
    callbacks?: {
      onStreamEvent?: (event: KnowledgeRagStreamEvent) => void;
      onStreamStateChange?: (streamState: KnowledgeChatStreamState) => void;
    }
  ) {
    super('knowledge://chat-lab', { manual: true });
    this.api = api;
    this.callbacks = callbacks;
  }

  override run(params?: KnowledgeChatProviderInput) {
    if (!params) {
      return;
    }

    const responseHeaders = new Headers();
    const createdAt = new Date().toISOString();
    const events: KnowledgeRagStreamEvent[] = [];
    let answerText = '';
    let citations: Citation[] = [];
    let diagnostics: ChatResponse['diagnostics'] | undefined;
    let route: ChatResponse['route'] | undefined;
    let traceId: string | undefined;

    this.requesting = true;
    this.handler = (async () => {
      try {
        for await (const event of this.stream(params)) {
          events.push(event);
          traceId = event.runId;
          this.callbacks?.onStreamEvent?.(event);
          this.callbacks?.onStreamStateChange?.({
            answerText,
            citations,
            events: [...events],
            phase: toStreamPhase(event),
            runId: event.runId
          });

          if (event.type === 'answer.delta') {
            answerText += event.delta;
            this.options.callbacks?.onUpdate?.(
              {
                content: answerText,
                createdAt,
                traceId
              },
              responseHeaders
            );
            continue;
          }

          if (event.type === 'answer.completed') {
            answerText = event.answer.text;
            citations = normalizeSdkCitations(event.answer.citations);
            this.options.callbacks?.onUpdate?.(
              {
                citations,
                content: answerText,
                createdAt,
                traceId
              },
              responseHeaders
            );
            continue;
          }

          if (event.type === 'rag.completed') {
            answerText = event.result.answer.text;
            citations = normalizeSdkCitations(event.result.answer.citations);
            diagnostics = {
              contextChunkCount: event.result.retrieval.citations.length,
              hitCount: event.result.retrieval.hits.length,
              normalizedQuery: event.result.plan.rewrittenQuery ?? event.result.plan.originalQuery,
              queryVariants: event.result.plan.queryVariants,
              retrievalMode: event.result.plan.searchMode
            };
            this.callbacks?.onStreamStateChange?.({
              answerText,
              citations,
              events: [...events],
              phase: 'completed',
              runId: event.runId
            });
            this.options.callbacks?.onSuccess?.(
              [
                {
                  citations,
                  content: answerText,
                  createdAt,
                  diagnostics,
                  route,
                  traceId
                }
              ],
              responseHeaders
            );
            return;
          }

          if (event.type === 'rag.error') {
            const error = new Error(event.error.message);
            this.callbacks?.onStreamStateChange?.({
              answerText,
              citations,
              events: [...events],
              phase: 'error',
              runId: event.runId
            });
            this.options.callbacks?.onError?.(error, event, responseHeaders);
            return;
          }
        }

        // Fallback for streams that end on answer.completed without rag.completed.
        this.options.callbacks?.onSuccess?.(
          [
            {
              citations,
              content: answerText,
              createdAt,
              diagnostics,
              route,
              traceId
            }
          ],
          responseHeaders
        );
      } catch (error) {
        const nextError = error instanceof Error ? error : new Error(String(error));
        this.options.callbacks?.onError?.(nextError, undefined, responseHeaders);
      } finally {
        this.requesting = false;
      }
    })();
  }

  override abort() {
    this.requesting = false;
  }

  async *stream(params: KnowledgeChatProviderInput) {
    yield* this.api.streamChat({
      messages: params.messages,
      metadata: params.metadata,
      model: params.model,
      stream: true
    });
  }
}

class KnowledgeChatProvider extends AbstractChatProvider<
  ChatMessage,
  KnowledgeChatProviderInput,
  KnowledgeChatProviderChunk
> {
  async sendMessage(
    input: KnowledgeChatProviderInput,
    hooks: {
      onChunk: (chunk: { content: string }) => void;
    }
  ) {
    let content = '';
    const request = this.request as KnowledgeChatRequest;
    for await (const event of request.stream(input)) {
      if (event.type === 'answer.delta') {
        content += event.delta;
        hooks.onChunk({ content });
      }
      if (event.type === 'answer.completed') {
        if (event.answer.text !== content) {
          content = event.answer.text;
          hooks.onChunk({ content });
        }
        return event.answer;
      }
    }
    throw new Error('Knowledge stream completed without answer.completed');
  }

  transformParams(requestParams: Partial<KnowledgeChatProviderInput>) {
    return {
      conversationId: String(requestParams.conversationId ?? ''),
      messages: requestParams.messages ?? [],
      metadata: requestParams.metadata,
      model: requestParams.model,
      stream: true
    };
  }

  transformLocalMessage(requestParams: Partial<KnowledgeChatProviderInput>) {
    const content = requestParams.messages?.at(-1)?.content ?? '';
    return {
      content,
      conversationId: String(requestParams.conversationId ?? ''),
      createdAt: new Date().toISOString(),
      id: `local_user_${Date.now()}`,
      role: 'user'
    } satisfies ChatMessage;
  }

  transformMessage({
    chunk,
    chunks,
    originMessage
  }: {
    chunk?: KnowledgeChatProviderChunk;
    chunks?: KnowledgeChatProviderChunk[];
    originMessage?: ChatMessage;
  }) {
    const latestChunk = chunk ?? chunks?.at(-1);
    return {
      citations: latestChunk?.citations ?? originMessage?.citations,
      content: latestChunk?.content ?? originMessage?.content ?? '',
      conversationId: originMessage?.conversationId ?? '',
      createdAt: latestChunk?.createdAt ?? originMessage?.createdAt ?? new Date().toISOString(),
      diagnostics: latestChunk?.diagnostics ?? originMessage?.diagnostics,
      id:
        originMessage?.id ??
        `stream_assistant_${latestChunk?.traceId ?? 'local'}_${latestChunk?.createdAt ?? Date.now()}`,
      role: 'assistant',
      route: latestChunk?.route ?? originMessage?.route,
      traceId: latestChunk?.traceId ?? originMessage?.traceId
    } satisfies ChatMessage;
  }
}

export function createKnowledgeChatProvider({
  api,
  onStreamEvent,
  onStreamStateChange
}: {
  api: KnowledgeFrontendApi;
  onStreamEvent?: (event: KnowledgeRagStreamEvent) => void;
  onStreamStateChange?: (streamState: KnowledgeChatStreamState) => void;
}) {
  return new KnowledgeChatProvider({
    request: new KnowledgeChatRequest(api, { onStreamEvent, onStreamStateChange })
  });
}

function toStreamPhase(event: KnowledgeRagStreamEvent): KnowledgeChatStreamState['phase'] {
  if (event.type.startsWith('planner.')) {
    return 'planner';
  }
  if (event.type.startsWith('retrieval.')) {
    return 'retrieval';
  }
  if (event.type.startsWith('answer.')) {
    return 'answer';
  }
  if (event.type === 'rag.completed') {
    return 'completed';
  }
  if (event.type === 'rag.error') {
    return 'error';
  }
  return 'idle';
}

function normalizeSdkCitations(
  citations: KnowledgeRagStreamEvent extends infer Event
    ? Event extends { answer: { citations: infer Citations } }
      ? Citations
      : Event extends { result: { answer: { citations: infer Citations } } }
        ? Citations
        : never
    : never
): ChatResponse['citations'] {
  return (Array.isArray(citations) ? citations : []).map((citation, index) => {
    const item = citation as {
      chunkId?: string;
      quote?: string;
      sourceId?: string;
      title?: string;
      uri?: string;
    };
    return {
      chunkId: item.chunkId ?? `chunk_${index}`,
      documentId: item.sourceId ?? item.chunkId ?? `document_${index}`,
      id: item.sourceId ? `${item.sourceId}:${item.chunkId ?? index}` : `citation_${index}`,
      quote: item.quote ?? '',
      score: typeof (item as { score?: unknown }).score === 'number' ? (item as { score: number }).score : undefined,
      title: item.title ?? '知识来源',
      uri: item.uri
    };
  });
}
