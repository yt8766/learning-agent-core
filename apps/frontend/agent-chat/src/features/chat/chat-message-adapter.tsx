import { Button, Tag, Typography } from 'antd';
import { Think, ThoughtChain } from '@ant-design/x';
import type { BubbleItemType, ThoughtChainItemType } from '@ant-design/x';

import { CopyGlyph, renderStructuredMessageCard } from '@/components/chat-message-cards';
import type { ChatMessageRecord, ChatSessionRecord, ChatThinkState } from '@/types/chat';
import { PENDING_ASSISTANT_PREFIX } from '@/hooks/chat-session/chat-session-formatters';

export type AgentLabelResolver = (role?: string) => string;
const PROGRESS_STREAM_MESSAGE_PREFIX = 'progress_stream_';
const { Text } = Typography;

export interface BuildBubbleItemsOptions {
  messages: ChatMessageRecord[];
  activeStatus?: ChatSessionRecord['status'];
  /** 与 checkpoint.thinkState.loading 对齐，避免会话状态尚未推成 running 时不显示 typing */
  agentThinking?: boolean;
  copiedMessageId?: string;
  onCopy: (message: ChatMessageRecord) => void;
  onApprovalAction?: (intent: string, approved: boolean) => void;
  onApprovalAllowAlways?: (intent: string, serverId?: string, capabilityId?: string) => void;
  onApprovalFeedback?: (intent: string, reason?: string) => void;
  onPlanAction?: (params: {
    action: 'input' | 'bypass' | 'abort';
    interruptId?: string;
    answers?: Array<{
      questionId: string;
      optionId?: string;
      freeform?: string;
    }>;
  }) => void;
  onSkillInstall?: (
    suggestion: Extract<NonNullable<ChatMessageRecord['card']>, { type: 'skill_suggestions' }>['suggestions'][number]
  ) => void;
  getAgentLabel: AgentLabelResolver;
  runningHint?: string;
  thinkState?: ChatThinkState;
  thoughtItems?: ThoughtChainItemType[];
  cognitionTargetMessageId?: string;
  cognitionExpanded?: boolean;
  onToggleCognition?: () => void;
  cognitionDurationLabel?: string;
  cognitionCountLabel?: string;
}

