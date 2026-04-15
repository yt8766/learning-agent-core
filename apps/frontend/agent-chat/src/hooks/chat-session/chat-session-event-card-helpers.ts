import type { ChatEventRecord, ChatMessageRecord } from '@/types/chat';

interface PreviewMessageItem {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface PlanQuestionOptionItem {
  id: string;
  label: string;
  description: string;
}

interface PlanQuestionItem {
  id: string;
  question: string;
  questionType: 'direction' | 'detail' | 'tradeoff';
  options: PlanQuestionOptionItem[];
  recommendedOptionId?: string;
  allowFreeform?: boolean;
  defaultAssumption?: string;
  whyAsked?: string;
  impactOnPlan?: string;
}

interface ApprovalPreviewItem {
  label: string;
  value: string;
}

function isPreviewMessageItem(item: unknown): item is PreviewMessageItem {
  return (
    !!item &&
    typeof item === 'object' &&
    ((item as { role?: unknown }).role === 'user' ||
      (item as { role?: unknown }).role === 'assistant' ||
      (item as { role?: unknown }).role === 'system') &&
    typeof (item as { content?: unknown }).content === 'string'
  );
}

function isPlanQuestionOptionItem(item: unknown): item is { id: string; label: string; description?: string } {
  return (
    !!item &&
    typeof item === 'object' &&
    typeof (item as { id?: unknown }).id === 'string' &&
    typeof (item as { label?: unknown }).label === 'string'
  );
}

function isPlanQuestionItem(item: unknown): item is {
  id: string;
  question?: string;
  questionType?: 'direction' | 'detail' | 'tradeoff';
  options?: unknown[];
  recommendedOptionId?: string;
  allowFreeform?: boolean;
  defaultAssumption?: string;
  whyAsked?: string;
  impactOnPlan?: string;
} {
  return !!item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string';
}

function isApprovalPreviewItem(item: unknown): item is ApprovalPreviewItem {
  return (
    !!item &&
    typeof item === 'object' &&
    typeof (item as { label?: unknown }).label === 'string' &&
    typeof (item as { value?: unknown }).value === 'string'
  );
}

export function sanitizeStringArray(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const sanitized = value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);

  return sanitized.length ? sanitized : undefined;
}

export function parsePreviewMessages(value: unknown): PreviewMessageItem[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const previewMessages = value.filter(isPreviewMessageItem).map(item => ({
    role: item.role,
    content: item.content
  }));

  return previewMessages.length ? previewMessages : undefined;
}

function parsePlanQuestions(value: unknown): PlanQuestionItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isPlanQuestionItem).map(item => ({
    id: item.id,
    question: typeof item.question === 'string' ? item.question : '',
    questionType:
      item.questionType === 'direction' || item.questionType === 'detail' || item.questionType === 'tradeoff'
        ? item.questionType
        : 'detail',
    options: Array.isArray(item.options)
      ? item.options.filter(isPlanQuestionOptionItem).map(option => ({
          id: option.id,
          label: option.label,
          description: typeof option.description === 'string' ? option.description : ''
        }))
      : [],
    recommendedOptionId: typeof item.recommendedOptionId === 'string' ? item.recommendedOptionId : undefined,
    allowFreeform: typeof item.allowFreeform === 'boolean' ? item.allowFreeform : undefined,
    defaultAssumption: typeof item.defaultAssumption === 'string' ? item.defaultAssumption : undefined,
    whyAsked: typeof item.whyAsked === 'string' ? item.whyAsked : undefined,
    impactOnPlan: typeof item.impactOnPlan === 'string' ? item.impactOnPlan : undefined
  }));
}

function parseApprovalPreview(value: unknown): ApprovalPreviewItem[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const preview = value.filter(isApprovalPreviewItem).map(item => ({
    label: item.label,
    value: item.value
  }));

  return preview.length ? preview : undefined;
}

