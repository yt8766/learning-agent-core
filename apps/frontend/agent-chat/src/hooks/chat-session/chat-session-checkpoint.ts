import type { ChatCheckpointRecord, ChatMessageRecord, ChatSessionRecord, ChatSessionStatus } from '@/types/chat';

import { mergeOrAppendMessage } from './chat-session-events';

// checkpoint.activeInterrupt is the persisted 司礼监 / InterruptController projection for chat-session compatibility.
export function syncCheckpointMessages(
  current: ChatMessageRecord[],
  checkpoint: ChatCheckpointRecord | undefined,
  sessionId: string
) {
  if (!checkpoint || !sessionId) {
    return current;
  }

  let nextMessages = stripCheckpointMessages(current, checkpoint.taskId);
  for (const message of buildCheckpointMessages(checkpoint, sessionId)) {
    nextMessages = mergeOrAppendMessage(nextMessages, message);
  }

  return nextMessages;
}

export function deriveSessionStatusFromCheckpoint(
  checkpoint: ChatCheckpointRecord | undefined,
  fallback: ChatSessionStatus = 'idle'
): ChatSessionStatus {
  if (!checkpoint) {
    return fallback;
  }

  if (
    checkpoint.pendingApprovals?.length ||
    checkpoint.pendingApproval ||
    checkpoint.activeInterrupt?.status === 'pending'
  ) {
    return checkpoint.activeInterrupt?.kind === 'user-input' ? 'waiting_interrupt' : 'waiting_approval';
  }

  if (checkpoint.graphState?.status === 'failed') {
    return 'failed';
  }

  if (checkpoint.graphState?.status === 'cancelled') {
    return 'cancelled';
  }

  if (checkpoint.graphState?.status === 'completed') {
    return 'completed';
  }

  if (checkpoint.graphState?.status === 'blocked' && checkpoint.graphState?.currentStep?.includes('learning')) {
    return 'waiting_learning_confirmation';
  }

  if (checkpoint.graphState?.status === 'running' || checkpoint.graphState?.status === 'queued') {
    return 'running';
  }

  return fallback;
}

export function syncSessionFromCheckpoint(
  sessions: ChatSessionRecord[],
  checkpoint: ChatCheckpointRecord | undefined
): ChatSessionRecord[] {
  if (!checkpoint) {
    return sessions;
  }

  return sessions.map(session =>
    session.id === checkpoint.sessionId
      ? {
          ...session,
          currentTaskId: checkpoint.taskId,
          status: deriveSessionStatusFromCheckpoint(checkpoint, session.status),
          updatedAt: checkpoint.updatedAt
        }
      : session
  );
}

