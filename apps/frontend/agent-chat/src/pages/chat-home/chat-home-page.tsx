import {
  Alert,
  App as AntApp,
  Avatar,
  Button,
  Collapse,
  ConfigProvider,
  Input,
  Layout,
  Modal,
  Segmented,
  Space,
  Tag,
  Typography
} from 'antd';
import { Bubble, Conversations, Sender, Think, Welcome, XProvider } from '@ant-design/x';
import type { BubbleItemType, ConversationItemType, ThoughtChainItemType } from '@ant-design/x';
import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';

import { buildBubbleItems } from '../../features/chat/chat-message-adapter';
import { ChatRuntimeDrawer } from '../../features/runtime-panel/chat-runtime-drawer';
import { useChatSession, formatSessionTime, getSessionStatusLabel } from '../../hooks/use-chat-session';
import '../../styles/chat-home-page.css';

const { Search } = Input;
const { TextArea } = Input;
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
  decree_received: '圣旨已接收',
  session_started: '会话启动',
  user_message: '用户消息',
  supervisor_planned: '首辅已规划',
  libu_routed: '吏部已路由',
  ministry_started: '尚书开始执行',
  ministry_reported: '尚书提交战报',
  skill_resolved: '流程模板已解析',
  skill_stage_started: '流程阶段开始',
  skill_stage_completed: '流程阶段完成',
  manager_planned: '主 Agent 规划',
  subtask_dispatched: '任务分派',
  research_progress: 'Research 进展',
  tool_selected: '工具选择',
  tool_called: '工具调用',
  approval_required: '等待审批',
  approval_resolved: '审批完成',
  approval_rejected_with_feedback: '打回并附批注',
  review_completed: 'Review 完成',
  learning_pending_confirmation: '等待学习确认',
  learning_confirmed: '学习已确认',
  conversation_compacted: '对话已压缩',
  assistant_token: '流式回复',
  assistant_message: 'Agent 回复',
  run_resumed: '流程已恢复',
  run_cancelled: '流程已终止',
  final_response_delta: '最终回复流式片段',
  final_response_completed: '最终回复完成',
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

const MINISTRY_LABELS: Record<string, string> = {
  libu: '吏部',
  hubu: '户部',
  libu_docs: '礼部',
  bingbu: '兵部',
  xingbu: '刑部',
  gongbu: '工部'
};

function getAgentLabel(role?: string) {
  if (!role) {
    return '';
  }
  return AGENT_LABELS[role] ?? role;
}

