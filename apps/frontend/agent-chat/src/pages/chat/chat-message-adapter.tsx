import { Button, Tag } from 'antd';
import { DislikeOutlined, LikeOutlined, ReloadOutlined } from '@ant-design/icons';
import type { BubbleItemType, ThoughtChainItemType } from '@ant-design/x';

import { CopyGlyph } from '@/components/chat-message-cards';
import type { ChatResponseStepsState } from '@/lib/chat-response-step-projections';
import type {
  ChatMessageFeedbackInput,
  ChatMessageFeedbackReasonCode,
  ChatMessageRecord,
  ChatSessionRecord,
  ChatThinkState
} from '@/types/chat';
import { buildMainThreadMessages, containsCitationSection } from './chat-message-adapter-helpers';
import { renderMessageContent } from './chat-message-content';

export type AgentLabelResolver = (role?: string) => string;
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
