import { useEffect, useMemo, useState } from 'react';

import type { ChatPendingInteraction, ChatViewCloseEvent, ChatViewStreamEvent } from '@agent/core';

import {
  CHAT_VIEW_STREAM_EVENT_TYPES,
  createChatViewStream,
  parseChatViewStreamEvent
} from '@/api/chat-runtime-v2-api';
import type { ChatMessageRecord } from '@/types/chat';

export interface ChatViewStreamFragmentState {
  id: string;
  messageId: string;
  content: string;
}

export interface ChatViewStreamCloseState {
  reason: ChatViewCloseEvent['data']['reason'];
  retryable?: boolean;
  autoResume?: boolean;
}

export interface ChatViewStreamState {
  status: 'idle' | 'connecting' | 'open' | 'waiting_interaction' | 'error' | 'closed';
  sessionId?: string;
  runId?: string;
  requestMessageId?: string;
  responseMessageId?: string;
  lastSeq?: number;
  messages: ChatMessageRecord[];
  fragments: Record<string, ChatViewStreamFragmentState>;
  pendingInteraction?: ChatPendingInteraction;
  error?: {
    code: string;
    message: string;
    recoverable?: boolean;
  };
  close?: ChatViewStreamCloseState;
}

export interface ChatViewStreamReducerOptions {
  now?: () => string;
  onClose?: (close: ChatViewStreamCloseState) => void;
}

export interface UseChatViewStreamOptions {
  sessionId?: string;
  runId?: string;
  afterSeq?: number;
  enabled?: boolean;
  onClose?: (close: ChatViewStreamCloseState) => void;
  onInvalidEvent?: () => void;
}

export function createInitialChatViewStreamState(): ChatViewStreamState {
  return {
    status: 'idle',
    messages: [],
    fragments: {}
  };
}

export function applyChatViewStreamEvent(
  state: ChatViewStreamState,
  event: ChatViewStreamEvent,
  options: ChatViewStreamReducerOptions = {}
): ChatViewStreamState {
  const baseState = {
    ...state,
    sessionId: event.sessionId,
    runId: event.runId,
    lastSeq: event.seq
  };

  switch (event.event) {
    case 'ready': {
      const responseMessageId = event.data.responseMessageId ?? state.responseMessageId;
      return {
        ...baseState,
        status: 'open',
        requestMessageId: event.data.requestMessageId,
        responseMessageId,
        messages: responseMessageId
          ? upsertAssistantMessage(baseState.messages, {
              id: responseMessageId,
              sessionId: event.sessionId,
              content: '',
              createdAt: options.now?.() ?? event.at
            })
          : baseState.messages
      };
    }

    case 'fragment_delta': {
      const fragment = state.fragments[event.data.fragmentId];
      const nextContent = `${fragment?.content ?? ''}${event.data.delta}`;
      const nextFragments = {
        ...state.fragments,
        [event.data.fragmentId]: {
          id: event.data.fragmentId,
          messageId: event.data.messageId,
          content: nextContent
        }
      };

      return {
        ...baseState,
        status: state.status === 'idle' || state.status === 'connecting' ? 'open' : state.status,
        fragments: nextFragments,
        messages: upsertAssistantMessage(baseState.messages, {
          id: event.data.messageId,
          sessionId: event.sessionId,
          content: nextContent,
          createdAt: event.at
        })
      };
    }

    case 'interaction_waiting':
      return {
        ...baseState,
        status: 'waiting_interaction',
        pendingInteraction: event.data.interaction
      };

    case 'error':
      return {
        ...baseState,
        status: 'error',
        error: event.data
      };

    case 'close': {
      const close = {
        reason: event.data.reason,
        retryable: event.data.retryable,
        autoResume: event.data.autoResume
      };
      const nextState = {
        ...baseState,
        status: 'closed' as const,
        close
      };
      options.onClose?.(close);
      return nextState;
    }

    default:
      return baseState;
  }
}

export function useChatViewStream(options: UseChatViewStreamOptions) {
  const [state, setState] = useState<ChatViewStreamState>(() => createInitialChatViewStreamState());
  const isV2StreamEnabled = Boolean(options.enabled ?? true) && Boolean(options.sessionId && options.runId);

  useEffect(() => {
    if (!isV2StreamEnabled || !options.sessionId || !options.runId) {
      return undefined;
    }

    setState(current => ({
      ...current,
      status: 'connecting',
      sessionId: options.sessionId,
      runId: options.runId
    }));

    const stream = createChatViewStream({
      sessionId: options.sessionId,
      runId: options.runId,
      afterSeq: options.afterSeq
    });
    if (!stream) {
      return undefined;
    }

    const handleMessage = (raw: MessageEvent<string>) => {
      const event = parseChatViewStreamEvent(raw.data);
      if (!event) {
        options.onInvalidEvent?.();
        return;
      }
      setState(current => applyChatViewStreamEvent(current, event, { onClose: options.onClose }));
    };

    for (const eventType of CHAT_VIEW_STREAM_EVENT_TYPES) {
      stream.addEventListener(eventType, handleMessage as EventListener);
    }

    stream.onerror = () => {
      setState(current => ({
        ...current,
        status: 'error',
        error: {
          code: 'VIEW_STREAM_DISCONNECTED',
          message: 'chat view stream disconnected',
          recoverable: true
        }
      }));
      stream.close();
    };

    return () => {
      for (const eventType of CHAT_VIEW_STREAM_EVENT_TYPES) {
        stream.removeEventListener(eventType, handleMessage as EventListener);
      }
      stream.close();
    };
  }, [isV2StreamEnabled, options.afterSeq, options.onClose, options.onInvalidEvent, options.runId, options.sessionId]);

  return useMemo(
    () => ({
      state,
      isV2StreamEnabled
    }),
    [isV2StreamEnabled, state]
  );
}

function upsertAssistantMessage(
  messages: ChatMessageRecord[],
  input: {
    id: string;
    sessionId: string;
    content: string;
    createdAt: string;
  }
) {
  const existingIndex = messages.findIndex(message => message.id === input.id);
  if (existingIndex < 0) {
    return [
      ...messages,
      {
        id: input.id,
        sessionId: input.sessionId,
        role: 'assistant' as const,
        content: input.content,
        createdAt: input.createdAt
      }
    ];
  }

  return messages.map((message, index) =>
    index === existingIndex
      ? {
          ...message,
          content: input.content
        }
      : message
  );
}
