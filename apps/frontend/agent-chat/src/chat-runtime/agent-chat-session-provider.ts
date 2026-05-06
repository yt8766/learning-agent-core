import { AbstractChatProvider } from '@ant-design/x-sdk';
import { AbstractXRequestClass } from '@ant-design/x-sdk/es/x-request';

import type { ChatEventRecord, ChatMessageRecord, ChatSessionRecord } from '@/types/chat';
import { LOCAL_USER_EPHEMERAL_SLUG } from '@/hooks/chat-session/chat-session-formatters';
import { debugAgentChat, summarizeDebugEvent, summarizeDebugMessage } from '@/utils/agent-chat-debug';

import { parseAgentChatConversationKey } from './agent-chat-conversations';
import type { AgentChatProviderInput, AgentChatProviderUserMessage } from './agent-chat-provider';

const APPEND_CONTENT_EVENT_TYPES = new Set(['assistant_token', 'final_response_delta']);
const ASSISTANT_CONTENT_EVENT_TYPES = new Set(['assistant_token', 'assistant_message', 'final_response_delta']);

export interface AgentChatSessionProviderChunk {
  event?: ChatEventRecord;
  message: ChatMessageRecord;
  sessionId: string;
}

export interface AgentChatSessionProviderHooks {
  onChunk: (chunk: AgentChatSessionProviderChunk) => void;
  onDone?: (chunk: AgentChatSessionProviderChunk) => void;
  onError?: (error: Error) => void;
}

export interface AgentChatSessionProviderDeps {
  appendMessage: (sessionId: string, message: string, options?: { modelId?: string }) => Promise<unknown>;
  bindStream: (
    stream: EventSource,
    sessionId: string,
    handlers: {
      onDone: () => void;
      onError?: (error: Error) => void;
      onEvent: (event: ChatEventRecord) => void;
    }
  ) => void;
  createSessionStream: (sessionId: string) => EventSource;
  ensureSession: (sessionId: string | undefined, initialUserText?: string) => Promise<ChatSessionRecord>;
  onSessionResolved?: (session: ChatSessionRecord, input: { existingSessionId?: string }) => void;
}

interface AgentChatStreamController {
  aborted: boolean;
  reject: ((error: Error) => void) | null;
  stream: EventSource | null;
}

class AgentChatSessionRequest extends AbstractXRequestClass<
  AgentChatProviderInput,
  AgentChatSessionProviderChunk,
  ChatMessageRecord
> {
  readonly deps: AgentChatSessionProviderDeps;

  private handler: Promise<void> = Promise.resolve();

  private controller: AgentChatStreamController | null = null;

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

  constructor(deps: AgentChatSessionProviderDeps) {
    super('agent-chat://runtime-session', { manual: true });
    this.deps = deps;
  }

  override run(params?: AgentChatProviderInput) {
    if (!params) {
      return;
    }

    abortStreamController(this.controller);
    const controller = createStreamController();
    const responseHeaders = new Headers();
    const chunks: AgentChatSessionProviderChunk[] = [];
    this.requesting = true;
    this.controller = controller;
    this.handler = streamAgentChatSessionProvider(
      this.deps,
      params,
      {
        onChunk: chunk => {
          chunks.push(chunk);
          this.options.callbacks?.onUpdate?.(chunk, responseHeaders);
        }
      },
      controller
    )
      .then(finalChunk => {
        if (chunks.length === 0) {
          chunks.push(finalChunk);
        }
        this.options.callbacks?.onSuccess?.(chunks, responseHeaders);
      })
      .catch(error => {
        if (isAbortError(error)) {
          return;
        }
        const nextError = error instanceof Error ? error : new Error(String(error));
        this.options.callbacks?.onError?.(nextError, undefined, responseHeaders);
      })
      .finally(() => {
        this.requesting = false;
        if (this.controller === controller) {
          this.controller = null;
        }
      });
  }

  override abort() {
    this.requesting = false;
    abortStreamController(this.controller);
  }
}

class AgentChatSessionProvider extends AbstractChatProvider<
  ChatMessageRecord,
  AgentChatProviderInput,
  AgentChatSessionProviderChunk
