import {
  TaskStatus,
  type CapabilityAttachmentRecord,
  type CapabilityAugmentationRecord,
  type ChatSessionRecord,
  type ILLMProvider,
  type RequestedExecutionHints
} from '@agent/core';
import { AgentOrchestrator } from '../../orchestration/agent-orchestrator';
import { runSessionDirectReply, shouldUseSessionDirectReply } from './session-coordinator-direct-reply';
import type { DirectReplySearchFn } from './direct-reply-web-search';
import { deriveRequestedHints } from './session-coordinator-routing-hints';
import { SessionCoordinatorStore } from './session-coordinator-store';
import { SessionCoordinatorThinking } from './session-coordinator-thinking';
import type { SessionTaskAggregate } from '../session-task.types';

export {
  deriveRequestedHints,
  deriveSessionTitle,
  generateSessionTitleFromSummary,
  shouldDeriveSessionTitle,
  shouldGenerateSessionTitle
} from './session-coordinator-routing-hints';

export type SessionCoordinatorTurnDeps = {
  orchestrator: AgentOrchestrator;
  store: SessionCoordinatorStore;
  thinking: SessionCoordinatorThinking;
  llmProvider: ILLMProvider;
  syncTask: (sessionId: string, task: SessionTaskAggregate) => void;
  webSearchFn?: DirectReplySearchFn;
};

export async function runSessionTurn(
  deps: SessionCoordinatorTurnDeps,
  sessionId: string,
  input: {
    message: string;
    modelId?: string;
  }
): Promise<void> {
  const session = deps.store.requireSession(sessionId);
  session.status = 'running';
  session.updatedAt = new Date().toISOString();
  await deps.store.persistRuntimeState();

  try {
    await compressConversationIfNeeded(deps, sessionId, input.message);
    if (deps.store.requireSession(sessionId).status === 'cancelled') {
      return;
    }
    const taskContextHints = buildTaskContextHints(deps.store, sessionId, { modelId: input.modelId });
    if (shouldUseSessionDirectReply(input.message, taskContextHints)) {
      await runSessionDirectReply(
        {
          orchestrator: deps.orchestrator,
          store: deps.store,
          thinking: deps.thinking,
          llmProvider: deps.llmProvider,
          syncTask: deps.syncTask,
          webSearchFn: deps.webSearchFn
        },
        sessionId,
        input,
        taskContextHints
      );
      return;
    }
    const conversationContext = await deps.thinking.buildConversationContext(
      deps.store.requireSession(sessionId),
      deps.store.getCheckpoint(sessionId),
      deps.store.getMessages(sessionId),
      input.message
    );
    const task = await deps.orchestrator.createTask({
      goal: input.message,
      context: appendCrossSessionContext(conversationContext, taskContextHints.relatedHistory),
      constraints: [],
      sessionId,
      ...taskContextHints
    });
    if (deps.store.requireSession(sessionId).status === 'cancelled') {
      const cancelledTask = await deps.orchestrator.cancelTask(task.id, '用户已在任务启动前请求终止');
      if (cancelledTask) {
        deps.syncTask(sessionId, cancelledTask);
        await deps.store.persistRuntimeState();
      }
      return;
    }
    deps.syncTask(sessionId, task);
    await deps.store.persistRuntimeState();
  } catch (error) {
    const failedAt = new Date().toISOString();
    const failureMessage = ensureVisibleAssistantFailureMessage(deps.store, sessionId, error);
    session.status = 'failed';
    session.updatedAt = failedAt;
    const checkpoint = deps.store.getCheckpoint(sessionId);
    if (checkpoint) {
      checkpoint.graphState = {
        ...checkpoint.graphState,
        status: TaskStatus.FAILED
      };
      checkpoint.thinkState = {
        title: checkpoint.thinkState?.title ?? '直接回复',
        content: checkpoint.thinkState?.content ?? '当前回复未能完成。',
        messageId: checkpoint.thinkState?.messageId,
        thinkingDurationMs: checkpoint.thinkState?.thinkingDurationMs,
        loading: false,
        blink: false
      };
      checkpoint.streamStatus = undefined;
      checkpoint.updatedAt = failedAt;
      deps.store.checkpoints.set(sessionId, checkpoint);
    }
    deps.store.addEvent(sessionId, 'session_failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    if (failureMessage) {
      deps.store.addEvent(sessionId, 'assistant_message', {
        messageId: failureMessage.id,
        content: failureMessage.content,
        summary: failureMessage.content,
        route: 'error-fallback'
      });
    }
    await deps.store.persistRuntimeState();
  }
}

