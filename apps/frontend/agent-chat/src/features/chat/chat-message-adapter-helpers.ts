import type { ChatMessageRecord } from '@/types/chat';
import { PENDING_ASSISTANT_PREFIX } from '@/hooks/chat-session/chat-session-formatters';

const PROGRESS_STREAM_MESSAGE_PREFIX = 'progress_stream_';
const DIRECT_REPLY_STREAM_MESSAGE_PREFIX = 'direct_reply_';
const SUMMARY_STREAM_MESSAGE_PREFIX = 'summary_stream_';

export function buildNodeStreamCognitionSummary(streamStatus?: {
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

  return buildCognitionSummary(segments.join(' · '));
}

export function buildCognitionSummary(thinkContent?: string, thoughtDescription?: string) {
  const source = thinkContent || thoughtDescription || '正在整理推理过程。';
  const normalized = source
    .replace(/\s+/g, ' ')
    .replace(/首辅视角：|吏部视角：|户部视角：|工部视角：|兵部视角：|刑部视角：|礼部视角：/g, '')
    .replace(/direct_reply|direct-reply|workflow|supervisor/gi, '')
    .replace(/当前仍由首辅统一协调全局。?/g, '正在统筹这轮处理。')
    .trim();
  const firstSentence = normalized.split(/[。！？\n]/)[0]?.trim() || normalized;

  if (firstSentence.length <= 26) {
    return firstSentence;
  }

  return `${firstSentence.slice(0, 26).trimEnd()}...`;
}

export function toPlainSummary(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return undefined;
}

export function getMessageTaskIdentity(message: ChatMessageRecord) {
  if (message.taskId) {
    return message.taskId;
  }

  if (message.id.startsWith(PROGRESS_STREAM_MESSAGE_PREFIX)) {
    return message.id.slice(PROGRESS_STREAM_MESSAGE_PREFIX.length);
  }

  if (message.id.startsWith(DIRECT_REPLY_STREAM_MESSAGE_PREFIX)) {
    return message.id.slice(DIRECT_REPLY_STREAM_MESSAGE_PREFIX.length);
  }

  if (message.id.startsWith(SUMMARY_STREAM_MESSAGE_PREFIX)) {
    return message.id.slice(SUMMARY_STREAM_MESSAGE_PREFIX.length);
  }

  return message.id;
}

export function isTransientAssistantStreamMessage(message: ChatMessageRecord) {
  return (
    message.id.startsWith(PROGRESS_STREAM_MESSAGE_PREFIX) ||
    message.id.startsWith(DIRECT_REPLY_STREAM_MESSAGE_PREFIX) ||
    message.id.startsWith(SUMMARY_STREAM_MESSAGE_PREFIX)
  );
}

export function shouldRenderInMainThread(
  message: ChatMessageRecord,
  messages: ChatMessageRecord[],
  cognitionTargetMessageId?: string
) {
  if (message.id.startsWith(PENDING_ASSISTANT_PREFIX)) {
    const pendingCreatedMs = Date.parse(message.createdAt ?? '');
    const hasCommittedAssistantResult = messages.some(candidate => {
      if (
        candidate.role !== 'assistant' ||
        candidate.id.startsWith(PENDING_ASSISTANT_PREFIX) ||
        candidate.sessionId !== message.sessionId ||
        !candidate.content.trim()
      ) {
        return false;
      }

      const candidateCreatedMs = Date.parse(candidate.createdAt ?? '');
      if (!Number.isFinite(pendingCreatedMs) || !Number.isFinite(candidateCreatedMs)) {
        return true;
      }

      return candidateCreatedMs >= pendingCreatedMs;
    });

    if (message.id === cognitionTargetMessageId) {
      return !hasCommittedAssistantResult;
    }

    if (hasCommittedAssistantResult) {
      return false;
    }
  }

  if (isTransientAssistantStreamMessage(message)) {
    if (message.id === cognitionTargetMessageId) {
      return true;
    }

    if (!message.content.trim()) {
      return false;
    }

    const taskIdentity = getMessageTaskIdentity(message);
    const hasCommittedAssistantResult = messages.some(
      candidate =>
        candidate.role === 'assistant' &&
        !isTransientAssistantStreamMessage(candidate) &&
        getMessageTaskIdentity(candidate) === taskIdentity &&
        candidate.content.trim()
    );

    return !hasCommittedAssistantResult;
  }

  if (message.role === 'user' || message.role === 'assistant') {
    return true;
  }

  if (!message.card) {
    return false;
  }

  return ['approval_request', 'plan_question', 'evidence_digest', 'learning_summary'].includes(message.card.type);
}

export function collapseMainThreadMessages(messages: ChatMessageRecord[], cognitionTargetMessageId?: string) {
  const collapsed: ChatMessageRecord[] = [];

  for (const message of messages) {
    const previous = collapsed[collapsed.length - 1];
    const previousTaskIdentity = previous ? getMessageTaskIdentity(previous) : undefined;
    const currentTaskIdentity = getMessageTaskIdentity(message);
    const canMergeAssistantText =
      previous &&
      previous.role === 'assistant' &&
      message.role === 'assistant' &&
      !previous.card &&
      !message.card &&
      previous.id !== cognitionTargetMessageId &&
      message.id !== cognitionTargetMessageId &&
      previousTaskIdentity === currentTaskIdentity &&
      previous.content.trim().length > 0 &&
      message.content.trim().length > 0;

    if (canMergeAssistantText) {
      collapsed[collapsed.length - 1] = {
        ...previous,
        id: message.id,
        content: mergeAssistantText(previous.content, message.content),
        taskId: message.taskId ?? previous.taskId,
        createdAt: message.createdAt,
        linkedAgent: message.linkedAgent ?? previous.linkedAgent
      };
      continue;
    }

    collapsed.push(message);
  }

  return collapsed;
}

export function buildMainThreadMessages(messages: ChatMessageRecord[], cognitionTargetMessageId?: string) {
  const mainThread = messages
    .filter(message => shouldRenderInMainThread(message, messages, cognitionTargetMessageId))
    .map(normalizeCapabilityMessageForMainThread);
  const hasInlineCitationSection = mainThread.some(
    message => message.role === 'assistant' && containsCitationSection(message.content)
  );

  const normalized = hasInlineCitationSection
    ? mainThread.filter(message => message.card?.type !== 'evidence_digest')
    : mainThread;

  return collapseMainThreadMessages(normalized, cognitionTargetMessageId);
}

export function normalizeCapabilityMessageForMainThread(message: ChatMessageRecord): ChatMessageRecord {
  if (isTransientAssistantStreamMessage(message)) {
    return {
      ...message,
      content: ''
    };
  }

  if (message.card?.type === 'skill_suggestions') {
    const installed = message.card.suggestions.find(item => item.installState?.status === 'installed');
    const pending = message.card.suggestions.find(item => item.installState?.status === 'pending');
    return {
      ...message,
      content: pending
        ? `当前轮已暂停，等待安装 ${pending.displayName} 后自动继续。`
        : installed
          ? `已自动补齐 ${installed.displayName}，当前轮继续带着该 skill 执行。`
          : message.card.mcpRecommendation?.kind === 'connector'
            ? `当前未接入 ${formatConnectorTemplateLabel(message.card.mcpRecommendation.connectorTemplateId)}，已按现有能力继续处理。`
            : '当前能力链已调整，继续执行中。',
      card: {
        type: 'control_notice',
        tone: pending ? 'warning' : installed ? 'success' : 'neutral',
        label: pending || installed ? '能力补齐' : '能力状态'
      }
    };
  }

  if (message.card?.type === 'skill_reuse') {
    const used = [
      ...message.card.usedInstalledSkills.slice(0, 2),
      ...message.card.usedCompanyWorkers.slice(0, 2)
    ].filter(Boolean);
    return {
      ...message,
      content: used.length ? `本轮已复用 ${used.join('、')} 继续处理。` : '本轮已复用既有能力继续处理。',
      card: {
        type: 'control_notice',
        tone: 'neutral',
        label: '能力复用'
      }
    };
  }

  if (message.card?.type === 'worker_dispatch') {
    return {
      ...message,
      content: message.card.currentWorker
        ? `当前由 ${message.card.currentMinistry ?? '当前执行线'} 的 ${message.card.currentWorker} 继续推进。`
        : message.card.currentMinistry
          ? `当前已切换到 ${message.card.currentMinistry} 执行路线。`
          : message.content,
      card: {
        type: 'control_notice',
        tone: 'neutral',
        label: '执行更新'
      }
    };
  }

  return message;
}

export function mergeAssistantText(previousContent: string, nextContent: string) {
  const previousTrimmed = previousContent.trim();
  const nextTrimmed = nextContent.trim();

  if (!previousTrimmed) {
    return nextContent;
  }

  if (!nextTrimmed) {
    return previousContent;
  }

  if (previousTrimmed === nextTrimmed) {
    return nextContent;
  }

  if (nextTrimmed.startsWith(previousTrimmed)) {
    return nextContent;
  }

  if (previousTrimmed.startsWith(nextTrimmed)) {
    return previousContent;
  }

  const overlap = findSuffixPrefixOverlap(previousTrimmed, nextTrimmed);
  if (overlap >= 24) {
    return `${previousTrimmed}${nextTrimmed.slice(overlap)}`;
  }

  return `${previousContent}${previousContent && nextContent ? '\n\n' : ''}${nextContent}`;
}

export function findSuffixPrefixOverlap(left: string, right: string) {
  const maxOverlap = Math.min(left.length, right.length);
  for (let size = maxOverlap; size > 0; size -= 1) {
    if (left.slice(-size) === right.slice(0, size)) {
      return size;
    }
  }
  return 0;
}

export function containsCitationSection(content: string) {
  return /(^|\n)\s*引用来源[:：]?/m.test(content);
}

export function formatConnectorTemplateLabel(
  templateId?: 'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template'
) {
  switch (templateId) {
    case 'github-mcp-template':
      return 'GitHub MCP';
    case 'browser-mcp-template':
      return 'Browser MCP';
    case 'lark-mcp-template':
      return 'Lark MCP';
    default:
      return '相关 MCP';
  }
}

export function stripStreamingCursor(content: string) {
  return content.replace(/[\u2588\u2589\u258a\u258b\u258c\u258d\u258e\u258f▌▋▊▉]+\s*$/u, '').trimEnd();
}