export function buildEventCard(event: ChatEventRecord): ChatMessageRecord['card'] | undefined {
  const payload = event.payload ?? {};
  if (event.type === 'conversation_compacted') {
    return {
      type: 'compression_summary',
      summary: typeof payload.summary === 'string' ? payload.summary : '',
      periodOrTopic: typeof payload.periodOrTopic === 'string' ? payload.periodOrTopic : undefined,
      focuses: sanitizeStringArray(payload.focuses, 5),
      keyDeliverables: sanitizeStringArray(payload.keyDeliverables, 5),
      risks: sanitizeStringArray(payload.risks, 4),
      nextActions: sanitizeStringArray(payload.nextActions, 4),
      supportingFacts: sanitizeStringArray(payload.supportingFacts, 4),
      condensedMessageCount:
        typeof payload.condensedMessageCount === 'number' ? payload.condensedMessageCount : undefined,
      condensedCharacterCount:
        typeof payload.condensedCharacterCount === 'number' ? payload.condensedCharacterCount : undefined,
      totalCharacterCount: typeof payload.totalCharacterCount === 'number' ? payload.totalCharacterCount : undefined,
      previewMessages: parsePreviewMessages(payload.previewMessages),
      trigger: payload.trigger === 'character_count' ? 'character_count' : 'message_count',
      source: payload.source === 'llm' ? 'llm' : 'heuristic'
    };
  }

  if (event.type === 'approval_required' || event.type === 'interrupt_pending') {
    if (payload.interactionKind === 'plan-question') {
      return {
        type: 'plan_question',
        title:
          payload.questionSet &&
          typeof payload.questionSet === 'object' &&
          typeof (payload.questionSet as { title?: unknown }).title === 'string'
            ? (payload.questionSet as { title: string }).title
            : '计划问题',
        summary:
          payload.questionSet &&
          typeof payload.questionSet === 'object' &&
          typeof (payload.questionSet as { summary?: unknown }).summary === 'string'
            ? (payload.questionSet as { summary: string }).summary
            : typeof payload.reason === 'string'
              ? payload.reason
              : undefined,
        status: 'pending',
        interruptId: typeof payload.interruptId === 'string' ? payload.interruptId : undefined,
        questions: parsePlanQuestions(payload.questions)
      };
    }

    return {
      type: 'approval_request',
      intent: typeof payload.intent === 'string' ? payload.intent : 'unknown',
      toolName: typeof payload.toolName === 'string' ? payload.toolName : undefined,
      reason: typeof payload.reason === 'string' ? payload.reason : undefined,
      reasonCode: typeof payload.reasonCode === 'string' ? payload.reasonCode : undefined,
      riskLevel: typeof payload.riskLevel === 'string' ? payload.riskLevel : undefined,
      riskCode: typeof payload.riskCode === 'string' ? payload.riskCode : undefined,
      riskReason: typeof payload.riskReason === 'string' ? payload.riskReason : undefined,
      commandPreview: typeof payload.commandPreview === 'string' ? payload.commandPreview : undefined,
      approvalScope:
        payload.approvalScope === 'once' || payload.approvalScope === 'session' || payload.approvalScope === 'always'
          ? payload.approvalScope
          : undefined,
      requestedBy: typeof payload.requestedBy === 'string' ? payload.requestedBy : undefined,
      status: 'pending',
      displayStatus: 'pending',
      isPrimaryActionAvailable: true,
      serverId: typeof payload.serverId === 'string' ? payload.serverId : undefined,
      capabilityId: typeof payload.capabilityId === 'string' ? payload.capabilityId : undefined,
      interruptId: typeof payload.interruptId === 'string' ? payload.interruptId : undefined,
      interruptSource:
        payload.interruptSource === 'graph' || payload.interruptSource === 'tool' ? payload.interruptSource : undefined,
      interruptMode:
        payload.interruptMode === 'blocking' || payload.interruptMode === 'non-blocking'
          ? payload.interruptMode
          : undefined,
      resumeStrategy:
        payload.resumeStrategy === 'command' || payload.resumeStrategy === 'approval-recovery'
          ? payload.resumeStrategy
          : undefined,
      interactionKind:
        payload.interactionKind === 'approval' ||
        payload.interactionKind === 'plan-question' ||
        payload.interactionKind === 'supplemental-input'
          ? payload.interactionKind
          : undefined,
      watchdog: payload.watchdog === true,
      runtimeGovernanceReasonCode:
        typeof payload.runtimeGovernanceReasonCode === 'string' ? payload.runtimeGovernanceReasonCode : undefined,
      recommendedActions: Array.isArray(payload.recommendedActions)
        ? payload.recommendedActions.filter((item): item is string => typeof item === 'string')
        : undefined,
      preview: parseApprovalPreview(payload.preview)
    };
  }

  if (event.type === 'run_cancelled') {
    return {
      type: 'control_notice',
      tone: 'warning',
      label: '本轮已终止'
    };
  }

  if (event.type === 'run_resumed') {
    const currentSkillExecution =
      payload.currentSkillExecution &&
      typeof payload.currentSkillExecution === 'object' &&
      typeof (payload.currentSkillExecution as { title?: unknown }).title === 'string'
        ? (payload.currentSkillExecution as { title: string })
        : undefined;

    return {
      type: 'control_notice',
      tone: 'success',
      label: currentSkillExecution ? `已恢复到 ${currentSkillExecution.title}` : '已恢复执行'
    };
  }

  if (event.type === 'approval_resolved' || event.type === 'interrupt_resumed') {
    return {
      type: 'control_notice',
      tone: 'success',
      label: '已允许继续'
    };
  }

  if (event.type === 'approval_rejected_with_feedback' || event.type === 'interrupt_rejected_with_feedback') {
    return {
      type: 'control_notice',
      tone: 'warning',
      label: '已拒绝并附说明'
    };
  }

  return undefined;
}

