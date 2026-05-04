import type { KnowledgeFrontendApi } from '../../api/knowledge-api-provider';
import type { ChatConversation, ChatMessage, KnowledgeChatStreamState } from '../../types/api';
import type { ChatLabConversation } from './chat-lab-helpers';

type StreamState = KnowledgeChatStreamState;

export function formatStreamPhase(phase: StreamState['phase']) {
  if (phase === 'planner') {
    return '正在选库';
  }
  if (phase === 'retrieval') {
    return '正在检索';
  }
  if (phase === 'answer') {
    return '正在生成';
  }
  if (phase === 'completed') {
    return '已完成';
  }
  if (phase === 'error') {
    return '生成失败';
  }
  return '准备中';
}

export function toChatLabConversation(conversation: ChatConversation): ChatLabConversation {
  return {
    id: conversation.id,
    title: conversation.title,
    activeModelProfileId: conversation.activeModelProfileId,
    persisted: true,
    messages: [],
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt
  };
}

export async function loadKnowledgeConversationMessages(api: KnowledgeFrontendApi, conversationId: string) {
  const result = await api.listConversationMessages(conversationId);
  return result.items;
}

export function mergeChatMessages(
  backendMessages: readonly ChatMessage[],
  currentMessages: readonly ChatMessage[]
): ChatMessage[] {
  const merged = new Map<string, ChatMessage>();
  for (const message of currentMessages) {
    merged.set(message.id, message);
  }
  for (const message of backendMessages) {
    merged.set(message.id, message);
  }
  return [...merged.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function summarizeStreamDiagnostics(events: StreamState['events']) {
  const plannerEvent = [...events].reverse().find(event => event.type === 'planner.completed');
  const retrievalEvent = [...events].reverse().find(event => event.type === 'retrieval.completed');
  const plan = plannerEvent?.type === 'planner.completed' ? plannerEvent.plan : undefined;
  const retrieval = retrievalEvent?.type === 'retrieval.completed' ? retrievalEvent.retrieval : undefined;
  const diagnostics = toDiagnosticRecord(retrieval?.diagnostics);
  const executedQuery = toExecutedQuery(diagnostics.executedQueries);
  const finalHitCount =
    typeof diagnostics.finalHitCount === 'number' ? diagnostics.finalHitCount : retrieval?.hits.length;
  const hasRetrievalDiagnostics = Object.keys(diagnostics).length > 0;
  if (!plan && !hasRetrievalDiagnostics && typeof finalHitCount !== 'number') {
    return undefined;
  }
  return {
    confidence: typeof plan?.confidence === 'number' ? plan.confidence.toFixed(2) : undefined,
    executedQuery: executedQuery
      ? `${executedQuery.query} · ${executedQuery.mode} · ${executedQuery.hitCount}`
      : undefined,
    finalHitCount,
    planner: plan?.diagnostics.planner,
    retrievalMode: typeof diagnostics.effectiveSearchMode === 'string' ? diagnostics.effectiveSearchMode : undefined,
    searchMode: plan?.searchMode,
    selectionReason: plan?.selectionReason
  };
}

export function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function toDiagnosticRecord(diagnostics: unknown): Record<string, unknown> {
  return typeof diagnostics === 'object' && diagnostics !== null ? (diagnostics as Record<string, unknown>) : {};
}

function toExecutedQuery(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const first = value[0];
  if (typeof first === 'string') {
    return { hitCount: 0, mode: 'query', query: first };
  }
  if (typeof first !== 'object' || first === null) {
    return undefined;
  }
  const record = first as Record<string, unknown>;
  if (typeof record.query !== 'string') {
    return undefined;
  }
  return {
    hitCount: typeof record.hitCount === 'number' ? record.hitCount : 0,
    mode: typeof record.mode === 'string' ? record.mode : 'query',
    query: record.query
  };
}