function ensureVisibleAssistantFailureMessage(store: SessionCoordinatorStore, sessionId: string, error: unknown) {
  const messages = store.getMessages(sessionId);
  let lastUserIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') {
      lastUserIndex = index;
      break;
    }
  }
  const hasAssistantAfterLastUser = messages.slice(lastUserIndex + 1).some(message => message.role === 'assistant');
  if (hasAssistantAfterLastUser) {
    return undefined;
  }

  const errorMessage = error instanceof Error ? error.message : String(error);
  return store.addMessage(
    sessionId,
    'assistant',
    `这轮回复生成失败了。${errorMessage ? `原因：${errorMessage}` : '请稍后重试。'}`,
    'manager'
  );
}

export function buildTaskContextHints(
  store: SessionCoordinatorStore,
  sessionId: string,
  options?: {
    modelId?: string;
  }
): {
  requestedMode?: 'plan' | 'execute' | 'imperial_direct';
  counselorSelector?: {
    strategy: 'user-id' | 'session-ratio' | 'task-type' | 'feature-flag' | 'manual';
    key?: string;
    candidateIds?: string[];
  };
  imperialDirectIntent?: {
    enabled: boolean;
    trigger: 'slash-exec' | 'explicit-direct-execution' | 'known-capability';
    requestedCapability?: string;
    reason?: string;
  };
  requestedHints?: {
    requestedSpecialist?: string;
    requestedSkill?: string;
    requestedConnectorTemplate?: 'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template';
    requestedCapability?: string;
    preferredModelId?: string;
    preferredMode?: 'direct-reply' | 'workflow' | 'research-first';
  };
  capabilityAttachments?: CapabilityAttachmentRecord[];
  capabilityAugmentations?: CapabilityAugmentationRecord[];
  conversationSummary?: string;
  conversationCompression?: ChatSessionRecord['compression'];
  recentTurns?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  relatedHistory?: string[];
} {
  const session = store.requireSession(sessionId);
  const checkpoint = store.getCheckpoint(sessionId);
  const messages = store.getMessages(sessionId);
  const recentTurns = messages
    .filter(message => message.role !== 'system')
    .slice(-6)
    .map(message => ({
      role: message.role,
      content: message.content.trim()
    }))
    .filter(message => message.content);

  const relatedHistory = Array.from(
    new Set(
      [
        checkpoint?.context,
        ...(checkpoint?.learningEvaluation?.notes ?? []).slice(0, 2),
        ...buildRecentSessionCarryover(store, sessionId),
        ...messages
          .slice(Math.max(0, messages.length - 10), Math.max(0, messages.length - 6))
          .map(message => message.content.trim())
      ]
        .map(item => item?.trim())
        .filter(Boolean) as string[]
    )
  ).slice(0, 4);

  const routingHints = deriveRequestedHints(messages.at(-1)?.content ?? '');
  const requestedHints: RequestedExecutionHints | undefined = routingHints
    ? {
        requestedSpecialist: routingHints.requestedSpecialist,
        requestedSkill: routingHints.requestedSkill,
        requestedConnectorTemplate: routingHints.requestedConnectorTemplate,
        requestedCapability: routingHints.requestedCapability,
        preferredMode: routingHints.preferredMode
      }
    : undefined;
  const sessionAttachedSkill = (checkpoint?.capabilityAttachments ?? [])
    .slice()
    .reverse()
    .find(item => item.kind === 'skill' && item.owner.ownerType === 'user-attached' && item.enabled);
  const sessionAttachedConnector = (checkpoint?.capabilityAttachments ?? [])
    .slice()
    .reverse()
    .find(item => item.kind === 'connector' && item.owner.ownerType === 'user-attached');

  return {
    requestedMode: routingHints?.requestedMode,
    counselorSelector: routingHints?.counselorSelector,
    imperialDirectIntent: routingHints?.imperialDirectIntent,
    requestedHints: requestedHints
      ? {
          ...requestedHints,
          preferredModelId: options?.modelId ?? requestedHints.preferredModelId,
          requestedSkill: requestedHints.requestedSkill ?? sessionAttachedSkill?.displayName,
          requestedConnectorTemplate:
            requestedHints.requestedConnectorTemplate ??
            inferConnectorTemplateFromAttachment(sessionAttachedConnector) ??
            inferConnectorTemplateFromAttachment(sessionAttachedSkill)
        }
      : sessionAttachedSkill || sessionAttachedConnector
        ? {
            preferredModelId: options?.modelId,
            requestedSkill: sessionAttachedSkill?.displayName,
            requestedConnectorTemplate:
              inferConnectorTemplateFromAttachment(sessionAttachedConnector) ??
              inferConnectorTemplateFromAttachment(sessionAttachedSkill)
          }
        : options?.modelId
          ? {
              preferredModelId: options.modelId
            }
          : undefined,
    capabilityAttachments: checkpoint?.capabilityAttachments?.length
      ? checkpoint.capabilityAttachments.map(item => ({
          ...item,
          metadata: item.metadata ? { ...item.metadata } : undefined,
          owner: { ...item.owner }
        }))
      : undefined,
    capabilityAugmentations: checkpoint?.capabilityAugmentations?.length
      ? checkpoint.capabilityAugmentations.map(item => ({
          ...item,
          owner: { ...item.owner }
        }))
      : undefined,
    conversationSummary: session.compression?.summary,
    conversationCompression: session.compression
      ? {
          ...session.compression,
          focuses: session.compression.focuses ? [...session.compression.focuses] : undefined,
          keyDeliverables: session.compression.keyDeliverables ? [...session.compression.keyDeliverables] : undefined,
          risks: session.compression.risks ? [...session.compression.risks] : undefined,
          nextActions: session.compression.nextActions ? [...session.compression.nextActions] : undefined,
          supportingFacts: session.compression.supportingFacts ? [...session.compression.supportingFacts] : undefined,
          confirmedPreferences: session.compression.confirmedPreferences
            ? [...session.compression.confirmedPreferences]
            : undefined,
          openLoops: session.compression.openLoops ? [...session.compression.openLoops] : undefined,
          previewMessages: session.compression.previewMessages ? [...session.compression.previewMessages] : undefined
        }
      : undefined,
    recentTurns: recentTurns.length ? recentTurns : undefined,
    relatedHistory: relatedHistory.length ? relatedHistory : undefined
  };
}

