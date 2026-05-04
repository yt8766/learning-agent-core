import { Actions, type BubbleItemType, type BubbleListProps } from '@ant-design/x';
import XMarkdown from '@ant-design/x-markdown';
import { Flex, Space, Spin, Tag, Typography } from 'antd';
import type { Dispatch, SetStateAction } from 'react';

import type { ChatMessage, Citation, CreateFeedbackRequest } from '../../types/api';

export type FeedbackValue = 'default' | 'like' | 'dislike';

interface ChatLabAiExtraInfo {
  citations: Citation[];
  diagnostics?: ChatMessage['diagnostics'];
  feedback?: FeedbackValue;
  messageId: string;
  route?: ChatMessage['route'];
  traceId?: string;
}

export function createChatRoles({
  setMessageFeedback,
  submitFeedback
}: {
  setMessageFeedback: Dispatch<SetStateAction<Record<string, FeedbackValue>>>;
  submitFeedback: (messageId: string, input: CreateFeedbackRequest) => Promise<unknown>;
}) {
  return {
    ai: {
      contentRender: (content: unknown) => <XMarkdown>{String(content ?? '')}</XMarkdown>,
      footer: (content: unknown, { extraInfo, key }: { extraInfo?: unknown; key?: string | number }) => {
        const info = extraInfo as ChatLabAiExtraInfo | undefined;
        if (!info?.messageId) {
          return null;
        }
        const text = String(content ?? '');
        return (
          <Space orientation="vertical" size={8}>
            <Actions
              items={[
                {
                  actionRender: () => <Actions.Copy text={text} />,
                  key: 'copy',
                  label: 'copy'
                },
                {
                  actionRender: () => (
                    <Actions.Feedback
                      key="feedback"
                      onChange={value => {
                        const nextFeedback = value as FeedbackValue;
                        setMessageFeedback(current => ({ ...current, [String(key)]: nextFeedback }));
                        if (nextFeedback === 'like') {
                          void submitFeedback(info.messageId, { category: 'helpful', rating: 'positive' });
                        }
                        if (nextFeedback === 'dislike') {
                          void submitFeedback(info.messageId, { category: 'not_helpful', rating: 'negative' });
                        }
                      }}
                      styles={{
                        liked: {
                          color: '#f759ab'
                        }
                      }}
                      value={info.feedback ?? 'default'}
                    />
                  ),
                  key: 'feedback'
                }
              ]}
            />
            <Space orientation="vertical" size={8}>
              <Space wrap>
                {info.route ? <Tag>{info.route.reason}</Tag> : null}
                {info.diagnostics ? (
                  <Typography.Text type="secondary">{info.diagnostics.retrievalMode}</Typography.Text>
                ) : null}
                {info.traceId ? (
                  <Typography.Link href={`/observability?traceId=${info.traceId}`}>
                    Trace {info.traceId}
                  </Typography.Link>
                ) : null}
              </Space>
              <CitationList citations={info.citations} />
            </Space>
          </Space>
        );
      },
      loadingRender: () => (
        <Flex align="center" gap="small">
          <Spin size="small" />
          <Typography.Text type="secondary">正在检索知识库...</Typography.Text>
        </Flex>
      ),
      placement: 'start' as const,
      typing: (_content: unknown, { status }: { status?: string }) =>
        status === 'updating' ? { effect: 'typing' as const, interval: 20, step: 5 } : false,
      variant: 'borderless' as const
    },
    system: { placement: 'start' as const, variant: 'outlined' as const },
    user: { placement: 'end' as const, variant: 'filled' as const }
  } satisfies NonNullable<BubbleListProps['role']>;
}

export function toBubbleMessage(message: ChatMessage, feedback: Record<string, FeedbackValue>): BubbleItemType {
  if (message.role === 'assistant') {
    return {
      content: message.content,
      extraInfo: {
        citations: message.citations ?? [],
        diagnostics: message.diagnostics,
        feedback: feedback[message.id],
        messageId: message.id,
        route: message.route,
        traceId: message.traceId
      } satisfies ChatLabAiExtraInfo,
      key: message.id,
      role: 'ai',
      status: 'success'
    };
  }
  return {
    content: message.content,
    key: message.id,
    role: message.role === 'system' ? 'system' : 'user'
  };
}

function CitationList({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) {
    return <Typography.Text type="secondary">引用来源：无</Typography.Text>;
  }

  return (
    <div className="knowledge-chat-citations">
      <Typography.Text strong>引用来源</Typography.Text>
      {citations.map(citation => {
        const score = typeof citation.score === 'number' ? citation.score.toFixed(2) : undefined;
        return (
          <div className="knowledge-chat-citation" key={citation.id}>
            <Space orientation="vertical" size={4}>
              <Typography.Text strong>{citation.title}</Typography.Text>
              <Typography.Text>{citation.quote}</Typography.Text>
              <Space wrap>
                {score ? <Tag>score {score}</Tag> : null}
                {citation.uri ? <Typography.Text type="secondary">{citation.uri}</Typography.Text> : null}
              </Space>
            </Space>
          </div>
        );
      })}
    </div>
  );
}
