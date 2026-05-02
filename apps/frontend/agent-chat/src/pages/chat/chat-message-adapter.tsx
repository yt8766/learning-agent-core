import { Button, Tag, Typography } from 'antd';
import { Think, ThoughtChain } from '@ant-design/x';
import type { BubbleItemType, ThoughtChainItemType } from '@ant-design/x';

import { CopyGlyph, renderStructuredMessageCard } from '@/components/chat-message-cards';
import type { ChatResponseStepsState } from '@/lib/chat-response-step-projections';
import type { ChatMessageRecord, ChatSessionRecord, ChatThinkState } from '@/types/chat';
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
      ? parseAssistantThinkingContent(stripStreamingCursor(message.content), streaming)
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
    (messageThinkState || (messageThoughtItems?.length ?? 0) > 0 || Boolean(assistantParsed?.thinkContent));
  const shouldSuppressCompletedTargetCognition = Boolean(
    isCognitionTarget && messageThinkState && !messageThinkState.loading && normalizedMessage.content.trim()
  );
  const shouldShowCognition =
    message.role === 'assistant' &&
    !shouldSuppressCompletedTargetCognition &&
    (hasTargetCognition || Boolean(assistantParsed?.thinkContent) || Boolean(normalizedMessage.content.trim()));

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

  const inlineThinkContent = assistantParsed?.thinkContent ?? '';
  const isThinking = Boolean(messageThinkState?.loading);
  const cognitionSummary = buildCognitionSummary(
    messageThinkState?.loading && messageThoughtItems?.[0]?.description
      ? toPlainSummary(messageThoughtItems[0].description)
      : (messageThinkState?.content ?? inlineThinkContent),
    toPlainSummary(messageThoughtItems?.[0]?.description)
  );
  const statusLabel = isThinking ? '思考中' : '已思考';
  const showCountLabel = isThinking && options.cognitionCountLabel;
  const titleLabel =
    isCognitionTarget && options.cognitionDurationLabel
      ? `${statusLabel}（${formatCognitionDurationCopy(options.cognitionDurationLabel)}）`
      : statusLabel;
  const canExpandCognition =
    Boolean(messageThinkState) || Boolean(inlineThinkContent) || Boolean(messageThoughtItems?.length);

  return (
    <div className="chatx-assistant-stack">
      <div className="chatx-inline-think chatx-governance-summary">
        <button
          type="button"
          className={`chatx-inline-think__toggle chatx-governance-summary__toggle ${
            isThinking ? 'is-thinking' : 'is-complete'
          }`}
          onClick={canExpandCognition ? options.onToggleCognition : undefined}
        >
          {isThinking ? (
            <span className="chatx-inline-think__badge chatx-governance-summary__icon is-thinking" aria-hidden="true">
              <span className="chatx-inline-think__loader">
                <span className="chatx-inline-think__bar" />
                <span className="chatx-inline-think__bar" />
                <span className="chatx-inline-think__bar" />
              </span>
            </span>
          ) : (
            <span className="chatx-inline-think__badge chatx-governance-summary__icon is-complete" aria-hidden="true">
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

function formatCognitionDurationCopy(durationLabel: string) {
  const normalized = durationLabel.trim();
  if (!normalized) {
    return '';
  }

  return normalized.startsWith('约') ? `用时${normalized}` : `用时 ${normalized}`;
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
