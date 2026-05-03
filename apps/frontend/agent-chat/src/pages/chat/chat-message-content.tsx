import { Typography } from 'antd';
import { Think, ThoughtChain } from '@ant-design/x';
import type { ThoughtChainItemType } from '@ant-design/x';

import { renderStructuredMessageCard } from '@/components/chat-message-cards';
import type { ChatResponseStepsState } from '@/lib/chat-response-step-projections';
import type { ChatMessageFeedbackInput, ChatMessageRecord, ChatThinkState } from '@/types/chat';
import {
  buildCognitionSummary,
  containsCitationSection,
  parseAssistantThinkingContent,
  stripStreamingCursor,
  stripWorkflowCommandPrefix,
  toPlainSummary
} from './chat-message-adapter-helpers';
import { renderMessageResponseSteps } from './chat-message-response-steps';
import { MessageThinkingPanel } from './message-thinking-panel';

const { Text } = Typography;

type RenderMessageContentOptions = {
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
  onMessageFeedback?: (message: ChatMessageRecord, feedback: ChatMessageFeedbackInput) => void;
  thinkState?: ChatThinkState;
  thoughtItems?: ThoughtChainItemType[];
  cognitionTargetMessageId?: string;
  cognitionExpanded?: boolean;
  onToggleCognition?: () => void;
  cognitionDurationLabel?: string;
  cognitionCountLabel?: string;
  inlineEvidenceMessage?: ChatMessageRecord;
  responseSteps?: ChatResponseStepsState['byMessageId'][string];
};

export function renderMessageContent(
  message: ChatMessageRecord,
  streaming: boolean,
  options: RenderMessageContentOptions
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
  const isAgentExecutionResponse = options.responseSteps?.displayMode === 'agent_execution';
  const thinkingPanel =
    !isAgentExecutionResponse &&
    message.role === 'assistant' &&
    assistantParsed &&
    assistantParsed.thinkingState !== 'none' ? (
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
    !isAgentExecutionResponse &&
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
