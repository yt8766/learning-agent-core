import { AbstractChatProvider } from '@ant-design/x-sdk';
import { AbstractXRequestClass } from '@ant-design/x-sdk/es/x-request';

import type { ChatEventRecord, ChatSessionRecord } from '@/types/chat';

import { parseAgentChatConversationKey } from './agent-chat-conversations';
import { foldAgentChatRuntimeEvent } from './agent-chat-event-adapter';
import type { AgentChatRuntimeEvent, AgentFrontendChatMessage } from './agent-chat-types';

const APPEND_CONTENT_EVENT_TYPES = new Set(['assistant_token', 'final_response_delta']);
const ASSISTANT_CONTENT_EVENT_TYPES = new Set(['assistant_token', 'assistant_message', 'final_response_delta']);

export interface AgentChatProviderUserMessage {
  content: string;
  modelId?: string;
  role: 'user';
}

export interface AgentChatProviderRuntimeMessage {
  content: string;
  role: 'assistant' | 'system';
}

export type AgentChatProviderMessage = AgentChatProviderRuntimeMessage | AgentChatProviderUserMessage;

export interface AgentChatProviderInput {
  conversationKey: string;
  messages: AgentChatProviderMessage[];
}

export interface AgentChatProviderChunk {
  event?: ChatEventRecord;
  message: AgentFrontendChatMessage;
  sessionId: string;
}

export interface AgentChatProviderHooks {
  onAssistantPlaceholder?: (info: { message: AgentFrontendChatMessage; sessionId: string }) => void;
  onChunk: (chunk: AgentChatProviderChunk) => void;
  onDone?: (chunk: AgentChatProviderChunk) => void;
  onError?: (error: Error) => void;
}

export interface AgentChatProviderDeps {
  appendMessage: (sessionId: string, message: string, options?: { modelId?: string }) => Promise<unknown>;
  bindStream: (
    stream: EventSource,
    handlers: {
      onDone: () => void;
      onError?: (error: Error) => void;
      onEvent: (event: ChatEventRecord) => void;
    }
  ) => void;
  createSessionStream: (sessionId: string) => EventSource;
  ensureSession: (sessionId: string | undefined, initialUserText?: string) => Promise<ChatSessionRecord>;
  projectRuntimeEvent?: (event: ChatEventRecord) => AgentChatRuntimeEvent | undefined;
}

interface AgentChatStreamController {
  aborted: boolean;
  reject: ((error: Error) => void) | null;
  stream: EventSource | null;
}

class AgentChatRequest extends AbstractXRequestClass<
  AgentChatProviderInput,
  AgentChatProviderChunk,
  AgentFrontendChatMessage
