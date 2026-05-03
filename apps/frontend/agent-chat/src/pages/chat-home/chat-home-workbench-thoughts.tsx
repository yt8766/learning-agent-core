import type { ChatEventRecord } from '@/types/chat';
import type { WorkbenchThoughtProjectionItem } from '@/types/workbench-thought-projection';
import type { useChatSession } from '@/hooks/use-chat-session';
import {
  projectAgentToolGovernanceProjectionToTimeline,
  type AgentToolGovernanceProjectionLike,
  type AgentToolProjectedEvent,
  type AgentToolProjectedEventStatus
} from '@/lib/agent-tool-event-projections';
import { resolveProjectedEventThoughtStatus } from '@/lib/chat-trajectory-projections';
import { mapThoughtChainToProjectionItems } from '@/lib/map-thought-chain-to-projection';
import { formatSessionTime } from '@/hooks/use-chat-session';
import { EVENT_LABELS, buildEventSummary, humanizeOperationalCopy } from './chat-home-helpers';

const COGNITION_EXCLUDED_EVENT_TYPES = new Set([
  'assistant_token',
  'final_response_delta',
  'final_response_completed',
  'assistant_message',
  'session_finished',
  'user_message'
]);

export function shouldIncludeEventInThoughtLog(type: string): boolean {
  return !COGNITION_EXCLUDED_EVENT_TYPES.has(type);
}

function shouldUseNarrativeDirectReplyThoughtChain(
  checkpoint: ReturnType<typeof useChatSession>['checkpoint']
): boolean {
  if (!checkpoint?.thoughtChain?.length) {
    return false;
  }
  if (checkpoint.chatRoute?.flow !== 'direct-reply') {
    return false;
  }
  return checkpoint.thoughtChain.some(
    item => item.kind === 'reasoning' || item.kind === 'web_search' || item.kind === 'browser'
  );
}

type ChatSessionWithGovernanceProjection = ReturnType<typeof useChatSession> & {
  agentToolGovernanceProjection?: AgentToolGovernanceProjectionLike | null;
};

export function buildThoughtItems(chat: ReturnType<typeof useChatSession>): WorkbenchThoughtProjectionItem[] {
  const capabilityThought = buildCapabilityThoughtItem(chat);
  const streamStatusThought = buildStreamStatusThoughtItem(chat);
  const recentCompletedNodeThoughts = buildRecentCompletedNodeThoughtItems(chat);
  const toolGovernanceThoughts = buildToolGovernanceThoughtItems(chat);
  const optimisticThought = buildOptimisticThoughtItem(chat);

  if (optimisticThought) {
    return [
      streamStatusThought,
      ...recentCompletedNodeThoughts,
      capabilityThought,
      ...toolGovernanceThoughts,
      optimisticThought
    ].filter(Boolean) as WorkbenchThoughtProjectionItem[];
  }

  if (shouldUseNarrativeDirectReplyThoughtChain(chat.checkpoint)) {
    const activeMessageId = chat.checkpoint!.thinkState?.messageId;
    const chain = chat.checkpoint!.thoughtChain ?? [];
    const scopedThoughtChain =
      activeMessageId && chain.some(item => item.messageId === activeMessageId)
        ? chain.filter(item => !item.messageId || item.messageId === activeMessageId)
        : chain;
    return [...mapThoughtChainToProjectionItems(scopedThoughtChain), ...buildSyntheticWebSearchItems(chat)].filter(
      Boolean
    ) as WorkbenchThoughtProjectionItem[];
  }

  if (chat.checkpoint?.thoughtChain?.length) {
    const activeMessageId = chat.checkpoint.thinkState?.messageId;
    const scopedThoughtChain =
      activeMessageId && chat.checkpoint.thoughtChain.some(item => item.messageId === activeMessageId)
        ? chat.checkpoint.thoughtChain.filter(item => !item.messageId || item.messageId === activeMessageId)
        : chat.checkpoint.thoughtChain;
    const items = mapThoughtChainToProjectionItems(scopedThoughtChain);

    return [
      streamStatusThought,
      ...recentCompletedNodeThoughts,
      capabilityThought,
      ...toolGovernanceThoughts,
      ...items,
      ...buildSyntheticWebSearchItems(chat)
    ].filter(Boolean) as WorkbenchThoughtProjectionItem[];
  }

  const items = chat.events
    .slice()
    .reverse()
    .filter(eventItem => shouldIncludeEventInThoughtLog(eventItem.type))
    .map(eventItem => {
      const payload = eventItem.payload ?? {};
      const nodeRaw =
        typeof payload.node === 'string' ? payload.node : typeof payload.nodeId === 'string' ? payload.nodeId : '';
      const meta = [
        typeof payload.from === 'string' ? `来源：${payload.from}` : '',
        nodeRaw ? `节点：${humanizeOperationalCopy(nodeRaw)}` : '',
        typeof payload.intent === 'string' ? `意图：${payload.intent}` : '',
        typeof payload.decision === 'string' ? `结果：${payload.decision}` : ''
      ]
        .filter(Boolean)
        .join(' · ');

      return {
        key: eventItem.id,
        title: humanizeOperationalCopy(EVENT_LABELS[eventItem.type] ?? eventItem.type),
        description: buildEventSummary(eventItem),
        footer: meta || formatSessionTime(eventItem.at),
        status: resolveThoughtItemStatus(eventItem),
        collapsible: Boolean(meta)
      };
    });

  return [
    streamStatusThought,
    ...recentCompletedNodeThoughts,
    capabilityThought,
    ...toolGovernanceThoughts,
    ...items
  ].filter(Boolean) as WorkbenchThoughtProjectionItem[];
}

