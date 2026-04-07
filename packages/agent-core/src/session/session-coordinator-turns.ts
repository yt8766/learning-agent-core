import {
  CapabilityAttachmentRecord,
  CapabilityAugmentationRecord,
  ChatSessionRecord,
  TaskRecord,
  TaskStatus
} from '@agent/shared';
import { AgentOrchestrator } from '../graphs/main/main.graph';
import { SessionCoordinatorStore } from './session-coordinator-store';
import { SessionCoordinatorThinking } from './session-coordinator-thinking';

type SessionCoordinatorTurnDeps = {
  orchestrator: AgentOrchestrator;
  store: SessionCoordinatorStore;
  thinking: SessionCoordinatorThinking;
  syncTask: (sessionId: string, task: TaskRecord) => void;
};

export async function runSessionTurn(
  deps: SessionCoordinatorTurnDeps,
  sessionId: string,
  input: string
): Promise<void> {
  const session = deps.store.requireSession(sessionId);
  session.status = 'running';
  session.updatedAt = new Date().toISOString();
  await deps.store.persistRuntimeState();

  try {
    await compressConversationIfNeeded(deps, sessionId, input);
    if (deps.store.requireSession(sessionId).status === 'cancelled') {
      return;
    }
    const taskContextHints = buildTaskContextHints(deps.store, sessionId);
    const conversationContext = await deps.thinking.buildConversationContext(
      deps.store.requireSession(sessionId),
      deps.store.getCheckpoint(sessionId),
      deps.store.getMessages(sessionId),
      input
    );
    const task = await deps.orchestrator.createTask({
      goal: input,
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
    session.status = 'failed';
    session.updatedAt = new Date().toISOString();
    deps.store.addEvent(sessionId, 'session_failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    await deps.store.persistRuntimeState();
  }
}

export function buildTaskContextHints(
  store: SessionCoordinatorStore,
  sessionId: string
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
  const requestedHints = routingHints
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
          requestedSkill: requestedHints.requestedSkill ?? sessionAttachedSkill?.displayName,
          requestedConnectorTemplate:
            requestedHints.requestedConnectorTemplate ??
            inferConnectorTemplateFromAttachment(sessionAttachedConnector) ??
            inferConnectorTemplateFromAttachment(sessionAttachedSkill)
        }
      : sessionAttachedSkill || sessionAttachedConnector
        ? {
            requestedSkill: sessionAttachedSkill?.displayName,
            requestedConnectorTemplate:
              inferConnectorTemplateFromAttachment(sessionAttachedConnector) ??
              inferConnectorTemplateFromAttachment(sessionAttachedSkill)
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

function deriveRequestedHints(input: string) {
  const raw = input.trim();
  if (!raw) {
    return undefined;
  }

  const requestedConnectorTemplate = /github.*(mcp|connector)/i.test(raw)
    ? ('github-mcp-template' as const)
    : /browser.*(mcp|connector)/i.test(raw)
      ? ('browser-mcp-template' as const)
      : /lark.*(mcp|connector)/i.test(raw)
        ? ('lark-mcp-template' as const)
        : undefined;

  const requestedSpecialist = /技术架构|architecture/i.test(raw)
    ? 'technical-architecture'
    : /风控|合规|compliance/i.test(raw)
      ? 'risk-compliance'
      : /支付|payment/i.test(raw)
        ? 'payment-channel'
        : /产品策略|product/i.test(raw)
          ? 'product-strategy'
          : undefined;

  const requestedSkillMatch = raw.match(/(?:skill|技能)\s*[:：]?\s*([a-zA-Z0-9._-]+)/i);
  const imperialDirect = /^\/exec\b/i.test(raw) || /直接执行|立即执行/.test(raw);
  const preferredMode = /研究后|research/i.test(raw)
    ? ('research-first' as const)
    : /workflow|完整流程|走流程/i.test(raw)
      ? ('workflow' as const)
      : /direct-reply|直接回答/i.test(raw)
        ? ('direct-reply' as const)
        : undefined;

  if (
    !requestedConnectorTemplate &&
    !requestedSpecialist &&
    !requestedSkillMatch &&
    !preferredMode &&
    !imperialDirect
  ) {
    return undefined;
  }

  return {
    requestedSpecialist,
    requestedSkill: requestedSkillMatch?.[1],
    requestedConnectorTemplate,
    requestedCapability: requestedConnectorTemplate ?? requestedSkillMatch?.[1],
    preferredMode,
    requestedMode: imperialDirect
      ? ('imperial_direct' as const)
      : /^\/plan[-\w]*/i.test(raw)
        ? ('plan' as const)
        : undefined,
    counselorSelector: {
      strategy: requestedSpecialist ? ('manual' as const) : ('task-type' as const),
      key: requestedSpecialist ?? requestedSkillMatch?.[1],
      candidateIds: requestedSpecialist ? [requestedSpecialist] : undefined
    },
    imperialDirectIntent: imperialDirect
      ? {
          enabled: true,
          trigger: /^\/exec\b/i.test(raw)
            ? ('slash-exec' as const)
            : requestedSkillMatch?.[1]
              ? ('known-capability' as const)
              : ('explicit-direct-execution' as const),
          requestedCapability: requestedConnectorTemplate ?? requestedSkillMatch?.[1],
          reason: '用户明确要求跳过票拟，直接进入执行。'
        }
      : undefined
  };
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

export function shouldDeriveSessionTitle(title?: string) {
  const normalized = title?.trim();
  return !normalized || normalized === '新会话';
}

export function deriveSessionTitle(message: string) {
  const normalized = message
    .trim()
    .replace(/^\/(?:browse|review|qa|ship|plan-ceo-review|plan-eng-review)\b\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return '';
  }

  return normalized.slice(0, 48);
}
