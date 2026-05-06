import type { WorkbenchThoughtProjectionItem } from '@/types/workbench-thought-projection';

import { renderStructuredMessageCard } from '@/components/chat-message-cards';
import { CognitionThoughtLog } from '@/components/cognition';
import type { ChatResponseStepsState } from '@/utils/chat-response-step-projections';
import type { ChatMessageFeedbackInput, ChatMessageRecord, ChatThinkState } from '@/types/chat';
import { cn } from '@/utils/cn';

import {
  buildCognitionSummary,
  formatCognitionDurationLabelFromMs,
  parseAssistantThinkingContent,
  stripStreamingCursor,
  stripWorkflowCommandPrefix,
  toPlainSummary
} from './chat-message-adapter-helpers';
import { renderMessageResponseSteps } from './chat-message-response-steps';
import { MessageThinkingPanel } from './message-thinking-panel';
import { useEffect, useState } from 'react';

function shouldSuppressBeforeContentResponseSteps(
  message: ChatMessageRecord,
  thoughtItems?: WorkbenchThoughtProjectionItem[]
): boolean {
  if (message.role !== 'assistant') {
    return false;
  }
  const fromSnapshot = message.cognitionSnapshot?.thoughtChain?.some(
    item => item.kind === 'reasoning' || item.kind === 'web_search' || item.kind === 'browser'
  );
  if (fromSnapshot) {
    return true;
  }
  return Boolean(thoughtItems?.some(item => item.itemVariant === 'web_search' || item.itemVariant === 'browser'));
}

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
  thoughtItems?: WorkbenchThoughtProjectionItem[];
  cognitionExpandedForMessage?: boolean;
  onToggleCognition?: (messageId: string) => void;
  cognitionDurationLabel?: string;
  cognitionCountLabel?: string;
  inlineEvidenceMessage?: ChatMessageRecord;
  responseSteps?: ChatResponseStepsState['byMessageId'][string];
  hasNextChunk?: boolean;
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
    placement: 'before-content',
    suppressForNarrativeCognition: shouldSuppressBeforeContentResponseSteps(message, options.thoughtItems)
  });
  const afterContent = renderMessageResponseSteps({
    responseSteps: options.responseSteps,
    placement: 'after-content'
  });
  const isAgentExecutionResponse = options.responseSteps?.displayMode === 'agent_execution';
  const hasBubbleCognitionData = Boolean(options.thinkState || (options.thoughtItems?.length ?? 0) > 0);
  const suppressStandaloneThinkingPanel = hasBubbleCognitionData;
  const thinkingPanel =
    !isAgentExecutionResponse &&
    !suppressStandaloneThinkingPanel &&
    message.role === 'assistant' &&
    assistantParsed &&
    assistantParsed.thinkingState !== 'none' ? (
      <MessageThinkingPanel
        content={assistantParsed.thinkContent}
        state={assistantParsed.thinkingState}
        durationLabel={<ThinkingDurationLabel thinkState={options.thinkState} />}
      />
    ) : null;
  const evidenceContent =
    !shouldInlineEvidence && options.inlineEvidenceMessage
      ? renderStructuredMessageCard(options.inlineEvidenceMessage, false, options)
      : null;
  const messageThinkState = options.thinkState;
  const messageThoughtItems = options.thoughtItems;
  const messageCognitionExpanded = Boolean(options.cognitionExpandedForMessage);
  const hasRuntimeTargetCognition = Boolean(messageThinkState || (messageThoughtItems?.length ?? 0) > 0);
  const hasInlineModelThink = Boolean(assistantParsed?.thinkContent);
  const shouldShowCognition =
    !isAgentExecutionResponse &&
    message.role === 'assistant' &&
    (hasRuntimeTargetCognition ||
      (!thinkingPanel && hasInlineModelThink) ||
      (!thinkingPanel && !hasRuntimeTargetCognition && Boolean(normalizedMessage.content.trim())));

  if (!shouldShowCognition) {
    if (!thinkingPanel && !beforeContent && !afterContent && !evidenceContent) {
      return content;
    }

    return (
      <div className={cn('chatx-assistant-stack', 'flex min-w-0 flex-col gap-4')}>
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
  const summarySource = isThinking
    ? messageThoughtItems?.[0]?.description
      ? toPlainSummary(messageThoughtItems[0].description)
      : (messageThinkState?.content ?? inlineThinkContent)
    : inlineThinkContent;
  const cognitionSummary = buildCognitionSummary(summarySource, toPlainSummary(messageThoughtItems?.[0]?.description));
  const statusLabel = isThinking ? '思考中' : '已思考';
  const showCountLabel = isThinking && options.cognitionCountLabel;
  const shouldUseQuietCollapsedRuntimeSummary = Boolean(
    hasRuntimeTargetCognition && !messageCognitionExpanded && !isThinking && !thinkingPanel
  );
  const durationNode = options.thinkState ? <ThinkingDurationLabel thinkState={options.thinkState} /> : null;
  const titleLabel = shouldUseQuietCollapsedRuntimeSummary ? (
    durationNode ? (
      <>
        {statusLabel}（{durationNode}）
      </>
    ) : (
      ''
    )
  ) : (
    <>
      {statusLabel}
      {durationNode ? <>（{durationNode}）</> : null}
    </>
  );
  const canExpandCognition =
    Boolean(inlineThinkContent) || Boolean(messageThoughtItems?.length) || Boolean(messageThinkState);
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
    <div className={cn('chatx-assistant-stack', 'flex min-w-0 flex-col gap-4')}>
      <div className={cognitionSummaryClassName}>
        <button
          type="button"
          className={cognitionToggleClassName}
          onClick={canExpandCognition ? () => options.onToggleCognition?.(message.id) : undefined}
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
            <CognitionThoughtLog
              items={buildUnifiedCognitionItems(
                inlineThinkContent,
                assistantParsed?.thinkingState,
                messageThoughtItems
              )}
              variant={isThinking ? 'processing' : 'processed'}
            />
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
  if (!content.startsWith('&lt;think&gt;') && !/^\s*&lt;think&gt;/i.test(content)) {
    return content;
  }

  return content.replace(/&lt;think&gt;/gi, '<think>').replace(/&lt;\/think&gt;/gi, '</think>');
}

function formatCognitionDurationCopy(durationLabel: string) {
  const normalized = durationLabel.trim();
  if (!normalized) {
    return '';
  }

  return normalized.startsWith('约') ? `用时${normalized}` : `用时 ${normalized}`;
}

function buildUnifiedCognitionItems(
  inlineThinkContent: string | undefined,
  thinkingState: string | undefined,
  thoughtItems: WorkbenchThoughtProjectionItem[] | undefined
): WorkbenchThoughtProjectionItem[] {
  const items: WorkbenchThoughtProjectionItem[] = [];

  if (inlineThinkContent) {
    items.push({
      key: 'inline-think-reasoning',
      title: '推理',
      description: inlineThinkContent.length > 120 ? `${inlineThinkContent.slice(0, 120)}…` : inlineThinkContent,
      status: thinkingState === 'streaming' ? 'loading' : 'success',
      itemVariant: 'reasoning'
    });
  }

  if (thoughtItems?.length) {
    // 按 key 去重，保留第一个出现的
    const seenKeys = new Set<string>();
    for (const item of thoughtItems) {
      if (!seenKeys.has(item.key)) {
        seenKeys.add(item.key);
        items.push(item);
      }
    }
  }

  return items;
}

const MAX_COGNITION_MS = 30 * 60 * 1000;

function formatLoadingDurationLabel(ms: number): string {
  const totalMs = Math.min(Math.max(0, ms), MAX_COGNITION_MS);
  const seconds = Math.max(1, Math.round(totalMs / 1000));
  return `用时 ${seconds}s`;
}

function formatCompletedDurationLabel(durationMs?: number): string {
  if (typeof durationMs !== 'number' || durationMs <= 0) {
    return '';
  }
  const formatted = formatCognitionDurationLabelFromMs(durationMs);
  if (!formatted) return '';
  return formatted.startsWith('约') ? `用时${formatted}` : `用时 ${formatted}`;
}

function ThinkingDurationLabel({ thinkState }: { thinkState?: ChatThinkState }) {
  const [label, setLabel] = useState(() =>
    thinkState?.loading
      ? formatLoadingDurationLabel(thinkState.thinkingDurationMs ?? 0)
      : formatCompletedDurationLabel(thinkState?.thinkingDurationMs)
  );

  useEffect(() => {
    if (!thinkState?.loading) {
      setLabel(formatCompletedDurationLabel(thinkState?.thinkingDurationMs));
      return;
    }
    const baseMs = thinkState.thinkingDurationMs ?? 0;
    const startAt = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startAt;
      setLabel(formatLoadingDurationLabel(baseMs + elapsed));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [thinkState?.loading, thinkState?.thinkingDurationMs]);

  if (!label) return null;
  return <>{label}</>;
}