function buildCheckpointMessages(checkpoint: ChatCheckpointRecord, sessionId: string): ChatMessageRecord[] {
  const messages: ChatMessageRecord[] = [];
  const suppressIntermediateCards = shouldSuppressIntermediateCheckpointCards(checkpoint);
  const llmFallbackNotes = (checkpoint.agentStates ?? [])
    .flatMap(state => state.observations ?? [])
    .filter(note => note.startsWith('LLM '));
  const citationSources = (checkpoint.externalSources ?? []).filter(isCitationSource);
  const decoratedSuggestions = checkpoint.skillSearch?.suggestions
    .slice(0, 5)
    .map(suggestion => attachRuntimeSkillInstallState(checkpoint, suggestion));
  const runtimeSkillSuggestion = decoratedSuggestions?.find(suggestion => suggestion.installState);

  if (citationSources.length) {
    messages.push({
      id: `checkpoint_sources_${checkpoint.taskId}`,
      sessionId,
      role: 'system',
      content: `本轮已收集 ${citationSources.length} 条来源引用。`,
      card: {
        type: 'evidence_digest',
        sources: citationSources.slice(0, 6).map(source => ({
          id: source.id,
          sourceType: source.sourceType,
          sourceUrl: source.sourceUrl,
          trustClass: source.trustClass,
          summary: source.summary,
          fetchedAt: source.fetchedAt,
          detail: source.detail
        }))
      },
      createdAt: checkpoint.updatedAt
    });
  }

  if (
    checkpoint.skillSearch &&
    !suppressIntermediateCards &&
    (checkpoint.skillSearch.capabilityGapDetected || checkpoint.skillSearch.suggestions.length)
  ) {
    const capabilityNotice = buildCapabilityControlNotice(checkpoint, runtimeSkillSuggestion);
    if (capabilityNotice) {
      messages.push({
        id: `checkpoint_capability_notice_${checkpoint.taskId}`,
        sessionId,
        role: 'system',
        content: capabilityNotice.content,
        card: {
          type: 'control_notice',
          tone: capabilityNotice.tone,
          label: capabilityNotice.label
        },
        createdAt: checkpoint.updatedAt
      });
    }
  }

  const significantReusedSkills = (checkpoint.reusedSkills ?? []).filter(
    item => normalizeReusedSkill(item) !== 'general'
  );
  if (
    significantReusedSkills.length ||
    checkpoint.usedInstalledSkills?.length ||
    checkpoint.usedCompanyWorkers?.length
  ) {
    messages.push({
      id: `checkpoint_skills_${checkpoint.taskId}`,
      sessionId,
      role: 'system',
      content: '本轮已复用既有技能和公司专员。',
      card: {
        type: 'skill_reuse',
        reusedSkills: significantReusedSkills,
        usedInstalledSkills: checkpoint.usedInstalledSkills ?? [],
        usedCompanyWorkers: checkpoint.usedCompanyWorkers ?? []
      },
      createdAt: checkpoint.updatedAt
    });
  }

  if (llmFallbackNotes.length) {
    messages.push({
      id: `checkpoint_runtime_issue_${checkpoint.taskId}`,
      sessionId,
      role: 'system',
      content: '本轮模型调用未正常返回，当前回复已回退到兜底内容。',
      card: {
        type: 'runtime_issue',
        severity: 'warning',
        title: 'LLM Direct Reply Fallback',
        notes: llmFallbackNotes.slice(0, 3)
      },
      createdAt: checkpoint.updatedAt
    });
  }

  if (checkpoint.currentWorker || checkpoint.currentMinistry) {
    const dispatchNotice = buildDispatchControlNotice(checkpoint);
    if (dispatchNotice) {
      messages.push({
        id: `checkpoint_dispatch_notice_${checkpoint.taskId}`,
        sessionId,
        role: 'system',
        content: dispatchNotice,
        card: {
          type: 'control_notice',
          tone: 'neutral',
          label: '执行更新'
        },
        createdAt: checkpoint.updatedAt
      });
    }
  }

  return messages;
}

function stripCheckpointMessages(current: ChatMessageRecord[], taskId: string) {
  const checkpointPrefix = `checkpoint_`;
  const taskSuffix = `_${taskId}`;
  return current.filter(
    message =>
      !(message.role === 'system' && message.id.startsWith(checkpointPrefix) && message.id.endsWith(taskSuffix))
  );
}

function shouldSuppressIntermediateCheckpointCards(checkpoint: ChatCheckpointRecord) {
  return (
    checkpoint.graphState?.status === 'completed' &&
    (checkpoint.chatRoute?.flow === 'direct-reply' || checkpoint.chatRoute?.reason === 'conversation_recall_prompt')
  );
}