> {
  readonly deps: AgentChatProviderDeps;

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

  constructor(deps: AgentChatProviderDeps) {
    super('agent-chat://runtime', { manual: true });
    this.deps = deps;
  }

  override run(params?: AgentChatProviderInput) {
    if (!params) {
      return;
    }

    this.controller?.stream?.close();
    const controller = createStreamController();
    const responseHeaders = new Headers();
    const chunks: AgentChatProviderChunk[] = [];
    this.requesting = true;
    this.controller = controller;
    this.handler = streamAgentChatProvider(
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

class AgentChatProvider extends AbstractChatProvider<
  AgentFrontendChatMessage,
  AgentChatProviderInput,
  AgentChatProviderChunk
> {
  private readonly deps: AgentChatProviderDeps;

  constructor(deps: AgentChatProviderDeps) {
    super({
      request: new AgentChatRequest(deps)
    });
    this.deps = deps;
  }

  async sendMessage(input: AgentChatProviderInput, hooks: AgentChatProviderHooks) {
    return streamAgentChatProvider(this.deps, input, hooks);
  }

  transformParams(requestParams: Partial<AgentChatProviderInput>) {
    return {
      conversationKey: String(requestParams.conversationKey ?? ''),
      messages: requestParams.messages ?? []
    };
  }

  transformLocalMessage(requestParams: Partial<AgentChatProviderInput>) {
    return {
      role: 'user',
      content: getLatestUserMessage(requestParams.messages).content,
      kind: 'text'
    } satisfies AgentFrontendChatMessage;
  }

  transformMessage({
    chunk,
    originMessage
  }: {
    chunk?: AgentChatProviderChunk;
    chunks?: AgentChatProviderChunk[];
    originMessage?: AgentFrontendChatMessage;
  }) {
    return chunk?.message ?? originMessage ?? createAssistantPlaceholderMessage();
  }
}

export function createAgentChatProvider(deps: AgentChatProviderDeps) {
  return new AgentChatProvider(deps);
}

async function streamAgentChatProvider(
  deps: AgentChatProviderDeps,
  input: AgentChatProviderInput,
  hooks: AgentChatProviderHooks,
  controller?: AgentChatStreamController
) {
  const latestUserMessage = getLatestUserMessage(input.messages);
  const initialUserText = latestUserMessage.content;
  const existingSessionId = parseAgentChatConversationKey(input.conversationKey);
  const session = await deps.ensureSession(existingSessionId, initialUserText);
  throwIfStreamAborted(controller);
  let currentMessage = createAssistantPlaceholderMessage();
  let latestChunk: AgentChatProviderChunk = {
    message: currentMessage,
    sessionId: session.id
  };

  hooks.onAssistantPlaceholder?.({
    message: currentMessage,
    sessionId: session.id
  });

  if (existingSessionId && initialUserText) {
    await deps.appendMessage(session.id, initialUserText, {
      modelId: latestUserMessage.modelId
    });
    throwIfStreamAborted(controller);
  }

  const stream = deps.createSessionStream(session.id);
  if (controller) {
    controller.stream = stream;
  }

  return new Promise<AgentChatProviderChunk>((resolve, reject) => {
    if (controller) {
      controller.reject = reject;
    }
    if (controller?.aborted) {
      stream.close();
      reject(createAbortError());
      return;
    }
    deps.bindStream(stream, {
      onEvent(event) {
        if (controller?.aborted) {
          return;
        }
        currentMessage = foldProviderEvent(currentMessage, event, deps.projectRuntimeEvent);
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

function createAssistantPlaceholderMessage(): AgentFrontendChatMessage {
  return {
    role: 'assistant',
    content: '',
    kind: 'mixed',
    meta: {}
  };
}

function getLatestUserMessage(messages?: AgentChatProviderInput['messages']) {
  const latestUserMessage = [...(messages ?? [])].reverse().find((message): message is AgentChatProviderUserMessage => {
    return message.role === 'user';
  });

  return {
    content: latestUserMessage?.content?.trim() ?? '',
    modelId: latestUserMessage?.modelId
  };
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

function foldProviderEvent(
  currentMessage: AgentFrontendChatMessage,
  event: ChatEventRecord,
  projectRuntimeEvent?: (event: ChatEventRecord) => AgentChatRuntimeEvent | undefined
) {
  let nextMessage = currentMessage;
  const content = typeof event.payload?.content === 'string' ? event.payload.content : '';
  if (ASSISTANT_CONTENT_EVENT_TYPES.has(event.type) && content) {
    nextMessage = {
      ...nextMessage,
      content: mergeAssistantContent(nextMessage.content, content, APPEND_CONTENT_EVENT_TYPES.has(event.type))
    };
  }

  const runtimeEvent = projectRuntimeEvent?.(event) ?? defaultProjectRuntimeEvent(event);
  if (!runtimeEvent) {
    return nextMessage;
  }

  return foldAgentChatRuntimeEvent({
    currentMessage: nextMessage,
    event: runtimeEvent
  });
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

function defaultProjectRuntimeEvent(event: ChatEventRecord): AgentChatRuntimeEvent | undefined {
  const thinkState = normalizeThinkState(event.payload?.thinkState);
  const thoughtChain = normalizeThoughtChain(event.payload?.thoughtChain);
  const responseSteps = normalizeResponseSteps(event.payload?.responseSteps);
  if (!thinkState && !thoughtChain && !responseSteps) {
    return undefined;
  }

  return {
    type: event.type,
    thinkState,
    thoughtChain,
    responseSteps
  };
}

function normalizeThinkState(value: unknown): AgentChatRuntimeEvent['thinkState'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const thinkState = value as Record<string, unknown>;
  return {
    loading: Boolean(thinkState.loading),
    messageId: typeof thinkState.messageId === 'string' ? thinkState.messageId : undefined,
    thinkingDurationMs: typeof thinkState.thinkingDurationMs === 'number' ? thinkState.thinkingDurationMs : undefined
  };
}

function normalizeThoughtChain(value: unknown): AgentChatRuntimeEvent['thoughtChain'] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value
    .map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return undefined;
      }
      const record = item as Record<string, unknown>;
      const id = typeof record.id === 'string' ? record.id : undefined;
      const title = typeof record.title === 'string' ? record.title : undefined;
      if (!id || !title) {
        return undefined;
      }
      return { id, title };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return items.length > 0 ? items : undefined;
}

function normalizeResponseSteps(value: unknown): AgentChatRuntimeEvent['responseSteps'] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value
    .map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return undefined;
      }
      const record = item as Record<string, unknown>;
      const id = typeof record.id === 'string' ? record.id : undefined;
      const label = typeof record.label === 'string' ? record.label : undefined;
      if (!id || !label) {
        return undefined;
      }
      return { id, label };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return items.length > 0 ? items : undefined;
}