function renderMessageContent(
  message: ChatMessageRecord,
  streaming: boolean,
  options: Pick<
    BuildBubbleItemsOptions,
    | 'onApprovalAction'
    | 'onApprovalAllowAlways'
    | 'onApprovalFeedback'
    | 'onPlanAction'
    | 'onSkillInstall'
    | 'thinkState'
    | 'thoughtItems'
    | 'cognitionTargetMessageId'
    | 'cognitionExpanded'
    | 'onToggleCognition'
    | 'cognitionDurationLabel'
    | 'cognitionCountLabel'
  > & {
    inlineEvidenceMessage?: ChatMessageRecord;
  }
) {
  const normalizedMessage =
    message.role === 'assistant'
      ? {
          ...message,
          content: stripStreamingCursor(message.content)
        }
      : message;
  const evidenceSources =
    options.inlineEvidenceMessage?.card?.type === 'evidence_digest'
      ? options.inlineEvidenceMessage.card.sources
      : undefined;
  const shouldInlineEvidence = Boolean(
    normalizedMessage.role === 'assistant' &&
    evidenceSources?.length &&
    /<sup>\s*\d+\s*<\/sup>/i.test(normalizedMessage.content)
  );
  const content = renderStructuredMessageCard(normalizedMessage, streaming, {
    ...options,
    inlineEvidenceSources: evidenceSources
  });
  const evidenceContent =
    !shouldInlineEvidence && options.inlineEvidenceMessage
      ? renderStructuredMessageCard(options.inlineEvidenceMessage, false, options)
      : null;
  const shouldShowCognition =
    message.role === 'assistant' &&
    message.id === options.cognitionTargetMessageId &&
    (options.thinkState || (options.thoughtItems?.length ?? 0) > 0);

  if (!shouldShowCognition) {
    if (!evidenceContent) {
      return content;
    }

    return (
      <div className="chatx-assistant-stack">
        {content}
        {evidenceContent}
      </div>
    );
  }

  const isThinking = Boolean(options.thinkState?.loading);
  const cognitionSummary = buildCognitionSummary(
    options.thinkState?.content,
    toPlainSummary(options.thoughtItems?.[0]?.description)
  );
  const statusLabel = isThinking ? '思考中' : '已思考';
  const showCountLabel = isThinking && options.cognitionCountLabel;
  const titleLabel = options.cognitionDurationLabel
    ? `${statusLabel}（${options.cognitionDurationLabel}）`
    : statusLabel;

  return (
    <div className="chatx-assistant-stack">
      <div className="chatx-inline-think">
        <button
          type="button"
          className={`chatx-inline-think__toggle ${isThinking ? 'is-thinking' : 'is-complete'}`}
          onClick={options.onToggleCognition}
        >
          {isThinking ? (
            <span className="chatx-inline-think__badge is-thinking" aria-hidden="true">
              <span className="chatx-inline-think__loader">
                <span className="chatx-inline-think__bar" />
                <span className="chatx-inline-think__bar" />
                <span className="chatx-inline-think__bar" />
              </span>
            </span>
          ) : (
            <span className="chatx-inline-think__badge is-complete" aria-hidden="true">
              <span className="chatx-inline-think__dot" />
            </span>
          )}
          <span className="chatx-inline-think__copy">
            <span className={`chatx-inline-think__label ${isThinking ? 'is-thinking' : 'is-complete'}`}>
              {titleLabel}
              {showCountLabel ? (
                <span className="chatx-inline-think__meta"> · {options.cognitionCountLabel}</span>
              ) : null}
            </span>
            <span className="chatx-inline-think__summary">{cognitionSummary}</span>
          </span>
          <span
            aria-hidden="true"
            className={`chatx-inline-think__action ${options.cognitionExpanded ? 'is-visible' : ''}`}
          >
            <span className={`chatx-inline-think__chevron ${options.cognitionExpanded ? 'is-open' : ''}`}>⌄</span>
          </span>
        </button>
        {options.cognitionExpanded ? (
          <div className="chatx-inline-think__panel">
            {options.thinkState ? (
              <div className="chatx-inline-think__block">
                <Think
                  title={options.thinkState.title}
                  loading={options.thinkState.loading}
                  blink={options.thinkState.blink}
                  defaultExpanded
                >
                  <Text>{options.thinkState.content}</Text>
                </Think>
              </div>
            ) : null}
            {options.thoughtItems?.length ? (
              <div className="chatx-inline-think__block">
                <ThoughtChain
                  items={options.thoughtItems}
                  defaultExpandedKeys={options.thoughtItems.slice(0, 2).map(item => item.key as string)}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {content}
      {evidenceContent}
    </div>
  );
}

function buildCognitionSummary(thinkContent?: string, thoughtDescription?: string) {
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

function toPlainSummary(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return undefined;
}

function getMessageTaskIdentity(message: ChatMessageRecord) {
  if (message.taskId) {
    return message.taskId;
  }

  if (message.id.startsWith(PROGRESS_STREAM_MESSAGE_PREFIX)) {
    return message.id.slice(PROGRESS_STREAM_MESSAGE_PREFIX.length);
  }

  return message.id;
}

function shouldRenderInMainThread(
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

  if (message.id.startsWith(PROGRESS_STREAM_MESSAGE_PREFIX)) {
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
        !candidate.id.startsWith(PROGRESS_STREAM_MESSAGE_PREFIX) &&
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

function collapseMainThreadMessages(messages: ChatMessageRecord[], cognitionTargetMessageId?: string) {
  const collapsed: ChatMessageRecord[] = [];

  for (const message of messages) {
    const previous = collapsed[collapsed.length - 1];
    const canMergeAssistantText =
      previous &&
      previous.role === 'assistant' &&
      message.role === 'assistant' &&
      !previous.card &&
      !message.card &&
      previous.id !== cognitionTargetMessageId &&
      message.id !== cognitionTargetMessageId &&
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

function normalizeCapabilityMessageForMainThread(message: ChatMessageRecord): ChatMessageRecord {
  if (message.id.startsWith(PROGRESS_STREAM_MESSAGE_PREFIX)) {
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

function mergeAssistantText(previousContent: string, nextContent: string) {
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

function findSuffixPrefixOverlap(left: string, right: string) {
  const maxOverlap = Math.min(left.length, right.length);
  for (let size = maxOverlap; size > 0; size -= 1) {
    if (left.slice(-size) === right.slice(0, size)) {
      return size;
    }
  }
  return 0;
}

function containsCitationSection(content: string) {
  return /(^|\n)\s*引用来源[:：]?/m.test(content);
}

function formatConnectorTemplateLabel(
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

export function buildBubbleItems({
  messages,
  activeStatus,
  agentThinking,
  copiedMessageId,
  onCopy,
  onApprovalAction,
  onApprovalAllowAlways,
  onApprovalFeedback,
  onSkillInstall,
  getAgentLabel,
  thinkState,
  thoughtItems,
  cognitionTargetMessageId,
  cognitionExpanded,
  onToggleCognition,
  cognitionDurationLabel,
  cognitionCountLabel
}: BuildBubbleItemsOptions): BubbleItemType[] {
  const mainThreadMessages = buildMainThreadMessages(messages, cognitionTargetMessageId);
  const lastAssistantMessageId = [...mainThreadMessages].reverse().find(message => message.role === 'assistant')?.id;
  const inlineEvidenceMessage = lastAssistantMessageId
    ? [...mainThreadMessages].reverse().find(message => message.card?.type === 'evidence_digest')
    : undefined;
  const resolvedCognitionTargetMessageId = mainThreadMessages.some(message => message.id === cognitionTargetMessageId)
    ? cognitionTargetMessageId
    : (lastAssistantMessageId ?? cognitionTargetMessageId);

  const items: BubbleItemType[] = mainThreadMessages
    .filter(message => {
      if (message.id === inlineEvidenceMessage?.id) {
        return false;
      }

      if (message.card?.type === 'evidence_digest' && !lastAssistantMessageId) {
        return false;
      }

      return true;
    })
    .map(message => {
      const isStreamingAssistant =
        message.id === lastAssistantMessageId && (activeStatus === 'running' || Boolean(agentThinking));
      const shouldAttachEvidence =
        message.id === lastAssistantMessageId && inlineEvidenceMessage && !containsCitationSection(message.content);

      return {
        key: message.id,
        role: message.role === 'user' ? 'user' : message.role === 'assistant' ? 'ai' : 'system',
        content: renderMessageContent(message, isStreamingAssistant, {
          onApprovalAction,
          onApprovalAllowAlways,
          onApprovalFeedback,
          onSkillInstall,
          thinkState,
          thoughtItems,
          cognitionTargetMessageId: resolvedCognitionTargetMessageId,
          cognitionExpanded,
          onToggleCognition,
          cognitionDurationLabel,
          cognitionCountLabel,
          inlineEvidenceMessage: shouldAttachEvidence ? inlineEvidenceMessage : undefined
        }),
        header:
          message.role === 'system' && message.linkedAgent ? (
            <Tag color="geekblue">{getAgentLabel(message.linkedAgent)}</Tag>
          ) : undefined,
        footer:
          message.role === 'assistant' || message.role === 'user' ? (
            <div className="chatx-bubble-footer">
              <Button
                size="small"
                type="text"
                className="chatx-copy-button"
                icon={<CopyGlyph copied={copiedMessageId === message.id} />}
                onClick={() => onCopy(message)}
                aria-label={copiedMessageId === message.id ? '已复制' : '复制消息'}
              />
            </div>
          ) : undefined,
        footerPlacement: message.role === 'user' ? 'outer-end' : 'outer-start',
        placement: message.role === 'user' ? 'end' : 'start',
        variant: message.role === 'user' ? 'filled' : message.role === 'system' ? 'outlined' : 'shadow',
        shape: 'round',
        typing: isStreamingAssistant,
        streaming: isStreamingAssistant
      };
    });

  return items;
}

function stripStreamingCursor(content: string) {
  return content.replace(/[\u2588\u2589\u258a\u258b\u258c\u258d\u258e\u258f▌▋▊▉]+\s*$/u, '').trimEnd();
}