function getMinistryLabel(ministry?: string) {
  if (!ministry) {
    return '未分派';
  }

  return MINISTRY_LABELS[ministry] ?? ministry;
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
    case 'cancelled':
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
    case 'cancelled':
      return '已终止';
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
    case 'cancelled':
      return '已终止';
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
      return status === 'failed' || status === 'cancelled';
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

function getWorkflowSummary(requiredMinistries?: string[]) {
  if (!requiredMinistries?.length) {
    return '首辅将按通用流程自行调度各部。';
  }

  return requiredMinistries.map(ministry => getMinistryLabel(ministry)).join(' -> ');
}

function getRiskColor(riskLevel?: string) {
  switch (riskLevel) {
    case 'high':
      return 'red';
    case 'medium':
      return 'orange';
    case 'low':
      return 'blue';
    default:
      return 'default';
  }
}

function getMinistryTone(ministry?: string) {
  switch (ministry) {
    case 'libu':
      return 'blue';
    case 'hubu':
      return 'cyan';
    case 'libu_docs':
      return 'gold';
    case 'bingbu':
      return 'volcano';
    case 'xingbu':
      return 'red';
    case 'gongbu':
      return 'green';
    default:
      return 'default';
  }
}

function getErrorCopy(error: string) {
  if (error === 'Network Error' || error === 'Failed to fetch') {
    return {
      title: '连接后端失败',
      description: '当前无法访问聊天后端。请确认 agent-server 已启动，并检查 `VITE_API_BASE_URL` 是否指向正确地址。'
    };
  }

  return {
    title: '工作台诊断',
    description: error
  };
}

function MenuGlyph({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" className="chatx-menu-glyph">
      <path d={path} fill="currentColor" />
    </svg>
  );
}

function RenameGlyph() {
  return (
    <MenuGlyph path="M11.7 1.3a1 1 0 0 1 1.4 0l1.6 1.6a1 1 0 0 1 0 1.4l-8.2 8.2-3.2.8.8-3.2 8.2-8.2ZM10.9 3.1 4.9 9.1l-.4 1.4 1.4-.4 6-6-1-1ZM3 13h10v1H3v-1Z" />
  );
}

function ShareGlyph() {
  return (
    <MenuGlyph path="M11.5 10a2.5 2.5 0 0 0-1.9.9L6.8 9.4a2.7 2.7 0 0 0 0-2.8l2.8-1.5a2.5 2.5 0 1 0-.5-.9L6.3 5.7a2.5 2.5 0 1 0 0 4.6l2.8 1.5a2.5 2.5 0 1 0 2.4-1.8Zm0-8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM4.5 6.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm7 7a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
  );
}

function ArchiveGlyph() {
  return <MenuGlyph path="M3 2h10l1 2v1H2V4l1-2Zm0 4h10v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Zm3 2v1h4V8H6Z" />;
}

function DeleteGlyph() {
  return <MenuGlyph path="M6 2h4l.5 1H13v1H3V3h2.5L6 2Zm-1 3h1v7H5V5Zm5 0h1v7h-1V5ZM7 5h1v7H7V5Z" />;
}

export function ChatHomePage() {
  const chat = useChatSession();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('all');
  const [feedbackIntent, setFeedbackIntent] = useState('');
  const [feedbackDraft, setFeedbackDraft] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState('');
  const [showWorkbench, setShowWorkbench] = useState(false);
  const [dismissedError, setDismissedError] = useState('');

  useEffect(() => {
    if (chat.error && chat.error !== dismissedError) {
      setDismissedError('');
    }
  }, [chat.error, dismissedError]);

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
          title: session.title,
          label: (
            <div className={`conversation-item ${shouldPulse ? 'is-live' : ''}`}>
              <div className="conversation-item__header">
                <Text strong ellipsis>
                  {session.title}
                </Text>
                <Space size={6}>
                  <span className={`conversation-item__dot ${badgeStatus}`} />
                  <Tag
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
          ),
          'data-session-id': session.id
        };
      });
  }, [chat.sessions, searchKeyword, sessionFilter]);

  const runningHint = getRunningHint(chat.activeSession?.status, chat.checkpoint?.graphState.currentStep);
  const compressionHint = getCompressionHint(chat.activeSession);

  const bubbleItems = useMemo<BubbleItemType[]>(
    () =>
      buildBubbleItems({
        messages: chat.messages,
        activeStatus: chat.activeSession?.status,
        copiedMessageId,
        runningHint,
        getAgentLabel,
        onApprovalAction: (intent, approved) => void chat.updateApproval(intent, approved),
        onApprovalFeedback: (intent, reason) => {
          setFeedbackIntent(intent);
          setFeedbackDraft(reason ?? '');
        },
        onCopy: message => {
          void navigator.clipboard.writeText(message.content);
          setCopiedMessageId(message.id);
          window.setTimeout(() => {
            setCopiedMessageId(current => (current === message.id ? '' : current));
          }, 1800);
        }
      }),
    [chat.messages, chat.activeSession?.status, copiedMessageId, runningHint]
  );

  const thoughtItems = useMemo<ThoughtChainItemType[]>(() => {
    if (chat.checkpoint?.thoughtChain?.length) {
      return chat.checkpoint.thoughtChain.map(item => ({
        key: item.key,
        title: item.title,
        description: item.description,
        content: item.content ? <pre className="chatx-thought-raw">{item.content}</pre> : undefined,
        footer: item.footer,
        status: item.status,
        collapsible: item.collapsible,
        blink: item.blink
      }));
    }

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
  }, [chat.checkpoint?.thoughtChain, chat.events]);

  const thinkState = chat.checkpoint?.thinkState;

  const streamEvents = useMemo(() => {
    return chat.events
      .slice()
      .reverse()
      .map(eventItem => ({
        id: eventItem.id,
        type: EVENT_LABELS[eventItem.type] ?? eventItem.type,
        summary: buildEventSummary(eventItem),
        at: formatSessionTime(eventItem.at),
        raw: JSON.stringify(eventItem.payload ?? {}, null, 2)
      }));
  }, [chat.events]);

  const routeSummary = chat.checkpoint?.modelRoute?.[chat.checkpoint.modelRoute.length - 1];
  const errorCopy = chat.error ? getErrorCopy(chat.error) : null;

  return (
    <ConfigProvider>
      <XProvider>
        <AntApp>
          <Layout className="chatx-layout">
            <Sider width={312} theme="light" className="chatx-sider">
              <div className="chatx-brand">
                <Avatar size={46} className="chatx-brand__avatar">
                  AC
                </Avatar>
                <div className="chatx-brand__copy">
                  <Title level={4}>Agent Core</Title>
                </div>
              </div>

              <div className="chatx-sidebar-note">
                <Tag color="blue">SSE 实时事件</Tag>
                <Tag color="cyan">多 Agent 调度</Tag>
                <Tag color="gold">审批与学习</Tag>
              </div>

              <Button
                type="primary"
                size="large"
                htmlType="button"
                block
                style={{ width: '280px' }}
                className="chatx-new-chat"
                onClick={() => chat.createNewSession()}
              >
                开始新对话
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
                menu={conversation =>
                  conversation.key
                    ? {
                        className: 'chatx-conversation-menu',
                        items: [
                          {
                            key: 'rename',
                            label: (
                              <span className="chatx-conversation-menu__item">
                                <RenameGlyph />
                                <span>Rename</span>
                              </span>
                            )
                          },
                          {
                            key: 'share',
                            label: (
                              <span className="chatx-conversation-menu__item">
                                <ShareGlyph />
                                <span>Share</span>
                              </span>
                            )
                          },
                          {
                            type: 'divider'
                          },
                          {
                            key: 'archive',
                            disabled: true,
                            label: (
                              <span className="chatx-conversation-menu__item is-disabled">
                                <ArchiveGlyph />
                                <span>Archive</span>
                              </span>
                            )
                          },
                          {
                            key: 'delete',
                            label: (
                              <span className="chatx-conversation-menu__item is-danger">
                                <DeleteGlyph />
                                <span>Delete Chat</span>
                              </span>
                            ),
                            danger: true
                          }
                        ],
                        onClick: ({ key }) => {
                          if (key === 'rename') {
                            let nextTitle = String(conversation.title ?? '');
                            Modal.confirm({
                              title: '重命名会话',
                              content: (
                                <Input
                                  autoFocus
                                  defaultValue={nextTitle}
                                  maxLength={80}
                                  onChange={event => {
                                    nextTitle = event.target.value;
                                  }}
                                />
                              ),
                              okText: '保存',
                              cancelText: '取消',
                              onOk: async () => {
                                await chat.renameSessionById(String(conversation.key), nextTitle);
                              }
                            });
                            return;
                          }

                          if (key === 'share') {
                            const shareUrl = `${window.location.origin}${window.location.pathname}?sessionId=${encodeURIComponent(String(conversation.key))}`;
                            void navigator.clipboard.writeText(shareUrl);
                            return;
                          }

                          if (key !== 'delete') {
                            return;
                          }
                          Modal.confirm({
                            title: '删除当前会话？',
                            content: '删除后，这个会话的聊天记录、事件流和检查点都会一起移除。',
                            okText: '删除',
                            okButtonProps: { danger: true },
                            cancelText: '取消',
                            onOk: async () => {
                              await chat.deleteSessionById(String(conversation.key));
                            }
                          });
                        },
                        trigger: (_conversation, info) => (
                          <span className="chatx-conversation-menu-trigger" aria-label="会话操作">
                            {info.originNode}
                          </span>
                        )
                      }
                    : undefined
                }
                className="chatx-conversations"
                groupable={{
                  label: group => <span className="chatx-group-label">{group}</span>
                }}
              />
            </Sider>

            <Layout>
              <Header className="chatx-header">
                <div className="chatx-header__copy">
                  <Text className="chatx-header__eyebrow">Agent Workspace</Text>
                  <Title level={4}>{chat.activeSession?.title ?? '欢迎来到 Agent Chat'}</Title>
                  <Space wrap size={8} className="chatx-header__tags">
                    <Tag color="blue">实时回答</Tag>
                    <Tag color="geekblue">GLM 协作推理</Tag>
                    <Tag color="purple">事件可观测</Tag>
                    {chat.checkpoint?.resolvedWorkflow ? (
                      <Tag color="gold">{chat.checkpoint.resolvedWorkflow.displayName}</Tag>
                    ) : null}
                    {chat.activeSession ? (
                      <Tag color={getSessionBadgeStatus(chat.activeSession.status)}>
                        {getSessionStatusLabel(chat.activeSession.status)}
                      </Tag>
                    ) : null}
                  </Space>
                </div>
                <Space>
                  <Button htmlType="button" onClick={() => chat.activeSessionId && void chat.refreshSessionDetail()}>
                    刷新
                  </Button>
                  {chat.activeSession?.status === 'running' ? (
                    <Button htmlType="button" danger onClick={() => void chat.cancelActiveSession()}>
                      停止生成
                    </Button>
                  ) : null}
                  {chat.activeSessionId ? (
                    <Button
                      htmlType="button"
                      danger
                      onClick={() => {
                        Modal.confirm({
                          title: '删除当前会话？',
                          content: '删除后，这个会话的聊天记录、事件流和检查点都会一起移除。',
                          okText: '删除',
                          okButtonProps: { danger: true },
                          cancelText: '取消',
                          onOk: async () => {
                            await chat.deleteActiveSession();
                          }
                        });
                      }}
                    >
                      删除会话
                    </Button>
                  ) : null}
                  <Button htmlType="button" onClick={() => setShowWorkbench(current => !current)}>
                    {showWorkbench ? '关闭工作台' : '打开工作台'}
                  </Button>
                  <Button htmlType="button" type="primary" onClick={() => chat.setShowRightPanel(true)}>
                    运行态
                  </Button>
                </Space>
              </Header>

              <Content className="chatx-content">
                <div className="chatx-main-card">
                  {chat.error && dismissedError !== chat.error && errorCopy ? (
                    <Alert
                      type="error"
                      showIcon
                      closable
                      className="chatx-error-card"
                      title={errorCopy.title}
                      description={errorCopy.description}
                      onClose={() => setDismissedError(chat.error)}
                    />
                  ) : null}

                  <div className={`chatx-workbench ${showWorkbench ? 'is-workbench-open' : 'is-workbench-closed'}`}>
                    <section className="chatx-chat-column">
                      <div className="chatx-chat-surface">
                        {!chat.hasMessages ? (
                          <div className="chatx-welcome-wrap">
                            <Welcome
                              variant="borderless"
                              title="开始一段真正可观测的 AI 对话"
                              description="直接下达任务，首辅会调度六部尚书，并把路由、审批、战报和最终答复完整呈现在工作台上。"
                              extra={
                                <Space size={8} wrap>
                                  <Tag color="blue">首辅调度</Tag>
                                  <Tag color="cyan">六部协作</Tag>
                                  <Tag color="purple">奏折审批</Tag>
                                </Space>
                              }
                            />
                          </div>
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
                              variant: 'shadow',
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
                      </div>

                      <div className="chatx-composer-shell">
                        <div className="chatx-composer-meta">
                          <Space size={6} wrap>
                            <Tag color="purple">SSE 流式返回</Tag>
                            {chat.checkpoint?.skillId ? <Tag color="gold">Skill: {chat.checkpoint.skillId}</Tag> : null}
                            {chat.checkpoint?.graphState.currentStep ? (
                              <Tag>{chat.checkpoint.graphState.currentStep}</Tag>
                            ) : null}
                            {chat.activeSessionId ? (
                              <Tag color="default">Session 已连接</Tag>
                            ) : (
                              <Tag color="gold">将自动创建会话</Tag>
                            )}
                          </Space>
                        </div>
                        <Sender
                          value={chat.draft}
                          onChange={value => chat.setDraft(value)}
                          onSubmit={value => void chat.sendMessage(value)}
                          loading={chat.activeSession?.status === 'running'}
                          onCancel={() => void chat.cancelActiveSession()}
                          placeholder="输入问题，或使用 /review /qa /browse /ship /retro 等 Skill 命令"
                          autoSize={{ minRows: 1, maxRows: 6 }}
                        />
                      </div>
                    </section>

                    {showWorkbench ? (
                      <aside className="chatx-side-column">
                        {thinkState ? (
                          <section className="chatx-think-panel">
                            <Think
                              title={thinkState.title}
                              loading={thinkState.loading}
                              blink={thinkState.blink}
                              defaultExpanded
                            >
                              <Text>{thinkState.content}</Text>
                            </Think>
                          </section>
                        ) : null}

                        {runningHint ? (
                          <Alert type="info" showIcon title={runningHint} className="chatx-running-alert" />
                        ) : null}
                        {compressionHint ? (
                          <Alert type="success" showIcon title={compressionHint} className="chatx-running-alert" />
                        ) : null}

                        {chat.checkpoint ? (
                          <section className="chatx-war-room">
                            <div className="chatx-war-room__header">
                              <div>
                                <Text strong>内阁看板</Text>
                                <Text type="secondary">这轮圣旨的尚书分派、模型路由与奏折批注会集中展示在这里。</Text>
                              </div>
                              <Space size={8} wrap>
                                {chat.checkpoint.skillId ? (
                                  <Tag color="gold">Skill: {chat.checkpoint.skillId}</Tag>
                                ) : null}
                                {chat.checkpoint.runId ? <Tag>Run {chat.checkpoint.runId.slice(0, 8)}</Tag> : null}
                              </Space>
                            </div>

                            <div className="chatx-war-room__grid">
                              <article className="chatx-war-card">
                                <Text className="chatx-war-card__label">首辅规划</Text>
                                <Title level={5}>
                                  {chat.checkpoint.resolvedWorkflow?.displayName ?? '通用调度流程'}
                                </Title>
                                <Text type="secondary">
                                  {getWorkflowSummary(chat.checkpoint.resolvedWorkflow?.requiredMinistries)}
                                </Text>
                                <div className="chatx-war-card__meta">
                                  <Tag color="purple">
                                    {chat.checkpoint.graphState.currentStep ?? '等待首辅继续规划'}
                                  </Tag>
                                  {chat.checkpoint.skillStage ? <Tag>{chat.checkpoint.skillStage}</Tag> : null}
                                </div>
                              </article>

                              <article className="chatx-war-card">
                                <Text className="chatx-war-card__label">当值尚书</Text>
                                <Title level={5}>{getMinistryLabel(chat.checkpoint.currentMinistry)}</Title>
                                <Text type="secondary">
                                  {chat.checkpoint.currentWorker
                                    ? `当前执行官：${chat.checkpoint.currentWorker}`
                                    : '尚未选定具体执行官'}
                                </Text>
                                <div className="chatx-war-card__meta">
                                  <Tag color={getMinistryTone(chat.checkpoint.currentMinistry)}>
                                    {chat.checkpoint.currentNode ?? '等待进入节点'}
                                  </Tag>
                                  {routeSummary ? <Tag color="blue">{routeSummary.selectedModel}</Tag> : null}
                                </div>
                              </article>

                              <article className="chatx-war-card">
                                <Text className="chatx-war-card__label">吏部路由</Text>
                                <Title level={5}>{routeSummary?.selectedModel ?? '待决策'}</Title>
                                <Text type="secondary">
                                  {routeSummary
                                    ? `${getMinistryLabel(routeSummary.ministry)} 默认 ${routeSummary.defaultModel}，本轮调整理由：${routeSummary.reason}`
                                    : '当前还没有模型路由决策记录。'}
                                </Text>
                                <div className="chatx-war-card__meta">
                                  {routeSummary ? <Tag>{routeSummary.workerId}</Tag> : <Tag>等待吏部分发</Tag>}
                                </div>
                              </article>
                            </div>

                            {chat.checkpoint.approvalFeedback ? (
                              <article className="chatx-decree-note">
                                <div className="chatx-decree-note__header">
                                  <Tag color="red">最近批注</Tag>
                                  <Text type="secondary">皇帝已打回上一份奏折</Text>
                                </div>
                                <Text>{chat.checkpoint.approvalFeedback}</Text>
                              </article>
                            ) : null}

                            {chat.checkpoint.pendingApproval ? (
                              <article className="chatx-decree-note is-pending">
                                <div className="chatx-decree-note__header">
                                  <Tag color="orange">待批奏折</Tag>
                                  <Tag color={getRiskColor(chat.checkpoint.pendingApproval.riskLevel)}>
                                    风险 {chat.checkpoint.pendingApproval.riskLevel ?? 'unknown'}
                                  </Tag>
                                </div>
                                <Text strong>{chat.checkpoint.pendingApproval.intent}</Text>
                                <Text type="secondary">
                                  {chat.checkpoint.pendingApproval.reason ?? '该动作需要你拍板后才会继续执行。'}
                                </Text>
                                <Space size={8} wrap>
                                  <Tag>{chat.checkpoint.pendingApproval.toolName}</Tag>
                                  <Tag>{chat.checkpoint.pendingApproval.requestedBy}</Tag>
                                </Space>
                              </article>
                            ) : null}
                          </section>
                        ) : null}

                        {chat.activeSession?.status === 'waiting_approval' && chat.pendingApprovals.length ? (
                          <div className="chatx-inline-actions">
                            {chat.pendingApprovals.map(approval => (
                              <Alert
                                key={approval.intent}
                                type="warning"
                                showIcon
                                className="chatx-running-alert"
                                title={`检测到高风险动作：${approval.intent}`}
                                description={
                                  <Space wrap>
                                    <Text type="secondary">
                                      {approval.reason || '该动作需要你确认后才会继续执行。'}
                                    </Text>
                                    <Button
                                      type="primary"
                                      size="small"
                                      onClick={() => void chat.updateApproval(approval.intent, true)}
                                    >
                                      继续执行
                                    </Button>
                                    <Button
                                      size="small"
                                      onClick={() => void chat.updateApproval(approval.intent, false)}
                                    >
                                      拒绝执行
                                    </Button>
                                    <Button
                                      size="small"
                                      type="dashed"
                                      onClick={() => {
                                        setFeedbackIntent(approval.intent);
                                        setFeedbackDraft(approval.reason ?? '');
                                      }}
                                    >
                                      打回并附批注
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
                            title="系统执行被中断"
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

                        {streamEvents.length ? (
                          <section className="chatx-stream-panel">
                            <div className="chatx-stream-panel__header">
                              <div>
                                <Text strong>实时事件流</Text>
                                <Text type="secondary">/api/chat/stream</Text>
                              </div>
                              <Tag color="blue">{streamEvents.length} 条事件</Tag>
                            </div>
                            <div className="chatx-stream-panel__list">
                              <Collapse
                                ghost
                                size="small"
                                className="chatx-stream-collapse"
                                items={streamEvents.map(eventItem => ({
                                  key: eventItem.id,
                                  label: (
                                    <div className="chatx-stream-event__label">
                                      <div className="chatx-stream-event__label-main">
                                        <Tag bordered={false} color="processing">
                                          {eventItem.type}
                                        </Tag>
                                        <Text className="chatx-stream-event__summary">{eventItem.summary}</Text>
                                      </div>
                                      <Text type="secondary">{eventItem.at}</Text>
                                    </div>
                                  ),
                                  children: (
                                    <article className="chatx-stream-event">
                                      <pre className="chatx-stream-event__raw">{eventItem.raw}</pre>
                                    </article>
                                  )
                                }))}
                              />
                            </div>
                          </section>
                        ) : null}
                      </aside>
                    ) : null}
                  </div>
                </div>
              </Content>
            </Layout>

            <ChatRuntimeDrawer
              open={chat.showRightPanel}
              activeSession={chat.activeSession}
              checkpoint={chat.checkpoint}
              thinkState={thinkState}
              pendingApprovals={chat.pendingApprovals}
              thoughtItems={thoughtItems}
              onClose={() => chat.setShowRightPanel(false)}
              onApprove={(intent, approved, feedback) => void chat.updateApproval(intent, approved, feedback)}
              onConfirmLearning={() => void chat.submitLearningConfirmation()}
              onRecover={() => void chat.recoverActiveSession()}
              getAgentLabel={getAgentLabel}
              getSessionStatusLabel={getSessionStatusLabel}
            />
            <Modal
              title="打回奏折并附批注"
              open={Boolean(feedbackIntent)}
              okText="提交打回意见"
              cancelText="取消"
              onCancel={() => {
                setFeedbackIntent('');
                setFeedbackDraft('');
              }}
              onOk={() => {
                if (!feedbackIntent) {
                  return;
                }
                void chat.updateApproval(feedbackIntent, false, feedbackDraft.trim() || undefined);
                setFeedbackIntent('');
                setFeedbackDraft('');
              }}
            >
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Text type="secondary">批注意见会回注到当前 Skill 流程，首辅会据此重新规划或结束执行。</Text>
                <TextArea
                  rows={5}
                  value={feedbackDraft}
                  onChange={event => setFeedbackDraft(event.target.value)}
                  placeholder="例如：重写，这里的动画不够丝滑；或者：先不要发布，补充回归测试报告。"
                />
              </Space>
            </Modal>
          </Layout>
        </AntApp>
      </XProvider>
    </ConfigProvider>
  );
}
