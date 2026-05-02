import { Button, Tag } from 'antd';
import type { BubbleItemType, ThoughtChainItemType } from '@ant-design/x';

import { CopyGlyph, renderStructuredMessageCard } from '@/components/chat-message-cards';
import type { ChatResponseStepsState } from '@/lib/chat-response-step-projections';
import type { ChatMessageRecord, ChatSessionRecord, ChatThinkState } from '@/types/chat';
import {
  buildMainThreadMessages,
  containsCitationSection,
  parseAssistantThinkingContent,
  stripStreamingCursor,
  stripWorkflowCommandPrefix
} from './chat-message-adapter-helpers';
import { MessageThinkingPanel } from './message-thinking-panel';
import { renderMessageResponseSteps } from './chat-message-response-steps';

export type AgentLabelResolver = (role?: string) => string;
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
    'onApprovalAction' | 'onApprovalAllowAlways' | 'onApprovalFeedback' | 'onPlanAction' | 'onSkillInstall'
  > & {
    inlineEvidenceMessage?: ChatMessageRecord;
    responseSteps?: ChatResponseStepsState['byMessageId'][string];
    thinkingDurationLabel?: string;
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
        durationLabel={options.thinkingDurationLabel}
      />
    ) : null;
  const evidenceContent =
    !shouldInlineEvidence && options.inlineEvidenceMessage
      ? renderStructuredMessageCard(options.inlineEvidenceMessage, false, options)
      : null;
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
  cognitionDurationLabel,
  cognitionTargetMessageId,
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
        avatar: undefined,
        content: renderMessageContent(message, isStreamingAssistant, {
          onApprovalAction,
          onApprovalAllowAlways,
          onApprovalFeedback,
          onSkillInstall,
          inlineEvidenceMessage: shouldAttachEvidence ? inlineEvidenceMessage : undefined,
          responseSteps,
          thinkingDurationLabel: cognitionDurationLabel
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
        variant: message.role === 'user' ? 'filled' : message.role === 'system' ? 'outlined' : 'borderless',
        shape: 'round',
        typing: isStreamingAssistant,
        streaming: isStreamingAssistant
      };
    });

  return items;
}
