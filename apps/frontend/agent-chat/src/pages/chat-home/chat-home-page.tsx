import {
  Alert,
  App as AntApp,
  Avatar,
  Button,
  ConfigProvider,
  Input,
  Layout,
  Segmented,
  Space,
  Tag,
  Typography
} from 'antd';
import { Bubble, Conversations, Sender, Welcome, XProvider } from '@ant-design/x';
import type { BubbleItemType, ConversationItemType, ThoughtChainItemType } from '@ant-design/x';
import { useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';

import { ChatRuntimeDrawer } from '../../features/runtime-panel/chat-runtime-drawer';
import { useChatSession, formatSessionTime, getSessionStatusLabel } from '../../hooks/use-chat-session';
import '../../styles/chat-home-page.css';

const { Search } = Input;
const { Header, Sider, Content } = Layout;
const { Text, Title } = Typography;

type SessionFilter = 'all' | 'running' | 'approval' | 'failed' | 'completed';

const AGENT_LABELS: Record<string, string> = {
  manager: '主 Agent',
  research: 'Research Agent',
  executor: 'Executor Agent',
  reviewer: 'Reviewer Agent'
};

const EVENT_LABELS: Record<string, string> = {
  session_started: '会话启动',
  user_message: '用户消息',
  manager_planned: '主 Agent 规划',
  subtask_dispatched: '任务分派',
  research_progress: 'Research 进展',
  tool_selected: '工具选择',
  tool_called: '工具调用',
  approval_required: '等待审批',
  approval_resolved: '审批完成',
  review_completed: 'Review 完成',
  learning_pending_confirmation: '等待学习确认',
  learning_confirmed: '学习已确认',
  conversation_compacted: '对话已压缩',
  assistant_message: 'Agent 回复',
  session_finished: '会话完成',
  session_failed: '会话失败'
};

const FILTER_OPTIONS: Array<{ label: string; value: SessionFilter }> = [
  { label: '全部', value: 'all' },
  { label: '进行中', value: 'running' },
  { label: '待审批', value: 'approval' },
  { label: '失败', value: 'failed' },
  { label: '已完成', value: 'completed' }
];

function getAgentLabel(role?: string) {
  if (!role) {
    return '';
  }
  return AGENT_LABELS[role] ?? role;
}

function buildEventSummary(eventItem: { type: string; payload: Record<string, unknown> }) {
  const payload = eventItem.payload;
  if (typeof payload.content === 'string' && payload.content) {
    return payload.content;
  }
  if (typeof payload.summary === 'string' && payload.summary) {
    return payload.summary;
  }
  if (typeof payload.reason === 'string' && payload.reason) {
    return payload.reason;
  }
  if (typeof payload.error === 'string' && payload.error) {
    return payload.error;
  }
  if (Array.isArray(payload.candidates)) {
    return `生成 ${payload.candidates.length} 个学习候选`;
  }
  return '事件已记录';
}

function getSessionBadgeStatus(status?: string): 'success' | 'error' | 'processing' | 'default' | 'warning' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'error';
    case 'waiting_approval':
    case 'waiting_learning_confirmation':
      return 'warning';
    case 'running':
      return 'processing';
    default:
      return 'default';
  }
}

function getConversationGroup(status?: string) {
  switch (status) {
    case 'running':
    case 'waiting_approval':
    case 'waiting_learning_confirmation':
      return '进行中';
    case 'completed':
      return '已完成';
    case 'failed':
      return '失败';
    default:
      return '空闲';
  }
}

function getStatusPill(status?: string) {
  switch (status) {
    case 'running':
      return '运行中';
    case 'waiting_approval':
      return '待审批';
    case 'waiting_learning_confirmation':
      return '待学习';
    case 'completed':
      return '已完成';
    case 'failed':
      return '失败';
    default:
      return '空闲';
  }
}