function buildRecentSessionCarryover(store: SessionCoordinatorStore, sessionId: string): string[] {
  return store
    .listSessions()
    .filter(session => session.id !== sessionId)
    .slice(0, 3)
    .flatMap(session => {
      const summary = session.compression?.summary?.trim();
      const recentMessages = store
        .getMessages(session.id)
        .filter(message => message.role !== 'system')
        .slice(-4)
        .map(message => message.content.trim())
        .filter(Boolean);
      const fallbackPreview = recentMessages.length ? recentMessages.join('；') : undefined;
      const carryover = summary ?? fallbackPreview;
      if (!carryover) {
        return [];
      }
      return [`前序会话《${session.title}》摘要：${carryover}`];
    });
}

function appendCrossSessionContext(context: string, relatedHistory?: string[]) {
  if (!relatedHistory?.length) {
    return context;
  }
  const crossSessionItems = relatedHistory.filter(item => item.startsWith('前序会话《')).slice(0, 3);
  if (!crossSessionItems.length) {
    return context;
  }
  return [
    '以下是同一用户最近会话的跨会话延续线索，仅在与当前问题直接相关时使用：',
    ...crossSessionItems.map(item => `- ${item}`),
    context
  ]
    .filter(Boolean)
    .join('\n\n');
}

export async function compressConversationIfNeeded(
  deps: Pick<SessionCoordinatorTurnDeps, 'store' | 'thinking'>,
  sessionId: string,
  latestUserInput?: string
): Promise<void> {
  const session = deps.store.requireSession(sessionId);
  const messages = deps.store.getMessages(sessionId);
  const compacted = await deps.thinking.compressConversationIfNeeded(
    session,
    messages,
    payload => {
      deps.store.addEvent(sessionId, 'conversation_compacted', payload);
    },
    latestUserInput
  );
  if (compacted) {
    await deps.store.persistRuntimeState();
  }
}

function inferConnectorTemplateFromAttachment(attachment?: CapabilityAttachmentRecord) {
  if (!attachment) {
    return undefined;
  }
  const contractConnector =
    attachment.metadata?.requiredConnectors?.[0] ?? attachment.metadata?.preferredConnectors?.[0];
  if (
    contractConnector === 'github-mcp-template' ||
    contractConnector === 'browser-mcp-template' ||
    contractConnector === 'lark-mcp-template'
  ) {
    return contractConnector;
  }
  const normalized = `${attachment.id} ${attachment.displayName}`.toLowerCase();
  if (normalized.includes('github')) {
    return 'github-mcp-template' as const;
  }
  if (normalized.includes('browser')) {
    return 'browser-mcp-template' as const;
  }
  if (normalized.includes('lark')) {
    return 'lark-mcp-template' as const;
  }
  return undefined;
}