function buildToolGovernanceThoughtItems(chat: ReturnType<typeof useChatSession>): WorkbenchThoughtProjectionItem[] {
  const projection = (chat as ChatSessionWithGovernanceProjection).agentToolGovernanceProjection;
  if (!projection) {
    return [];
  }

  return projectAgentToolGovernanceProjectionToTimeline(projection)
    .slice(-4)
    .reverse()
    .map(eventItem => ({
      key: `tool-governance-${eventItem.requestId}-${eventItem.kind}-${eventItem.title}`,
      title: humanizeOperationalCopy(eventItem.title),
      description: buildToolGovernanceThoughtDescription(eventItem),
      footer: eventItem.toolName ?? eventItem.nodeId ?? eventItem.requestId,
      status: resolveToolGovernanceThoughtStatus(eventItem.status),
      collapsible: Boolean(eventItem.summary || eventItem.riskClass)
    }));
}

function buildToolGovernanceThoughtDescription(eventItem: AgentToolProjectedEvent) {
  return [eventItem.summary, eventItem.riskClass ? `风险：${eventItem.riskClass}` : ''].filter(Boolean).join(' · ');
}

function resolveToolGovernanceThoughtStatus(status: AgentToolProjectedEventStatus) {
  if (status === 'failed' || status === 'cancelled' || status === 'denied' || status === 'blocked') {
    return 'error' as const;
  }
  if (status === 'succeeded' || status === 'resumed') {
    return 'success' as const;
  }
  return 'loading' as const;
}

function resolveThoughtItemStatus(eventItem: ChatEventRecord) {
  const eventType = eventItem.type;
  const projectedStatus = resolveProjectedEventThoughtStatus(eventItem);
  if (
    eventType === 'execution_step_started' ||
    eventType === 'execution_step_completed' ||
    eventType === 'execution_step_blocked' ||
    eventType === 'execution_step_resumed' ||
    eventType === 'trajectory_step' ||
    eventType === 'task_trajectory' ||
    (eventType === 'node_progress' && eventItem.payload?.projection === 'task_trajectory')
  ) {
    return projectedStatus;
  }

  if (
    eventType === 'session_failed' ||
    eventType === 'approval_rejected_with_feedback' ||
    eventType === 'interrupt_rejected_with_feedback'
  ) {
    return 'error' as const;
  }

  if (
    eventType === 'session_started' ||
    eventType === 'user_message' ||
    eventType === 'assistant_message' ||
    eventType === 'final_response_completed' ||
    eventType === 'session_finished' ||
    eventType === 'approval_resolved' ||
    eventType === 'interrupt_resumed' ||
    eventType === 'learning_confirmed' ||
    eventType === 'review_completed' ||
    eventType === 'skill_stage_completed'
  ) {
    return 'success' as const;
  }

  return 'loading' as const;
}

