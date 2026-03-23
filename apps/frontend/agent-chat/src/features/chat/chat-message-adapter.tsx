import { Button, Space, Tag } from 'antd';
import { XMarkdown } from '@ant-design/x-markdown';
import type { BubbleItemType } from '@ant-design/x';

import type { ChatMessageRecord, ChatSessionRecord } from '../../types/chat';

export type AgentLabelResolver = (role?: string) => string;

export interface BuildBubbleItemsOptions {
  messages: ChatMessageRecord[];
  activeStatus?: ChatSessionRecord['status'];
  copiedMessageId?: string;
  onCopy: (message: ChatMessageRecord) => void;
  onApprovalAction?: (intent: string, approved: boolean) => void;
  onApprovalFeedback?: (intent: string, reason?: string) => void;
  getAgentLabel: AgentLabelResolver;
  runningHint?: string;
}

function CopyGlyph({ copied }: { copied: boolean }) {
  if (copied) {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M6.4 11.4L3.6 8.6l1-1 1.8 1.8 5-5 1 1-6 6Z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M5 2.5A1.5 1.5 0 0 1 6.5 1h5A1.5 1.5 0 0 1 13 2.5v7A1.5 1.5 0 0 1 11.5 11h-5A1.5 1.5 0 0 1 5 9.5v-7Zm1.5-.5a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 .5.5h5a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.5-.5h-5Z"
        fill="currentColor"
      />
      <path
        d="M3.5 5A1.5 1.5 0 0 0 2 6.5v6A1.5 1.5 0 0 0 3.5 14h5A1.5 1.5 0 0 0 10 12.5V12H9v.5a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5v-6a.5.5 0 0 1 .5-.5H4V5h-.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function renderMessageContent(
  message: ChatMessageRecord,
  streaming: boolean,
  options: Pick<BuildBubbleItemsOptions, 'onApprovalAction' | 'onApprovalFeedback'>
) {
  if (message.card?.type === 'approval_request') {
    const approvalCard = message.card;
    return (
      <div className="chatx-approval-card">
        <div className="chatx-markdown-shell is-system">
          <XMarkdown content={message.content} className="chatx-markdown" escapeRawHtml />
        </div>
        <div className="chatx-approval-card__meta">
          <Tag
            color={approvalCard.riskLevel === 'high' ? 'red' : approvalCard.riskLevel === 'medium' ? 'orange' : 'blue'}
          >
            {approvalCard.riskLevel ?? 'unknown'}
          </Tag>
          {approvalCard.toolName ? <Tag>{approvalCard.toolName}</Tag> : null}
          {approvalCard.requestedBy ? <Tag>{approvalCard.requestedBy}</Tag> : null}
        </div>
        <Space wrap>
          <Button size="small" type="primary" onClick={() => options.onApprovalAction?.(approvalCard.intent, true)}>
            准奏
          </Button>
          <Button size="small" onClick={() => options.onApprovalAction?.(approvalCard.intent, false)}>
            驳回
          </Button>
          <Button
            size="small"
            type="dashed"
            onClick={() => options.onApprovalFeedback?.(approvalCard.intent, approvalCard.reason)}
          >
            打回并批注
          </Button>
        </Space>
      </div>
    );
  }

  if (message.role === 'assistant' || message.role === 'system') {
    return (
      <div className={`chatx-markdown-shell ${message.role === 'system' ? 'is-system' : 'is-assistant'}`}>
        <XMarkdown
          content={message.content}
          streaming={streaming ? { hasNextChunk: true, tail: true } : undefined}
          openLinksInNewTab
          escapeRawHtml
          className="chatx-markdown"
        />
      </div>
    );
  }

  return <div className="chatx-plain-message">{message.content}</div>;
}

export function buildBubbleItems({
  messages,
  activeStatus,
  copiedMessageId,
  onCopy,
  onApprovalAction,
  onApprovalFeedback,
  getAgentLabel,
  runningHint
}: BuildBubbleItemsOptions): BubbleItemType[] {
  const lastAssistantMessageId = [...messages].reverse().find(message => message.role === 'assistant')?.id;

  const items: BubbleItemType[] = messages.map(message => {
    const isStreamingAssistant = message.id === lastAssistantMessageId && activeStatus === 'running';

    return {
      key: message.id,
      role: message.role === 'user' ? 'user' : message.role === 'assistant' ? 'ai' : 'system',
      content: renderMessageContent(message, isStreamingAssistant, { onApprovalAction, onApprovalFeedback }),
      header: message.linkedAgent ? <Tag color="geekblue">{getAgentLabel(message.linkedAgent)}</Tag> : undefined,
      footer: (
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
      ),
      footerPlacement: message.role === 'user' ? 'outer-end' : 'outer-start',
      placement: message.role === 'user' ? 'end' : 'start',
      variant: message.role === 'user' ? 'filled' : message.role === 'system' ? 'outlined' : 'shadow',
      shape: 'round',
      typing: isStreamingAssistant,
      streaming: isStreamingAssistant
    };
  });

  if (runningHint) {
    items.push({
      key: '__running__',
      role: 'ai',
      content: (
        <div className="chatx-markdown-shell is-system">
          <XMarkdown content={runningHint} className="chatx-markdown" escapeRawHtml />
        </div>
      ),
      header: <Tag color="blue">系统执行中</Tag>,
      placement: 'start',
      variant: 'outlined',
      shape: 'round',
      loading: activeStatus === 'running'
    });
  }

  return items;
}
