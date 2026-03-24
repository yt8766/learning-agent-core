import { Alert, App as AntApp, Button, ConfigProvider, Input, Layout, Modal, Space, Tag, Typography } from 'antd';
import { XProvider } from '@ant-design/x';
import { useEffect, useMemo, useState } from 'react';

import { buildBubbleItems } from '../../features/chat/chat-message-adapter';
import { ChatRuntimeDrawer } from '../../features/runtime-panel/chat-runtime-drawer';
import { formatSessionTime, getSessionStatusLabel, useChatSession } from '../../hooks/use-chat-session';
import '../../styles/chat-home-page.css';
import { type SessionFilter } from './chat-home-constants';
import { buildEventSummary, getAgentLabel, getErrorCopy } from './chat-home-helpers';
import { ChatHomeSidebar } from './chat-home-sidebar';
import { buildThoughtItems, ChatHomeWorkbench } from './chat-home-workbench';

const { Header, Sider, Content } = Layout;
const { TextArea } = Input;
const { Text, Title } = Typography;

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

  const runningHint =
    chat.activeSession?.status === 'running'
      ? `正在执行 ${chat.checkpoint?.graphState.currentStep || '当前节点'}，稍后会继续推送 Agent 消息。`
      : '';
  const bubbleItems = useMemo(
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
          window.setTimeout(() => setCopiedMessageId(current => (current === message.id ? '' : current)), 1800);
        }
      }),
    [chat.messages, chat.activeSession?.status, copiedMessageId, runningHint]
  );

  const thoughtItems = useMemo(() => buildThoughtItems(chat), [chat]);
  const streamEvents = useMemo(
    () =>
      chat.events
        .slice()
        .reverse()
        .map(eventItem => ({
          id: eventItem.id,
          type: eventItem.type,
          summary: buildEventSummary(eventItem),
          at: formatSessionTime(eventItem.at),
          raw: JSON.stringify(eventItem.payload ?? {}, null, 2)
        })),
    [chat.events]
  );
  const errorCopy = chat.error ? getErrorCopy(chat.error) : null;

  return (
    <ConfigProvider>
      <XProvider>
        <AntApp>
          <Layout className="chatx-layout">
            <Sider width={312} theme="light" className="chatx-sider">
              <ChatHomeSidebar
                chat={chat}
                searchKeyword={searchKeyword}
                sessionFilter={sessionFilter}
                onSearchKeywordChange={setSearchKeyword}
                onSessionFilterChange={setSessionFilter}
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
                      <Tag color="default">{getSessionStatusLabel(chat.activeSession.status)}</Tag>
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
                          onOk: async () => chat.deleteActiveSession()
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

                  <ChatHomeWorkbench
                    chat={chat}
                    showWorkbench={showWorkbench}
                    bubbleItems={bubbleItems}
                    thoughtItems={thoughtItems}
                    streamEvents={streamEvents}
                  />
                </div>
              </Content>
            </Layout>

            <ChatRuntimeDrawer
              open={chat.showRightPanel}
              activeSession={chat.activeSession}
              checkpoint={chat.checkpoint}
              thinkState={chat.checkpoint?.thinkState}
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
                if (!feedbackIntent) return;
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