function buildOptimisticThoughtItem(
  chat: ReturnType<typeof useChatSession>
): WorkbenchThoughtProjectionItem | undefined {
  const checkpoint = chat.checkpoint;
  if (!checkpoint?.thinkState?.loading || !checkpoint.taskId?.startsWith('optimistic_')) {
    return undefined;
  }

  return {
    key: `optimistic-think-${checkpoint.taskId}`,
    title: humanizeOperationalCopy(checkpoint.thinkState.title),
    description: humanizeOperationalCopy(checkpoint.thinkState.content),
    footer: '正在准备这轮回复',
    status: 'loading',
    collapsible: false,
    blink: true
  };
}

function buildStreamStatusThoughtItem(
  chat: ReturnType<typeof useChatSession>
): WorkbenchThoughtProjectionItem | undefined {
  const streamStatus = chat.checkpoint?.streamStatus;
  if (!streamStatus) {
    return undefined;
  }

  const summary = buildNodeStreamCognitionSummary(streamStatus);
  if (!summary) {
    return undefined;
  }

  return {
    key: `stream-status-${chat.checkpoint?.taskId ?? chat.activeSessionId ?? 'current'}`,
    title: streamStatus.nodeLabel ?? '当前节点',
    description: summary,
    footer: streamStatus.updatedAt ? formatSessionTime(streamStatus.updatedAt) : undefined,
    status:
      typeof streamStatus.progressPercent === 'number' && streamStatus.progressPercent >= 100 ? 'success' : 'loading',
    collapsible: false,
    blink: true
  };
}

function buildRecentCompletedNodeThoughtItems(
  chat: ReturnType<typeof useChatSession>
): WorkbenchThoughtProjectionItem[] {
  const currentNodeId = chat.checkpoint?.streamStatus?.nodeId;
  return chat.events
    .filter(eventItem => eventItem.type === 'node_status' && eventItem.payload?.phase === 'end')
    .slice()
    .reverse()
    .map(eventItem => {
      const payload = eventItem.payload ?? {};
      const nodeId = typeof payload.nodeId === 'string' ? payload.nodeId : '';
      const nodeLabel = typeof payload.nodeLabel === 'string' ? payload.nodeLabel : nodeId || '节点';
      const detail = typeof payload.detail === 'string' ? payload.detail : '';
      const progressPercent = typeof payload.progressPercent === 'number' ? payload.progressPercent : undefined;
      return {
        key: `node-complete-${eventItem.id}`,
        nodeId,
        item: {
          key: `node-complete-${eventItem.id}`,
          title: nodeLabel,
          description: buildNodeStreamCognitionSummary({ nodeLabel, detail, progressPercent }) ?? (detail || '已完成'),
          footer: formatSessionTime(eventItem.at),
          status: 'success' as const,
          collapsible: false
        }
      };
    })
    .filter(entry => !currentNodeId || entry.nodeId !== currentNodeId)
    .slice(0, 3)
    .map(entry => entry.item);
}

function buildNodeStreamCognitionSummary(streamStatus?: {
  nodeLabel?: string;
  detail?: string;
  progressPercent?: number;
}) {
  if (!streamStatus) {
    return undefined;
  }

  const segments = [
    typeof streamStatus.nodeLabel === 'string' ? streamStatus.nodeLabel : '',
    typeof streamStatus.detail === 'string' ? streamStatus.detail : '',
    typeof streamStatus.progressPercent === 'number' ? `进度 ${streamStatus.progressPercent}%` : ''
  ].filter(Boolean);

  if (!segments.length) {
    return undefined;
  }

  const source = segments.join(' · ');
  const normalized = source.replace(/\s+/g, ' ').trim();
  const firstSentence = normalized.split(/[。！？\n]/)[0]?.trim() || normalized;

  if (firstSentence.length <= 26) {
    return firstSentence;
  }

  return `${firstSentence.slice(0, 26).trimEnd()}...`;
}