function matchesFilter(status: string | undefined, filter: SessionFilter) {
  switch (filter) {
    case 'running':
      return status === 'running' || status === 'waiting_learning_confirmation';
    case 'approval':
      return status === 'waiting_approval';
    case 'failed':
      return status === 'failed';
    case 'completed':
      return status === 'completed';
    default:
      return true;
  }
}

function getRunningHint(status?: string, currentStep?: string) {
  if (status === 'waiting_approval') {
    return '系统已执行到高风险动作，正在等待人工审批。';
  }
  if (status === 'waiting_learning_confirmation') {
    return '本轮结果已完成，正在等待学习确认后写入长期知识。';
  }
  if (status === 'running') {
    return `正在执行 ${currentStep || '当前节点'}，稍后会继续推送 Agent 消息。`;
  }
  return '';
}

function getCompressionHint(session?: { compression?: { condensedMessageCount: number } }) {
  if (!session?.compression?.condensedMessageCount) {
    return '';
  }

  return `为控制上下文长度，系统已自动压缩较早的 ${session.compression.condensedMessageCount} 条消息。`;
}

export function ChatHomePage() {
  const chat = useChatSession();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('all');

  const conversationItems = useMemo<ConversationItemType[]>(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    return chat.sessions
      .filter(
        session =>
          (!keyword || session.title.toLowerCase().includes(keyword)) && matchesFilter(session.status, sessionFilter)
      )
      .map(session => {
        const badgeStatus = getSessionBadgeStatus(session.status);
        const shouldPulse = session.status === 'running' || session.status === 'waiting_approval';

        return {
          key: session.id,
          group: getConversationGroup(session.status),
          label: (
            <div className={`conversation-item ${shouldPulse ? 'is-live' : ''}`}>
              <div className="conversation-item__header">
                <Text strong ellipsis>
                  {session.title}
                </Text>
                <Space size={6}>
                  <span className={`conversation-item__dot ${badgeStatus}`} />
                  <Tag
                    bordered={false}
                    color={
                      badgeStatus === 'processing'
                        ? 'blue'
                        : badgeStatus === 'warning'
                          ? 'orange'
                          : badgeStatus === 'error'
                            ? 'red'
                            : badgeStatus === 'success'
                              ? 'green'
                              : 'default'
                    }
                  >
                    {getStatusPill(session.status)}
                  </Tag>
                </Space>
              </div>
              <Text type="secondary" className="conversation-item__meta">
                {getSessionStatusLabel(session.status)} · {formatSessionTime(session.updatedAt)}
              </Text>
            </div>
          )
        };
      });
  }, [chat.sessions, searchKeyword, sessionFilter]);

  const runningHint = getRunningHint(chat.activeSession?.status, chat.checkpoint?.graphState.currentStep);
  const compressionHint = getCompressionHint(chat.activeSession);

  const bubbleItems = useMemo<BubbleItemType[]>(() => {
    const lastAssistantMessageId = [...chat.messages].reverse().find(message => message.role === 'assistant')?.id;

    const items: BubbleItemType[] = chat.messages.map(message => ({
      key: message.id,
      role: message.role === 'user' ? 'user' : message.role === 'assistant' ? 'ai' : 'system',
      content: message.content,
      header: message.linkedAgent ? <Tag color="geekblue">{getAgentLabel(message.linkedAgent)}</Tag> : undefined,
      placement: message.role === 'user' ? 'end' : 'start',
      variant: message.role === 'user' ? 'filled' : 'shadow',
      shape: 'round',
      typing: message.id === lastAssistantMessageId && chat.activeSession?.status === 'running',
      streaming: message.id === lastAssistantMessageId && chat.activeSession?.status === 'running'
    }));

    if (runningHint) {
      items.push({
        key: '__running__',
        role: 'ai',
        content: runningHint,
        header: <Tag color="blue">系统执行中</Tag>,
        placement: 'start',
        variant: 'outlined',
        shape: 'round',
        loading: chat.activeSession?.status === 'running'
      });
    }

    return items;
  }, [chat.messages, chat.activeSession?.status, runningHint]);

  const thoughtItems = useMemo<ThoughtChainItemType[]>(() => {
    return chat.events
      .slice()
      .reverse()
      .map(eventItem => {
        const payload = eventItem.payload ?? {};
        const meta = [
          typeof payload.from === 'string' ? `来源：${getAgentLabel(payload.from)}` : '',
          typeof payload.node === 'string' ? `节点：${payload.node}` : '',
          typeof payload.intent === 'string' ? `意图：${payload.intent}` : '',
          typeof payload.decision === 'string' ? `结果：${payload.decision}` : ''
        ]
          .filter(Boolean)
          .join(' · ');

        return {
          key: eventItem.id,
          title: EVENT_LABELS[eventItem.type] ?? eventItem.type,
          description: buildEventSummary(eventItem),
          footer: meta || formatSessionTime(eventItem.at),
          status:
            eventItem.type === 'session_failed'
              ? 'error'
              : eventItem.type === 'session_finished'
                ? 'success'
                : 'loading',
          collapsible: Boolean(meta)
        };
      });
  }, [chat.events]);

  return (
    <ConfigProvider>
      <XProvider>
        <AntApp>
          <Layout className="chatx-layout">
            <Sider width={312} theme="light" className="chatx-sider">
              <div className="chatx-brand">
                <Avatar size={40} className="chatx-brand__avatar">
                  A
                </Avatar>
                <div>
                  <Title level={4}>Agent Chat</Title>
                  <Text type="secondary">多 Agent 对话入口</Text>
                </div>
              </div>

              <Button
                type="primary"
                size="large"
                block
                className="chatx-new-chat"
                onClick={() => void chat.createNewSession()}
              >
                新建对话
              </Button>

              <Search
                allowClear
                placeholder="搜索会话"
                value={searchKeyword}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setSearchKeyword(event.target.value)}
                className="chatx-search"
              />

              <Segmented
                block
                size="small"
                options={FILTER_OPTIONS}
                value={sessionFilter}
                onChange={value => setSessionFilter(value as SessionFilter)}
                className="chatx-filter"
              />

              <Conversations
                items={conversationItems}
                activeKey={chat.activeSessionId}
                onActiveChange={value => chat.setActiveSessionId(String(value))}
                className="chatx-conversations"
                groupable={{
                  label: group => <span className="chatx-group-label">{group}</span>
                }}
              />
            </Sider>

            <Layout>
              <Header className="chatx-header">
                <div>
                  <Title level={4}>{chat.activeSession?.title ?? 'Agent Chat'}</Title>
                  <Space wrap size={8}>
                    <Tag color="blue">SSE 事件流</Tag>
                    <Tag color="purple">GLM 多模型协作</Tag>
                    {chat.activeSession ? (
                      <Tag color={getSessionBadgeStatus(chat.activeSession.status)}>
                        {getSessionStatusLabel(chat.activeSession.status)}
                      </Tag>
                    ) : null}
                  </Space>
                </div>
                <Space>
                  <Button onClick={() => chat.activeSessionId && void chat.refreshSessionDetail()}>刷新</Button>
                  <Button type="primary" onClick={() => chat.setShowRightPanel(true)}>
                    运行态
                  </Button>
                </Space>
              </Header>

              <Content className="chatx-content">
                <div className="chatx-main-card">
                  {!chat.hasMessages ? (
                    <div className="chatx-welcome-wrap">
                      <Welcome
                        variant="borderless"
                        title="提出问题"
                        description="主 Agent 会调度 Research、Executor、Reviewer 一起完成会话，并通过 SSE 实时回传执行过程。"
                        extra={<Tag color="blue">会话 + 事件流 + 学习确认</Tag>}
                      />
                    </div>
                  ) : null}

                  {runningHint ? (
                    <Alert type="info" showIcon message={runningHint} className="chatx-running-alert" />
                  ) : null}
                  {compressionHint ? (
                    <Alert type="success" showIcon message={compressionHint} className="chatx-running-alert" />
                  ) : null}
                  {chat.error ? <Alert type="error" showIcon message={chat.error} /> : null}

                  {chat.activeSession?.status === 'waiting_approval' && chat.pendingApprovals.length ? (
                    <div className="chatx-inline-actions">
                      {chat.pendingApprovals.map(approval => (
                        <Alert
                          key={approval.intent}
                          type="warning"
                          showIcon
                          className="chatx-running-alert"
                          message={`检测到高风险动作：${approval.intent}`}
                          description={
                            <Space wrap>
                              <Text type="secondary">{approval.reason || '该动作需要你确认后才会继续执行。'}</Text>
                              <Button
                                type="primary"
                                size="small"
                                onClick={() => void chat.updateApproval(approval.intent, true)}
                              >
                                继续执行
                              </Button>
                              <Button size="small" onClick={() => void chat.updateApproval(approval.intent, false)}>
                                拒绝执行
                              </Button>
                            </Space>
                          }
                        />
                      ))}
                    </div>
                  ) : null}

                  {chat.activeSession?.status === 'failed' ? (
                    <Alert
                      type="error"
                      showIcon
                      className="chatx-running-alert"
                      message="系统执行被中断"
                      description={
                        <Space wrap>
                          <Text type="secondary">你可以恢复当前会话，让系统基于现有上下文继续下一步。</Text>
                          <Button type="primary" size="small" onClick={() => void chat.recoverActiveSession()}>
                            继续下一步
                          </Button>
                        </Space>
                      }
                    />
                  ) : null}

                  <Bubble.List
                    items={bubbleItems}
                    autoScroll
                    role={{
                      ai: {
                        avatar: <Avatar style={{ background: '#1677ff' }}>AI</Avatar>,
                        placement: 'start',
                        variant: 'shadow',
                        shape: 'round'
                      },
                      user: {
                        avatar: <Avatar style={{ background: '#111827' }}>你</Avatar>,
                        placement: 'end',
                        variant: 'filled',
                        shape: 'round'
                      },
                      system: {
                        avatar: <Avatar style={{ background: '#7c3aed' }}>系</Avatar>,
                        placement: 'start',
                        variant: 'outlined',
                        shape: 'round'
                      }
                    }}
                    className="chatx-bubble-list"
                  />

                  <Sender
                    value={chat.draft}
                    onChange={value => chat.setDraft(value)}
                    onSubmit={value => void chat.sendMessage(value)}
                    loading={chat.loading}
                    placeholder="输入你的问题，系统会启动主 Agent 和子 Agent 协作"
                    autoSize={{ minRows: 1, maxRows: 6 }}
                    className="chatx-sender"
                    prefix={
                      <Space size={6} wrap>
                        <Tag color="purple">SSE 流式事件</Tag>
                        {chat.checkpoint?.graphState.currentStep ? (
                          <Tag>{chat.checkpoint.graphState.currentStep}</Tag>
                        ) : null}
                      </Space>
                    }
                  />
                </div>
              </Content>
            </Layout>

            <ChatRuntimeDrawer
              open={chat.showRightPanel}
              activeSession={chat.activeSession}
              checkpoint={chat.checkpoint}
              pendingApprovals={chat.pendingApprovals}
              thoughtItems={thoughtItems}
              onClose={() => chat.setShowRightPanel(false)}
              onApprove={(intent, approved) => void chat.updateApproval(intent, approved)}
              onConfirmLearning={() => void chat.submitLearningConfirmation()}
              onRecover={() => void chat.recoverActiveSession()}
              getAgentLabel={getAgentLabel}
              getSessionStatusLabel={getSessionStatusLabel}
            />
          </Layout>
        </AntApp>
      </XProvider>
    </ConfigProvider>
  );
}