function attachRuntimeSkillInstallState(
  checkpoint: ChatCheckpointRecord,
  suggestion: NonNullable<ChatCheckpointRecord['skillSearch']>['suggestions'][number]
) {
  const approvalPreview =
    checkpoint.pendingApproval?.intent === 'install_skill'
      ? checkpoint.pendingApproval.preview
      : checkpoint.activeInterrupt?.kind === 'skill-install'
        ? checkpoint.activeInterrupt.preview
        : undefined;
  const pendingSkillName = approvalPreview?.find(item => item.label === 'Skill')?.value;
  const pendingRepo = approvalPreview?.find(item => item.label === 'Repo')?.value;
  const isPendingRuntimeInstall =
    (checkpoint.pendingApproval?.intent === 'install_skill' || checkpoint.activeInterrupt?.kind === 'skill-install') &&
    suggestion.kind === 'remote-skill' &&
    (pendingSkillName === suggestion.skillName ||
      pendingSkillName === suggestion.displayName ||
      pendingRepo === suggestion.repo);

  if (isPendingRuntimeInstall) {
    return {
      ...suggestion,
      installState: {
        receiptId: `runtime:${checkpoint.taskId}`,
        status: 'pending' as const,
        result: 'current_round_paused_waiting_for_skill_install_approval'
      }
    };
  }

  const runtimeInstalled =
    (checkpoint.usedInstalledSkills?.length ?? 0) > 0 &&
    (suggestion.kind === 'installed' || suggestion.availability === 'ready');

  if (runtimeInstalled) {
    return {
      ...suggestion,
      installState: {
        receiptId: `runtime:${checkpoint.taskId}`,
        status: 'installed' as const,
        result: 'installed_and_attached_to_current_round'
      }
    };
  }

  return suggestion;
}

function normalizeReusedSkill(value: string) {
  return value.trim().toLowerCase();
}

function buildCapabilityControlNotice(
  checkpoint: ChatCheckpointRecord,
  runtimeSkillSuggestion?: ReturnType<typeof attachRuntimeSkillInstallState>
) {
  if (runtimeSkillSuggestion?.installState?.status === 'pending') {
    return {
      label: '能力补齐',
      tone: 'warning' as const,
      content: `当前轮已暂停，等待安装 ${runtimeSkillSuggestion.displayName} 后自动继续。`
    };
  }

  if (runtimeSkillSuggestion?.installState?.status === 'installed') {
    return {
      label: '能力补齐',
      tone: 'success' as const,
      content: `已自动补齐 ${runtimeSkillSuggestion.displayName}，当前轮继续带着该 skill 执行。`
    };
  }

  if (
    checkpoint.skillSearch?.mcpRecommendation?.kind === 'connector' &&
    checkpoint.skillSearch.mcpRecommendation.connectorTemplateId &&
    !(checkpoint.connectorRefs?.length ?? 0)
  ) {
    return {
      label: '能力状态',
      tone: 'neutral' as const,
      content: `当前未接入 ${getConnectorTemplateLabel(checkpoint.skillSearch.mcpRecommendation.connectorTemplateId)}，已按现有能力继续处理。`
    };
  }

  if (checkpoint.connectorRefs?.length) {
    return {
      label: '能力状态',
      tone: 'success' as const,
      content: `本轮已接入 ${checkpoint.connectorRefs.join('、')}，继续执行当前任务。`
    };
  }

  return undefined;
}

function buildDispatchControlNotice(checkpoint: ChatCheckpointRecord) {
  if (checkpoint.currentWorker && checkpoint.currentMinistry) {
    return `当前由 ${checkpoint.currentMinistry} 的 ${checkpoint.currentWorker} 继续推进。`;
  }

  if (checkpoint.currentWorker) {
    return `当前由 ${checkpoint.currentWorker} 继续推进。`;
  }

  if (checkpoint.currentMinistry) {
    return `当前已切换到 ${checkpoint.currentMinistry} 执行路线。`;
  }

  return undefined;
}

function getConnectorTemplateLabel(templateId: 'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template') {
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

function isCitationSource(source: NonNullable<ChatCheckpointRecord['externalSources']>[number]) {
  if (
    source.sourceType === 'freshness_meta' ||
    source.sourceType === 'web_search_result' ||
    source.sourceType === 'web_research_plan'
  ) {
    return false;
  }

  if (source.sourceUrl) {
    return true;
  }

  return source.sourceType === 'document' || source.sourceType === 'web';
}
