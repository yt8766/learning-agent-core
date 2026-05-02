import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useKnowledgeApi } from '../api/knowledge-api-provider';
import type { ChatMessage, ChatRequest, ChatResponse, CreateFeedbackRequest } from '../types/api';

export interface KnowledgeChatResult {
  error: Error | null;
  feedbackMessage: ChatMessage | null;
  loading: boolean;
  reload(): Promise<void>;
  response: ChatResponse | null;
  sendMessage(input: ChatRequest): Promise<ChatResponse | undefined>;
  submitFeedback(messageId: string, input: CreateFeedbackRequest): Promise<ChatMessage | undefined>;
}

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
  const [feedbackMessage, setFeedbackMessage] = useState<ChatMessage | null>(null);
  const [feedbackError, setFeedbackError] = useState<Error | null>(null);

  async function sendMessage(input: ChatRequest) {
    const requestId = chatRequestIdRef.current + 1;
    chatRequestIdRef.current = requestId;
    lastInputRef.current = input;
    setLoading(true);
    setChatError(null);
    try {
      const nextResponse = await api.chat(input);
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
    submitFeedback
  };
}
