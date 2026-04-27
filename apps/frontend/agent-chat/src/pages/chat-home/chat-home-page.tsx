import { Alert, App as AntApp, Button, ConfigProvider, Layout, Modal, Space, Tag, Typography } from 'antd';
import { XProvider } from '@ant-design/x';
import { useEffect, useMemo, useRef, useState } from 'react';

import { exportApprovalsCenter, exportRuntimeCenter, getBrowserReplay } from '@/api/chat-api';
import { buildBubbleItems } from '@/features/chat/chat-message-adapter';
import { ChatRuntimeDrawer } from '@/features/runtime-panel/chat-runtime-drawer';
import { getSessionStatusLabel, useChatSession } from '@/hooks/use-chat-session';
import '@/styles/chat-home-page.scss';
import { getAgentLabel, getErrorCopy } from './chat-home-helpers';
import {
  buildApprovalsExportRequest,
  buildChatHomeShareLinks,
  buildCognitionDurationLabel,
  buildDeleteSessionConfirmConfig,
  buildReplayDownloadFilename,
  buildRuntimeExportRequest,
  buildStreamEventItems,
  downloadTextFile,
  getWorkbenchToggleLabel,
  openApprovalFeedbackState,
  resetApprovalFeedbackState,
  resolveApprovalFeedbackSubmission,
  resolveCognitionTargetMessageId,
  resolveNextCognitionExpansion,
  serializeBrowserReplay,
  shouldShowSessionHeaderActions,
  shouldShowErrorAlert
} from './chat-home-page-helpers';
import { ChatHomeSidebar } from './chat-home-sidebar';
import { stripLeadingWorkflowCommand } from './chat-home-submit';
import { buildThoughtItems, ChatHomeWorkbench } from './chat-home-workbench';
import type { ChatMode } from './chat-home-workbench-composer-helpers';

const { Text, Title } = Typography;
const { Header, Sider, Content } = Layout;

