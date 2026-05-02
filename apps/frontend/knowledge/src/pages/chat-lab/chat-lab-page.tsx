import { useState } from 'react';
import XMarkdown from '@ant-design/x-markdown/es';
import Bubble, { type BubbleItemType } from '@ant-design/x/es/bubble';
import Conversations from '@ant-design/x/es/conversations';
import Sender from '@ant-design/x/es/sender';
import Welcome from '@ant-design/x/es/welcome';
import { useXConversations } from '@ant-design/x-sdk';
import { Button, Card, Space, Tag, Typography } from 'antd';

import { useKnowledgeChat } from '../../hooks/use-knowledge-chat';
import { PageSection } from '../shared/ui';

const defaultConversations = [
  {
    key: 'frontend',
    label: '前端规范问答'
  },
  {
    key: 'runtime',
    label: '检索治理会话'
  }
];

export function ChatLabPage() {
  const [question, setQuestion] = useState('动态导入有什么限制？');
  const { error, feedbackMessage, loading, response, sendMessage, submitFeedback } = useKnowledgeChat();
  const { activeConversationKey, conversations, setActiveConversationKey } = useXConversations({
    defaultActiveConversationKey: 'frontend',
    defaultConversations
  });

  const messages: BubbleItemType[] = [
    {
      content: question,
      key: 'question',
      role: 'user'
    },
    response
      ? {
          content: <XMarkdown>{response.answer}</XMarkdown>,
          footer: (
            <Space wrap>
              {response.traceId ? (
                <Typography.Link href={`/observability?traceId=${response.traceId}`}>Trace</Typography.Link>
              ) : null}
              <Typography.Text type="secondary">
                引用: {response.citations.map(item => item.title).join(', ') || '无'}
              </Typography.Text>
              <Button
                size="small"
                onClick={() =>
                  void submitFeedback(response.assistantMessage.id, { category: 'helpful', rating: 'positive' })
                }
              >
                有帮助
              </Button>
              <Button
                size="small"
                onClick={() =>
                  void submitFeedback(response.assistantMessage.id, { category: 'not_helpful', rating: 'negative' })
                }
              >
                待改进
              </Button>
            </Space>
          ),
          key: 'answer',
          role: 'ai'
        }
      : {
          content: '选择知识库后输入问题，系统会返回回答、引用和 trace 线索。',
          key: 'placeholder',
          role: 'system'
        }
  ];

  async function submit(message: string) {
    if (!message.trim()) {
      return;
    }
    setQuestion(message);
    await sendMessage({
      conversationId: activeConversationKey,
      debug: true,
      knowledgeBaseIds: ['kb_frontend'],
      message
    });
  }

  return (
    <PageSection subTitle="Ant Design X 驱动的 RAG 对话验证台" title="对话实验室">
      <div className="knowledge-chat-layout">
        <Card title="会话">
          <Conversations
            activeKey={activeConversationKey}
            items={conversations}
            onActiveChange={setActiveConversationKey}
          />
        </Card>
        <Card>
          <div className="knowledge-chat-panel">
            <Welcome
              description="使用当前知识库验证回答、引用和 Trace 输出"
              title={
                <Space>
                  Ant Design X<Tag color="processing">Chat Lab</Tag>
                </Space>
              }
            />
            <div className="knowledge-chat-bubbles">
              <Bubble.List
                items={messages}
                role={{
                  ai: { placement: 'start', variant: 'filled' },
                  system: { placement: 'start', variant: 'outlined' },
                  user: { placement: 'end', variant: 'filled' }
                }}
              />
            </div>
            <Sender
              loading={loading}
              onChange={setQuestion}
              onSubmit={submit}
              placeholder="输入一个需要检索知识库的问题"
              value={question}
            />
            {error ? <Typography.Text type="danger">{error.message}</Typography.Text> : null}
            {feedbackMessage ? <Typography.Text type="success">反馈已记录</Typography.Text> : null}
            <Typography.Text type="secondary">当前知识库：前端知识库 / debug trace 已开启</Typography.Text>
          </div>
        </Card>
      </div>
    </PageSection>
  );
}