> {
  private readonly deps: AgentChatSessionProviderDeps;

  constructor(deps: AgentChatSessionProviderDeps) {
    super({
      request: new AgentChatSessionRequest(deps)
    });
    this.deps = deps;
  }

  async sendMessage(input: AgentChatProviderInput, hooks: AgentChatSessionProviderHooks) {
    return streamAgentChatSessionProvider(this.deps, input, hooks);
  }

  transformParams(requestParams: Partial<AgentChatProviderInput>) {
    return {
      conversationKey: String(requestParams.conversationKey ?? ''),
      messages: requestParams.messages ?? []
    };
  }

  transformLocalMessage(requestParams: Partial<AgentChatProviderInput>) {
    const latestUserMessage = getLatestUserMessage(requestParams.messages);
    return createUserMessageRecord({
      content: latestUserMessage.content,
      sessionId: parseAgentChatConversationKey(String(requestParams.conversationKey ?? '')) ?? '',
      messageId: createEphemeralMessageId(LOCAL_USER_EPHEMERAL_SLUG)
    });
  }

  transformMessage({
    chunk,
    originMessage
  }: {
    chunk?: AgentChatSessionProviderChunk;
    chunks?: AgentChatSessionProviderChunk[];
    originMessage?: ChatMessageRecord;
  }) {
    return chunk?.message ?? originMessage ?? createAssistantMessageRecord('', '');
  }
}

export function createAgentChatSessionProvider(deps: AgentChatSessionProviderDeps) {
  return new AgentChatSessionProvider(deps);
}

async function streamAgentChatSessionProvider(
  deps: AgentChatSessionProviderDeps,
  input: AgentChatProviderInput,
  hooks: AgentChatSessionProviderHooks,
  controller?: AgentChatStreamController
) {
  const latestUserMessage = getLatestUserMessage(input.messages);
  const existingSessionId = parseAgentChatConversationKey(input.conversationKey);
  const session = await deps.ensureSession(existingSessionId, latestUserMessage.content);
  deps.onSessionResolved?.(session, { existingSessionId });
  throwIfStreamAborted(controller);

  let currentMessage = createAssistantMessageRecord(session.id, createEphemeralMessageId(`assistant-${session.id}`));
  let latestChunk: AgentChatSessionProviderChunk = {
    message: currentMessage,
    sessionId: session.id
  };

  if (existingSessionId && latestUserMessage.content) {
    const appendResult = await deps.appendMessage(session.id, latestUserMessage.content, {
      modelId: latestUserMessage.modelId
    });
    throwIfStreamAborted(controller);
    const pendingInteractionChunk = createPendingInteractionReplyChunk(session.id, appendResult);
    if (pendingInteractionChunk) {
      latestChunk = pendingInteractionChunk;
      currentMessage = pendingInteractionChunk.message;
      hooks.onChunk(latestChunk);
      hooks.onDone?.(latestChunk);
      return latestChunk;
    }
  }

  const stream = deps.createSessionStream(session.id);
  if (controller) {
    controller.stream = stream;
  }

  return new Promise<AgentChatSessionProviderChunk>((resolve, reject) => {
    if (controller) {
      controller.reject = reject;
    }
    if (controller?.aborted) {
      stream.close();
      reject(createAbortError());
      return;
    }
    deps.bindStream(stream, session.id, {
      onEvent(event) {
        if (controller?.aborted) {
          return;
        }
        debugAgentChat('session-provider.stream-event', summarizeDebugEvent(event));
        currentMessage = foldProviderEvent(currentMessage, event);
        debugAgentChat('session-provider.current-message', summarizeDebugMessage(currentMessage));
        latestChunk = {
          event,
          message: currentMessage,
          sessionId: session.id
        };
        hooks.onChunk(latestChunk);
      },
      onDone() {
        if (controller?.aborted) {
          return;
        }
        hooks.onDone?.(latestChunk);
        resolve(latestChunk);
      },
      onError(error) {
        if (controller?.aborted) {
          return;
        }
        hooks.onError?.(error);
        reject(error);
      }
    });
  });
}

