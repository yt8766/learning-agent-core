import { Button, Tag, Typography } from 'antd';
import { DislikeOutlined, LikeOutlined, ReloadOutlined } from '@ant-design/icons';
import { Think, ThoughtChain } from '@ant-design/x';
import type { BubbleItemType, ThoughtChainItemType } from '@ant-design/x';

import { CopyGlyph, renderStructuredMessageCard } from '@/components/chat-message-cards';
import type { ChatResponseStepsState } from '@/lib/chat-response-step-projections';
import type {
  ChatMessageFeedbackInput,
  ChatMessageFeedbackReasonCode,
  ChatMessageRecord,
  ChatSessionRecord,
  ChatThinkState
} from '@/types/chat';
import {
  buildCognitionSummary,
  buildMainThreadMessages,
  containsCitationSection,
  parseAssistantThinkingContent,
  stripStreamingCursor,
  stripWorkflowCommandPrefix,
  toPlainSummary
} from './chat-message-adapter-helpers';
import { MessageThinkingPanel } from './message-thinking-panel';
import { renderMessageResponseSteps } from './chat-message-response-steps';

export type AgentLabelResolver = (role?: string) => string;
const { Text } = Typography;
export { buildMainThreadMessages, buildNodeStreamCognitionSummary } from './chat-message-adapter-helpers';