export function ChatHomePage() {
  const chat = useChatSession();
  const [feedbackIntent, setFeedbackIntent] = useState('');
  const [feedbackDraft, setFeedbackDraft] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showWorkbench, setShowWorkbench] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>('quick');
  const [dismissedError, setDismissedError] = useState('');
  const [cognitionExpanded, setCognitionExpanded] = useState(false);
  const [thinkingNow, setThinkingNow] = useState(Date.now());
  const previousThinkLoadingRef = useRef(false);

  useEffect(() => {
    if (chat.error && chat.error !== dismissedError) {
      setDismissedError('');
    }
  }, [chat.error, dismissedError]);

  useEffect(() => {
    if (!chat.checkpoint?.thinkState?.loading) {
      return;
    }

    setThinkingNow(Date.now());
    const timer = window.setInterval(() => {
      setThinkingNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [chat.checkpoint?.thinkState?.loading, chat.checkpoint?.taskId]);

  const agentThinking = Boolean(chat.checkpoint?.thinkState?.loading);
  const thoughtItems = useMemo(() => buildThoughtItems(chat), [chat]);
  const cognitionTargetMessageId = useMemo(
    () => resolveCognitionTargetMessageId(chat.checkpoint, chat.checkpoint?.thoughtChain),
    [chat.checkpoint?.thinkState?.messageId, chat.checkpoint?.thoughtChain]
  );
  const cognitionDurationLabel = useMemo(() => {
    return buildCognitionDurationLabel(chat.checkpoint, chat.checkpoint?.thoughtChain, thinkingNow);
  }, [
    chat.checkpoint?.thinkState?.thinkingDurationMs,
    chat.checkpoint?.thinkState?.loading,
    chat.checkpoint?.thoughtChain,
    chat.checkpoint?.updatedAt,
    thinkingNow
  ]);
  const cognitionCountLabel = thoughtItems.length ? `${thoughtItems.length} 条推理` : '';
  const isThinking = Boolean(chat.activeSession?.status === 'running' || chat.checkpoint?.thinkState?.loading);

  useEffect(() => {
    const wasThinkLoading = previousThinkLoadingRef.current;
    previousThinkLoadingRef.current = agentThinking;
    const nextExpanded = resolveNextCognitionExpansion({
      wasThinkLoading,
      isThinkLoading: agentThinking,
      hasCognitionTarget: Boolean(cognitionTargetMessageId),
      isSessionRunning: chat.activeSession?.status === 'running'
    });

    if (typeof nextExpanded === 'boolean') {
      setCognitionExpanded(nextExpanded);
    }
  }, [agentThinking, cognitionTargetMessageId, chat.activeSession?.status]);

  const bubbleItems = useMemo(
    () =>
      buildBubbleItems({
        messages: chat.messages,
        activeStatus: chat.activeSession?.status,
        agentThinking,
        copiedMessageId,
        thinkState: chat.checkpoint?.thinkState,
        thoughtItems,
        cognitionTargetMessageId,
        cognitionExpanded,
        cognitionDurationLabel,
        cognitionCountLabel,
        onToggleCognition: () => setCognitionExpanded(current => !current),
        getAgentLabel,
        onApprovalAction: (intent, approved, scope) => {
          void chat.updateApproval(intent, approved, undefined, scope);
        },
        onApprovalFeedback: (intent, reason) => {
          const nextState = openApprovalFeedbackState(intent, reason);
          setFeedbackIntent(nextState.feedbackIntent);
          setFeedbackDraft(nextState.feedbackDraft);
        },
        onPlanAction: params => {
          void chat.updatePlanInterrupt(params);
        },
        onSkillInstall: suggestion => {
          void chat.installSuggestedSkill(suggestion);
        },
        onCopy: message => {
          void navigator.clipboard.writeText(message.content);
          setCopiedMessageId(message.id);
          window.setTimeout(() => setCopiedMessageId(current => (current === message.id ? '' : current)), 1800);
        }
      }),
    [
      chat.messages,
      chat.activeSession?.status,
      agentThinking,
      copiedMessageId,
      chat.checkpoint?.thinkState,
      thoughtItems,
      cognitionTargetMessageId,
      cognitionExpanded,
      cognitionDurationLabel,
      cognitionCountLabel,
      chat.updatePlanInterrupt,
      chat.installSuggestedSkill
    ]
  );

  const streamEvents = useMemo(() => buildStreamEventItems(chat.events), [chat.events]);
  const errorCopy = chat.error ? getErrorCopy(chat.error) : null;
  const showErrorAlert = shouldShowErrorAlert(chat.error, dismissedError, Boolean(errorCopy));

  const handleExportRuntime = async () => {
    const exported = await exportRuntimeCenter(buildRuntimeExportRequest(chat.checkpoint));
    downloadTextFile(exported.filename, exported.mimeType, exported.content);
  };

  const handleExportApprovals = async () => {
    const exported = await exportApprovalsCenter(buildApprovalsExportRequest(chat.checkpoint));
    downloadTextFile(exported.filename, exported.mimeType, exported.content);
  };

  const handleDownloadReplay = async () => {
    if (!chat.activeSessionId) return;
    const replay = await getBrowserReplay(chat.activeSessionId);
    downloadTextFile(
      buildReplayDownloadFilename(chat.activeSessionId),
      'application/json',
      serializeBrowserReplay(replay)
    );
  };

  const handleCopyShareLinks = async () => {
    const links = buildChatHomeShareLinks(chat.checkpoint, chat.activeSessionId);
    await navigator.clipboard.writeText(
      [links.runtimeUrl, links.approvalsUrl, links.observatoryUrl, links.replayUrl].filter(Boolean).join('\n')
    );
  };

  return (
    <ConfigProvider>
      <XProvider>
        <AntApp>
          <Layout className={`chatx-layout ${sidebarCollapsed ? 'is-sidebar-collapsed' : 'is-sidebar-expanded'}`}>
            <Sider width={sidebarCollapsed ? 108 : 312} collapsedWidth={108} theme="light" className="chatx-sider">
              <ChatHomeSidebar
                chat={chat}
                collapsed={sidebarCollapsed}
                onToggleCollapsed={() => setSidebarCollapsed(current => !current)}
              />
            </Sider>

            <Layout>
              <Header className="chatx-header">
                <div className="chatx-header__copy">
                  <Text className="chatx-header__eyebrow">Agent Chat</Text>
                  <Title level={4}>
                    {chat.activeSession?.title ? stripLeadingWorkflowCommand(chat.activeSession.title) : '开始新会话'}
                  </Title>
                  <Space wrap size={8} className="chatx-header__tags">
                    {chat.checkpoint?.resolvedWorkflow ? (
                      <Tag color="gold">{chat.checkpoint.resolvedWorkflow.displayName}</Tag>
                    ) : null}
                    {chat.activeSession ? (
                      <Tag color="default">{getSessionStatusLabel(chat.activeSession.status)}</Tag>
                    ) : null}
                  </Space>
                </div>
                <Space className="chatx-header__actions">
                  {shouldShowSessionHeaderActions(chat.activeSessionId) ? (
                    <>
                      <Button
                        htmlType="button"
                        onClick={() => chat.activeSessionId && void chat.refreshSessionDetail()}
                      >
                        刷新当前会话
                      </Button>
                      <Button
                        htmlType="button"
                        danger
                        onClick={() => {
                          Modal.confirm(buildDeleteSessionConfirmConfig(async () => chat.deleteActiveSession()));
                        }}
                      >
                        删除会话
                      </Button>
                    </>
                  ) : null}
                  <Button htmlType="button" onClick={() => setShowWorkbench(current => !current)}>
                    {getWorkbenchToggleLabel(showWorkbench)}
                  </Button>
                  <Button htmlType="button" type="primary" onClick={() => chat.setShowRightPanel(true)}>
                    打开总览面板
                  </Button>
                </Space>
              </Header>

              <Content className="chatx-content" aria-label="Codex 对话区">
                <div className="chatx-main-card">
                  {showErrorAlert && errorCopy ? (
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
                    chatMode={chatMode}
                    onChatModeChange={setChatMode}
                    showWorkbench={showWorkbench}
                    bubbleItems={bubbleItems}
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
              onConfirmLearning={() => void chat.submitLearningConfirmation()}
              onRecover={() => void chat.recoverActiveSession()}
              onExportRuntime={() => void handleExportRuntime()}
              onExportApprovals={() => void handleExportApprovals()}
              onDownloadReplay={() => void handleDownloadReplay()}
              onCopyShareLinks={() => void handleCopyShareLinks()}
              getAgentLabel={getAgentLabel}
              getSessionStatusLabel={getSessionStatusLabel}
            />
            <Modal
              title="拒绝并附加说明"
              open={Boolean(feedbackIntent)}
              okText="提交批注"
              cancelText="取消"
              onCancel={() => {
                const nextState = resetApprovalFeedbackState();
                setFeedbackIntent(nextState.feedbackIntent);
                setFeedbackDraft(nextState.feedbackDraft);
              }}
              onOk={() => {
                const submission = resolveApprovalFeedbackSubmission(feedbackIntent, feedbackDraft);
                if (!submission) return;
                void chat.updateApproval(submission.intent, submission.approved, submission.reason);
                const nextState = resetApprovalFeedbackState();
                setFeedbackIntent(nextState.feedbackIntent);
                setFeedbackDraft(nextState.feedbackDraft);
              }}
            >
              <div className="chatx-feedback-modal">
                <Text type="secondary">这条反馈会直接用于调整后续处理方式。</Text>
                <textarea
                  className="chatx-feedback-textarea"
                  rows={5}
                  value={feedbackDraft}
                  onChange={event => setFeedbackDraft(event.target.value)}
                  placeholder="例如：先不要继续发布，先补一轮回归测试。"
                />
              </div>
            </Modal>
          </Layout>
        </AntApp>
      </XProvider>
    </ConfigProvider>
  );
}