function createAssistantMessageRecord(sessionId: string, messageId: string, content = ''): ChatMessageRecord {
  return {
    id: messageId,
    sessionId,
    role: 'assistant',
    content,
    createdAt: new Date().toISOString()
  };
}

function createUserMessageRecord({
  content,
  messageId,
  sessionId
}: {
  content: string;
  messageId: string;
  sessionId: string;
}): ChatMessageRecord {
  return {
    id: messageId,
    sessionId,
    role: 'user',
    content,
    createdAt: new Date().toISOString()
  };
}

function createEphemeralMessageId(prefix: string) {
  return `${prefix}_${Date.now()}`;
}

function getLatestUserMessage(messages?: AgentChatProviderInput['messages']) {
  const latestUserMessage = [...(messages ?? [])]
    .reverse()
    .find((message): message is AgentChatProviderUserMessage => message.role === 'user');

  return {
    content: latestUserMessage?.content?.trim() ?? '',
    modelId: latestUserMessage?.modelId
  };
}

function foldProviderEvent(currentMessage: ChatMessageRecord, event: ChatEventRecord) {
  if (!ASSISTANT_CONTENT_EVENT_TYPES.has(event.type)) {
    return currentMessage;
  }

  const content = typeof event.payload?.content === 'string' ? event.payload.content : '';
  if (!content) {
    return currentMessage;
  }

  const nextMessageId =
    typeof event.payload?.messageId === 'string' && event.payload.messageId.trim()
      ? event.payload.messageId
      : currentMessage.id;

  return {
    ...currentMessage,
    id: nextMessageId,
    sessionId: event.sessionId || currentMessage.sessionId,
    content: mergeAssistantContent(currentMessage.content, content, APPEND_CONTENT_EVENT_TYPES.has(event.type))
  };
}

function createPendingInteractionReplyChunk(
  sessionId: string,
  appendResult: unknown
): AgentChatSessionProviderChunk | undefined {
  if (!isRecord(appendResult) || appendResult.handledAs !== 'pending_interaction_reply') {
    return undefined;
  }

  const action = readPendingInteractionAction(appendResult);
  return {
    sessionId,
    message: createAssistantMessageRecord(
      sessionId,
      createEphemeralMessageId(`assistant-interaction-${sessionId}`),
      getPendingInteractionReplyContent(action)
    )
  };
}

function readPendingInteractionAction(appendResult: Record<string, unknown>) {
  const interactionResolution = appendResult.interactionResolution;
  if (!isRecord(interactionResolution)) {
    return 'unknown';
  }
  const intent = interactionResolution.intent;
  if (!isRecord(intent) || typeof intent.action !== 'string') {
    return 'unknown';
  }
  return intent.action;
}

function getPendingInteractionReplyContent(action: string) {
  switch (action) {
    case 'approve':
      return '已收到确认，正在继续原运行。';
    case 'reject':
      return '已取消这次执行。';
    case 'feedback':
      return '已收到反馈，正在按反馈恢复。';
    default:
      return '还需要更明确的确认或拒绝，请直接回复确认语或取消。';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeAssistantContent(currentContent: string, incomingContent: string, append: boolean) {
  if (!append) {
    return incomingContent;
  }
  if (!currentContent) {
    return incomingContent;
  }
  if (incomingContent.startsWith(currentContent)) {
    return incomingContent;
  }
  if (currentContent.endsWith(incomingContent)) {
    return currentContent;
  }
  return `${currentContent}${incomingContent}`;
}

function createAbortError() {
  const error = new Error('Agent chat request aborted');
  error.name = 'AbortError';
  return error;
}

function createStreamController(): AgentChatStreamController {
  return {
    aborted: false,
    reject: null,
    stream: null
  };
}

function abortStreamController(controller: AgentChatStreamController | null) {
  if (!controller || controller.aborted) {
    return;
  }

  controller.aborted = true;
  controller.stream?.close();
  controller.reject?.(createAbortError());
}

function throwIfStreamAborted(controller?: AgentChatStreamController) {
  if (controller?.aborted) {
    throw createAbortError();
  }
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}