export interface BuildBubbleItemsOptions {
  messages: ChatMessageRecord[];
  activeStatus?: ChatSessionRecord['status'];
  /** 与 checkpoint.thinkState.loading 对齐，避免会话状态尚未推成 running 时不显示 typing */
  agentThinking?: boolean;
  copiedMessageId?: string;
  onCopy: (message: ChatMessageRecord) => void;
  onRegenerate?: (message: ChatMessageRecord) => void;
  onMessageFeedback?: (message: ChatMessageRecord, feedback: ChatMessageFeedbackInput) => void;
  onApprovalAction?: (intent: string, approved: boolean, scope?: 'once' | 'session' | 'always') => void;
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
  responseStepsByMessageId?: ChatResponseStepsState['byMessageId'];
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
    responseSteps?: ChatResponseStepsState['byMessageId'][string];
  }
) {
  const assistantParsed =
    message.role === 'assistant'
      ? parseAssistantThinkingContent(normalizeEscapedThinkTags(stripStreamingCursor(message.content)), streaming)
      : undefined;
  const normalizedMessage =
    message.role === 'assistant'
      ? {
          ...message,
          content: assistantParsed?.visibleContent ?? ''
        }
      : message.role === 'user'
        ? {
            ...message,
            content: stripWorkflowCommandPrefix(message.content)
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
  const beforeContent = renderMessageResponseSteps({
    responseSteps: options.responseSteps,
    placement: 'before-content'
  });
  const afterContent = renderMessageResponseSteps({
    responseSteps: options.responseSteps,
    placement: 'after-content'
  });
  const thinkingPanel =
    message.role === 'assistant' && assistantParsed && assistantParsed.thinkingState !== 'none' ? (
      <MessageThinkingPanel
        content={assistantParsed.thinkContent}
        state={assistantParsed.thinkingState}
        durationLabel={options.cognitionDurationLabel}
      />
    ) : null;
  const evidenceContent =
    !shouldInlineEvidence && options.inlineEvidenceMessage
      ? renderStructuredMessageCard(options.inlineEvidenceMessage, false, options)
      : null;
  const isCognitionTarget = message.role === 'assistant' && message.id === options.cognitionTargetMessageId;
  const messageThinkState = isCognitionTarget ? options.thinkState : undefined;
  const messageThoughtItems = isCognitionTarget ? options.thoughtItems : undefined;
  const messageCognitionExpanded = Boolean(isCognitionTarget && options.cognitionExpanded);
  const hasTargetCognition =
    isCognitionTarget &&
    (messageThinkState ||
      (messageThoughtItems?.length ?? 0) > 0 ||
      (!thinkingPanel && Boolean(assistantParsed?.thinkContent)));
  const hasRuntimeTargetCognition = Boolean(messageThinkState || (messageThoughtItems?.length ?? 0) > 0);
  const shouldShowCognition =
    message.role === 'assistant' &&
    (hasTargetCognition ||
      (!thinkingPanel && Boolean(assistantParsed?.thinkContent)) ||
      (!thinkingPanel && !hasRuntimeTargetCognition && Boolean(normalizedMessage.content.trim())));

  if (!shouldShowCognition) {
    if (!thinkingPanel && !beforeContent && !afterContent && !evidenceContent) {
      return content;
    }

    return (
      <div className="chatx-assistant-stack">
        {thinkingPanel}
        {beforeContent}
        {content}
        {afterContent}
        {evidenceContent}
      </div>
    );
  }

  const inlineThinkContent = thinkingPanel ? '' : (assistantParsed?.thinkContent ?? '');
  const isThinking = Boolean(messageThinkState?.loading);
  const cognitionSummary = buildCognitionSummary(
    messageThinkState?.loading && messageThoughtItems?.[0]?.description
      ? toPlainSummary(messageThoughtItems[0].description)
      : (messageThinkState?.content ?? inlineThinkContent),
    toPlainSummary(messageThoughtItems?.[0]?.description)
  );
  const statusLabel = isThinking ? '思考中' : '已思考';
  const showCountLabel = isThinking && options.cognitionCountLabel;
  const shouldUseQuietCollapsedRuntimeSummary = Boolean(
    isCognitionTarget && hasRuntimeTargetCognition && !messageCognitionExpanded && !isThinking && !thinkingPanel
  );
  const titleLabel =
    !shouldUseQuietCollapsedRuntimeSummary && isCognitionTarget && options.cognitionDurationLabel
      ? `${statusLabel}（${formatCognitionDurationCopy(options.cognitionDurationLabel)}）`
      : shouldUseQuietCollapsedRuntimeSummary
        ? ''
        : statusLabel;
  const canExpandCognition =
    Boolean(messageThinkState) || Boolean(inlineThinkContent) || Boolean(messageThoughtItems?.length);
  const cognitionSummaryClassName = shouldUseQuietCollapsedRuntimeSummary
    ? 'chatx-inline-think'
    : 'chatx-inline-think chatx-governance-summary';
  const cognitionToggleClassName = shouldUseQuietCollapsedRuntimeSummary
    ? `chatx-inline-think__toggle ${isThinking ? 'is-thinking' : 'is-complete'}`
    : `chatx-inline-think__toggle chatx-governance-summary__toggle ${isThinking ? 'is-thinking' : 'is-complete'}`;
  const cognitionBadgeClassName = shouldUseQuietCollapsedRuntimeSummary
    ? `chatx-inline-think__badge ${isThinking ? 'is-thinking' : 'is-complete'}`
    : `chatx-inline-think__badge chatx-governance-summary__icon ${isThinking ? 'is-thinking' : 'is-complete'}`;

  return (
    <div className="chatx-assistant-stack">
      <div className={cognitionSummaryClassName}>
        <button
          type="button"
          className={cognitionToggleClassName}
          onClick={canExpandCognition ? options.onToggleCognition : undefined}
        >
          {isThinking ? (
            <span className={cognitionBadgeClassName} aria-hidden="true">
              <span className="chatx-inline-think__loader">
                <span className="chatx-inline-think__bar" />
                <span className="chatx-inline-think__bar" />
                <span className="chatx-inline-think__bar" />
              </span>
            </span>
          ) : (
            <span className={cognitionBadgeClassName} aria-hidden="true">
              <span className="chatx-inline-think__dot" />
            </span>
          )}
          <span className="chatx-inline-think__copy">
            {titleLabel ? (
              <span className={`chatx-inline-think__label ${isThinking ? 'is-thinking' : 'is-complete'}`}>
                {titleLabel}
                {showCountLabel ? (
                  <span className="chatx-inline-think__meta"> · {options.cognitionCountLabel}</span>
                ) : null}
              </span>
            ) : null}
            <span className="chatx-inline-think__summary">{cognitionSummary}</span>
          </span>
          <span
            aria-hidden="true"
            className={`chatx-inline-think__action ${messageCognitionExpanded ? 'is-visible' : ''}`}
          >
            {canExpandCognition ? (
              <span className={`chatx-inline-think__chevron ${messageCognitionExpanded ? 'is-open' : ''}`}>⌄</span>
            ) : null}
          </span>
        </button>
        {messageCognitionExpanded ? (
          <div className="chatx-inline-think__panel">
            {messageThinkState ? (
              <div className="chatx-inline-think__block">
                <Think
                  title={messageThinkState.title}
                  loading={messageThinkState.loading}
                  blink={messageThinkState.blink}
                  defaultExpanded
                >
                  <Text>
                    {messageThinkState.loading && messageThoughtItems?.[0]?.description
                      ? toPlainSummary(messageThoughtItems[0].description)
                      : messageThinkState.content}
                  </Text>
                </Think>
              </div>
            ) : null}
            {inlineThinkContent ? (
              <div className="chatx-inline-think__block">
                <Think title="模型推理" defaultExpanded>
                  <Text>{inlineThinkContent}</Text>
                </Think>
              </div>
            ) : null}
            {messageThoughtItems?.length ? (
              <div className="chatx-inline-think__block">
                <ThoughtChain
                  items={messageThoughtItems}
                  defaultExpandedKeys={messageThoughtItems.slice(0, 2).map(item => item.key as string)}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {thinkingPanel}
      {beforeContent}
      {content}
      {afterContent}
      {evidenceContent}
    </div>
  );
}

function normalizeEscapedThinkTags(content: string) {
  return content
    .replace(/^(\s*)&lt;think&gt;/i, '$1<think>')
    .replace(/^(\s*<think>[\s\S]*?)&lt;\/think&gt;/i, '$1</think>');
}

function formatCognitionDurationCopy(durationLabel: string) {
  const normalized = durationLabel.trim();
  if (!normalized) {
    return '';
  }

  return normalized.startsWith('约') ? `用时${normalized}` : `用时 ${normalized}`;
}

const DEFAULT_UNHELPFUL_REASON: ChatMessageFeedbackReasonCode = 'too_shallow';

function renderMessageFooter(
  message: ChatMessageRecord,
  options: Pick<
    BuildBubbleItemsOptions,
    'activeStatus' | 'agentThinking' | 'copiedMessageId' | 'onCopy' | 'onRegenerate' | 'onMessageFeedback'
  > & {
    isLatestAssistant?: boolean;
  }
) {
  if (message.role !== 'assistant' && message.role !== 'user') {
    return undefined;
  }

  const copied = options.copiedMessageId === message.id;
  const isAssistant = message.role === 'assistant';
  const regenerateDisabled =
    options.activeStatus === 'running' || Boolean(options.agentThinking) || (isAssistant && !options.isLatestAssistant);
  const helpfulPressed = message.feedback?.rating === 'helpful';
  const unhelpfulPressed = message.feedback?.rating === 'unhelpful';

  return (
    <div className={`chatx-bubble-footer ${isAssistant ? 'is-assistant' : 'is-user'}`}>
      <Button
        size="small"
        type="text"
        className="chatx-copy-button chatx-message-action-button"
        icon={<CopyGlyph copied={copied} />}
        onClick={() => options.onCopy(message)}
        aria-label={copied ? '已复制' : '复制消息'}
      />
      {isAssistant ? (
        <>
          <Button
            size="small"
            type="text"
            className="chatx-message-action-button"
            icon={<ReloadOutlined />}
            onClick={() => options.onRegenerate?.(message)}
            disabled={regenerateDisabled}
            aria-label="重新生成"
          />
          <Button
            size="small"
            type="text"
            className={`chatx-message-action-button ${helpfulPressed ? 'is-active' : ''}`}
            icon={<LikeOutlined />}
            onClick={() =>
              options.onMessageFeedback?.(message, {
                rating: helpfulPressed ? 'none' : 'helpful'
              })
            }
            aria-label="点赞"
            aria-pressed={helpfulPressed}
          />
          <Button
            size="small"
            type="text"
            className={`chatx-message-action-button ${unhelpfulPressed ? 'is-active' : ''}`}
            icon={<DislikeOutlined />}
            onClick={() =>
              options.onMessageFeedback?.(message, {
                rating: unhelpfulPressed ? 'none' : 'unhelpful',
                reasonCode: unhelpfulPressed ? undefined : DEFAULT_UNHELPFUL_REASON
              })
            }
            aria-label="点踩"
            aria-pressed={unhelpfulPressed}
          />
        </>
      ) : null}
    </div>
  );
}

export function buildBubbleItems({
  messages,
  activeStatus,
  agentThinking,
  copiedMessageId,
  onCopy,
  onRegenerate,
  onMessageFeedback,
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
  cognitionCountLabel,
  responseStepsByMessageId
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

      const isCurrentStreamingAssistant =
        message.id === lastAssistantMessageId && (activeStatus === 'running' || Boolean(agentThinking));
      const shouldKeepEmptyAssistantShell =
        message.role === 'assistant' &&
        !message.content.trim() &&
        (isCurrentStreamingAssistant || message.id === resolvedCognitionTargetMessageId);

      if (message.role === 'assistant' && !message.content.trim() && !shouldKeepEmptyAssistantShell) {
        return false;
      }

      return true;
    })
    .map(message => {
      const isStreamingAssistant =
        message.id === lastAssistantMessageId && (activeStatus === 'running' || Boolean(agentThinking));
      const shouldAttachEvidence =
        message.id === lastAssistantMessageId && inlineEvidenceMessage && !containsCitationSection(message.content);
      const responseSteps = message.role === 'assistant' ? responseStepsByMessageId?.[message.id] : undefined;

      return {
        key: message.id,
        role: message.role === 'user' ? 'user' : message.role === 'assistant' ? 'ai' : 'system',
        avatar:
          message.role === 'assistant' ? (
            <span className="chatx-assistant-avatar chatx-brand-mark" aria-hidden="true" />
          ) : undefined,
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
          inlineEvidenceMessage: shouldAttachEvidence ? inlineEvidenceMessage : undefined,
          responseSteps
        }),
        header:
          message.role === 'system' && message.linkedAgent ? (
            <Tag color="geekblue">{getAgentLabel(message.linkedAgent)}</Tag>
          ) : undefined,
        footer: renderMessageFooter(message, {
          activeStatus,
          agentThinking,
          copiedMessageId,
          isLatestAssistant: message.id === lastAssistantMessageId,
          onCopy,
          onRegenerate,
          onMessageFeedback
        }),
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