function buildCapabilityThoughtItem(
  chat: ReturnType<typeof useChatSession>
): WorkbenchThoughtProjectionItem | undefined {
  const checkpoint = chat.checkpoint;
  if (!checkpoint) {
    return undefined;
  }

  const usedSkills = checkpoint.usedInstalledSkills ?? [];
  const workers = checkpoint.usedCompanyWorkers ?? [];
  const connectors = checkpoint.connectorRefs ?? [];
  const pendingSkill =
    checkpoint.pendingApproval?.intent === 'install_skill'
      ? checkpoint.pendingApproval.preview?.find(item => item.label === 'Skill')?.value
      : checkpoint.activeInterrupt?.kind === 'skill-install'
        ? checkpoint.activeInterrupt.preview?.find(item => item.label === 'Skill')?.value
        : undefined;
  const missingConnector =
    checkpoint.skillSearch?.mcpRecommendation?.kind === 'connector' &&
    !connectors.length &&
    checkpoint.skillSearch.mcpRecommendation.connectorTemplateId
      ? formatConnectorLabel(checkpoint.skillSearch.mcpRecommendation.connectorTemplateId)
      : undefined;

  const summaryParts = [
    usedSkills.length ? `已复用 ${usedSkills.slice(0, 3).join('、')}` : '',
    workers.length ? `已调用 ${workers.slice(0, 2).join('、')}` : '',
    connectors.length ? `已接入 ${connectors.slice(0, 2).join('、')}` : '',
    pendingSkill ? `等待安装 ${pendingSkill}` : '',
    missingConnector ? `未接入 ${missingConnector}，按现有能力继续` : '',
    checkpoint.currentWorker ? `当前由 ${checkpoint.currentWorker} 推进` : ''
  ].filter(Boolean);

  if (!summaryParts.length) {
    return undefined;
  }

  const details = [
    usedSkills.length ? `Skills: ${usedSkills.join(', ')}` : '',
    workers.length ? `Workers: ${workers.join(', ')}` : '',
    connectors.length ? `MCP / Connectors: ${connectors.join(', ')}` : '',
    pendingSkill ? `Pending install: ${pendingSkill}` : '',
    missingConnector ? `Capability gap: ${missingConnector}` : ''
  ]
    .filter(Boolean)
    .join('\n');

  return {
    key: `capability-${checkpoint.taskId}`,
    title: '能力链路',
    description: summaryParts.join(' · '),
    content: details ? <pre className="chatx-thought-raw">{details}</pre> : undefined,
    footer: checkpoint.updatedAt ? formatSessionTime(checkpoint.updatedAt) : undefined,
    status:
      pendingSkill || checkpoint.graphState?.status === 'running'
        ? 'loading'
        : checkpoint.graphState?.status === 'failed'
          ? 'error'
          : 'success',
    collapsible: Boolean(details)
  };
}

function buildSyntheticWebSearchItems(chat: ReturnType<typeof useChatSession>): WorkbenchThoughtProjectionItem[] {
  const sources = chat.checkpoint?.externalSources ?? [];
  const webSources = sources.filter(s => s.sourceType === 'web' && s.sourceUrl);
  if (!webSources.length) {
    return [];
  }

  const alreadyHasSearchChain = chat.checkpoint?.thoughtChain?.some(item => item.kind === 'web_search');
  if (alreadyHasSearchChain) {
    return [];
  }

  const hits = webSources.slice(0, 6).map(s => {
    let host = '';
    try {
      host = new URL(s.sourceUrl!).hostname;
    } catch {
      /* ignore */
    }
    return { url: s.sourceUrl!, title: s.summary, host };
  });

  return [
    {
      key: `synthetic-web-search-${chat.checkpoint?.taskId ?? 'unknown'}`,
      title: '搜索网页',
      description: `搜索到 ${webSources.length} 个网页`,
      status: 'success' as const,
      itemVariant: 'web_search' as const,
      hits
    }
  ];
}

function formatConnectorLabel(templateId: 'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template') {
  switch (templateId) {
    case 'github-mcp-template':
      return 'GitHub MCP';
    case 'browser-mcp-template':
      return 'Browser MCP';
    case 'lark-mcp-template':
      return 'Lark MCP';
    default:
      return templateId;
  }
}
