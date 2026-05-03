import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useKnowledgeApi } from '../api/knowledge-api-provider';
import type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  CreateFeedbackRequest,
  KnowledgeChatStreamState,
  KnowledgeRagStreamEvent
} from '../types/api';

export interface KnowledgeChatResult {
  error: Error | null;
  feedbackMessage: ChatMessage | null;
  loading: boolean;
  reload(): Promise<void>;
  response: ChatResponse | null;
  sendMessage(input: ChatRequest): Promise<ChatResponse | undefined>;
  streamState: KnowledgeChatStreamState;
  submitFeedback(messageId: string, input: CreateFeedbackRequest): Promise<ChatMessage | undefined>;
}

const initialStreamState: KnowledgeChatStreamState = {
  answerText: '',
  citations: [],
  events: [],
  phase: 'idle'
};

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function useKnowledgeChat(): KnowledgeChatResult {
  const api = useKnowledgeApi();
  const queryClient = useQueryClient();
  const mountedRef = useRef(true);
  const lastInputRef = useRef<ChatRequest | null>(null);
  const chatRequestIdRef = useRef(0);
  const feedbackRequestIdRef = useRef(0);
  const [response, setResponse] = useState<ChatResponse | null>(null);
  const [chatError, setChatError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [streamState, setStreamState] = useState<KnowledgeChatStreamState>(initialStreamState);
  const [feedbackMessage, setFeedbackMessage] = useState<ChatMessage | null>(null);
  const [feedbackError, setFeedbackError] = useState<Error | null>(null);

  async function sendMessage(input: ChatRequest) {
    const requestId = chatRequestIdRef.current + 1;
    chatRequestIdRef.current = requestId;
    lastInputRef.current = input;
    setLoading(true);
    setChatError(null);
    setStreamState(initialStreamState);
    try {
      const nextResponse = input.stream ? await sendStreamingMessage(input, requestId) : await api.chat(input);
      if (!mountedRef.current || requestId !== chatRequestIdRef.current) {
        return undefined;
      }
      queryClient.setQueryData(['knowledge', 'chat', nextResponse.conversationId], nextResponse);
      setResponse(nextResponse);
      setLoading(false);
      return nextResponse;
    } catch (error) {
      if (mountedRef.current && requestId === chatRequestIdRef.current) {
        setChatError(toError(error));
        setLoading(false);
      }
      return undefined;
    }
  }

  async function sendStreamingMessage(input: ChatRequest, requestId: number): Promise<ChatResponse> {
    let answerText = '';
    let completedResponse: ChatResponse | undefined;
    for await (const event of api.streamChat({ ...input, stream: true })) {
      if (!mountedRef.current || requestId !== chatRequestIdRef.current) {
        continue;
      }
      if (event.type === 'answer.delta') {
        answerText += event.delta;
      }
      if (event.type === 'answer.completed') {
        answerText = event.answer.text;
      }
      completedResponse = toChatResponse(input, event, completedResponse, answerText);
      setStreamState(current => ({
        answerText,
        citations: completedResponse?.citations ?? current.citations,
        events: [...current.events, event],
        phase: toStreamPhase(event),
        runId: event.runId
      }));
      if (event.type === 'rag.error') {
        throw new Error(event.error.message);
      }
    }
    if (!completedResponse) {
      throw new Error('Knowledge chat stream completed without an answer.');
    }
    return completedResponse;
  }

  async function submitFeedback(messageId: string, input: CreateFeedbackRequest) {
    const requestId = feedbackRequestIdRef.current + 1;
    feedbackRequestIdRef.current = requestId;
    if (mountedRef.current) {
      setFeedbackError(null);
    }
    try {
      const nextFeedbackMessage = await api.createFeedback(messageId, input);
      if (!mountedRef.current || requestId !== feedbackRequestIdRef.current) {
        return undefined;
      }
      queryClient.setQueryData(['knowledge', 'message-feedback', nextFeedbackMessage.id], nextFeedbackMessage);
      setFeedbackMessage(nextFeedbackMessage);
      return nextFeedbackMessage;
    } catch (error) {
      if (mountedRef.current && requestId === feedbackRequestIdRef.current) {
        setFeedbackError(toError(error));
      }
      return undefined;
    }
  }

  async function reload() {
    if (lastInputRef.current) {
      await sendMessage(lastInputRef.current);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    error: chatError ?? feedbackError,
    feedbackMessage,
    loading,
    reload,
    response,
    sendMessage,
    streamState,
    submitFeedback
  };
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

function toChatResponse(
  input: ChatRequest,
  event: KnowledgeRagStreamEvent,
  previous: ChatResponse | undefined,
  answerText: string
): ChatResponse {
  const conversationId = input.metadata?.conversationId ?? input.conversationId ?? event.runId;
  const createdAt = new Date().toISOString();
  const userContent = latestUserContent(input);
  if (event.type === 'answer.completed') {
    const citations = normalizeSdkCitations(event.answer.citations);
    return {
      conversationId,
      answer: event.answer.text,
      citations,
      traceId: event.runId,
      userMessage: previous?.userMessage ?? {
        id: `local_user_${event.runId}`,
        conversationId,
        role: 'user',
        content: userContent,
        createdAt
      },
      assistantMessage: {
        id: `stream_assistant_${event.runId}`,
        conversationId,
        role: 'assistant',
        content: event.answer.text,
        citations,
        traceId: event.runId,
        createdAt
      }
    };
  }
  if (event.type === 'rag.completed') {
    const citations = normalizeSdkCitations(event.result.answer.citations);
    return {
      conversationId,
      answer: event.result.answer.text,
      citations,
      traceId: event.runId,
      diagnostics: {
        normalizedQuery: event.result.plan.rewrittenQuery ?? event.result.plan.originalQuery,
        queryVariants: event.result.plan.queryVariants,
        retrievalMode: event.result.plan.searchMode,
        hitCount: event.result.retrieval.hits.length,
        contextChunkCount: event.result.retrieval.citations.length
      },
      userMessage: previous?.userMessage ?? {
        id: `local_user_${event.runId}`,
        conversationId,
        role: 'user',
        content: userContent,
        createdAt
      },
      assistantMessage: {
        id: `stream_assistant_${event.runId}`,
        conversationId,
        role: 'assistant',
        content: event.result.answer.text,
        citations,
        diagnostics: {
          normalizedQuery: event.result.plan.rewrittenQuery ?? event.result.plan.originalQuery,
          queryVariants: event.result.plan.queryVariants,
          retrievalMode: event.result.plan.searchMode,
          hitCount: event.result.retrieval.hits.length,
          contextChunkCount: event.result.retrieval.citations.length
        },
        traceId: event.runId,
        createdAt
      }
    };
  }
  return (
    previous ?? {
      conversationId,
      answer: answerText,
      citations: [],
      traceId: event.runId,
      userMessage: {
        id: `local_user_${event.runId}`,
        conversationId,
        role: 'user',
        content: userContent,
        createdAt
      },
      assistantMessage: {
        id: `stream_assistant_${event.runId}`,
        conversationId,
        role: 'assistant',
        content: answerText,
        createdAt
      }
    }
  );
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
      id: item.sourceId ? `${item.sourceId}:${item.chunkId ?? index}` : `citation_${index}`,
      documentId: item.sourceId ?? item.chunkId ?? `document_${index}`,
      chunkId: item.chunkId ?? `chunk_${index}`,
      title: item.title ?? '知识来源',
      uri: item.uri,
      quote: item.quote ?? '',
      score: typeof (item as { score?: unknown }).score === 'number' ? (item as { score: number }).score : undefined
    };
  });
}

function latestUserContent(input: ChatRequest): string {
  if (input.message) {
    return input.message;
  }
  const message = [...(input.messages ?? [])].reverse().find(item => item.role === 'user');
  if (!message) {
    return '';
  }
  if (typeof message.content === 'string') {
    return message.content;
  }
  return message.content
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('\n');
}