export function updateApprovalCard(current: ChatMessageRecord[], event: ChatEventRecord) {
  const intent = typeof event.payload?.intent === 'string' ? event.payload.intent : '';
  const taskId = typeof event.payload?.taskId === 'string' ? event.payload.taskId : '';
  const feedback = typeof event.payload?.feedback === 'string' ? event.payload.feedback : undefined;
  const nextDisplayStatus: 'allowed' | 'rejected' | 'rejected_with_feedback' =
    event.type === 'approval_resolved' || event.type === 'interrupt_resumed'
      ? 'allowed'
      : event.type === 'approval_rejected_with_feedback' || event.type === 'interrupt_rejected_with_feedback'
        ? 'rejected_with_feedback'
        : 'rejected';
  const nextStatus: 'approved' | 'rejected' =
    event.type === 'approval_resolved' || event.type === 'interrupt_resumed' ? 'approved' : 'rejected';

  let updated = false;
  return current.map(message => {
    if (updated || message.card?.type !== 'approval_request' || message.card.status !== 'pending') {
      return message;
    }

    if (message.card.intent !== intent) {
      return message;
    }

    if (taskId && message.taskId && message.taskId !== taskId) {
      return message;
    }

    updated = true;
    return {
      ...message,
      card: {
        ...message.card,
        status: nextStatus,
        displayStatus: nextDisplayStatus,
        isPrimaryActionAvailable: false,
        reason: feedback ?? message.card.reason
      }
    };
  });
}

export function updatePlanQuestionCard(current: ChatMessageRecord[], event: ChatEventRecord) {
  const interruptId = typeof event.payload?.interruptId === 'string' ? event.payload.interruptId : '';
  const nextStatus: 'answered' | 'bypassed' | 'aborted' =
    event.type === 'run_cancelled'
      ? 'aborted'
      : event.payload?.decision === 'approved' &&
          event.payload?.interactionKind === 'plan-question' &&
          event.payload?.intent === 'plan_question'
        ? 'bypassed'
        : 'answered';

  let updated = false;
  return current.map(message => {
    if (updated || message.card?.type !== 'plan_question' || message.card.status !== 'pending') {
      return message;
    }

    if (interruptId && message.card.interruptId && message.card.interruptId !== interruptId) {
      return message;
    }

    updated = true;
    return {
      ...message,
      card: {
        ...message.card,
        status: nextStatus
      }
    };
  });
}
