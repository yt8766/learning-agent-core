import { AimOutlined, GlobalOutlined, PaperClipOutlined } from '@ant-design/icons';
import { Alert, App as AntApp, ConfigProvider, Modal, Typography } from 'antd';
import { Bubble, Sender, XProvider } from '@ant-design/x';
import type { BubbleItemType } from '@ant-design/x';
import { useEffect, useMemo, useRef, useState } from 'react';

import { buildBubbleItems } from '@/features/chat/chat-message-adapter';
import { stripWorkflowCommandPrefix } from '@/features/chat/chat-message-adapter-helpers';
import { getSessionStatusLabel, useChatSession } from '@/hooks/use-chat-session';
import '@/styles/chat-home-page.scss';
import { getAgentLabel, getErrorCopy } from './chat-home-helpers';
import {
  buildCognitionDurationLabel,
  openApprovalFeedbackState,
  resetApprovalFeedbackState,
  resolveApprovalFeedbackSubmission,
  resolveCognitionTargetMessageId,
  resolveNextCognitionExpansion,
  shouldShowErrorAlert
} from './chat-home-page-helpers';
import { ConversationAnchorRail } from './chat-home-anchor-rail';
import { buildConversationAnchors } from './chat-home-anchor-rail-helpers';
import { ChatHomeSidebar } from './chat-home-sidebar';
import { buildSubmitMessage } from './chat-home-submit';
import { buildThoughtItems } from './chat-home-workbench-thoughts';

const { Text, Title } = Typography;

type ChatMode = 'quick' | 'expert';

export function ChatHomePage() {
  const chat = useChatSession();
  const [feedbackIntent, setFeedbackIntent] = useState('');
  const [feedbackDraft, setFeedbackDraft] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState('');
  const [showWorkbench, setShowWorkbench] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  const conversationAnchors = useMemo(
    () => filterVisibleConversationAnchors(buildConversationAnchors(chat.messages), bubbleItems),
    [chat.messages, bubbleItems]
  );
  const anchoredBubbleItems = useMemo(
    () => attachConversationAnchorTargets(bubbleItems, conversationAnchors),
    [bubbleItems, conversationAnchors]
  );
  const errorCopy = chat.error ? getErrorCopy(chat.error) : null;
  const showErrorAlert = shouldShowErrorAlert(chat.error, dismissedError, Boolean(errorCopy));

  const handleLogout = () => {
    chat.setActiveSessionId('');
    window.dispatchEvent(new CustomEvent('agent-chat:logout'));
  };

  return (
    <ConfigProvider>
      <XProvider>
        <AntApp>
          <Layout className="chatx-layout">
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
                  <Title level={4}>{chat.activeSession?.title ?? '开始新会话'}</Title>
                  <Space wrap size={8} className="chatx-header__tags">
                    {chat.checkpoint?.resolvedWorkflow ? (
                      <Tag color="gold">{chat.checkpoint.resolvedWorkflow.displayName}</Tag>
                    ) : null}
                    {chat.activeSession ? (
                      <Tag color="default">{getSessionStatusLabel(chat.activeSession.status)}</Tag>
                    ) : null}
                  </Space>
                </div>
                <Space>
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

              <Content className="chatx-content">
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

              {chat.hasMessages ? (
                <ActiveConversation
                  activeTitle={stripWorkflowCommandPrefix(chat.activeSession?.title ?? '当前会话')}
                  activeStatus={chat.activeSession?.status}
                  chatMode={chatMode}
                  bubbleItems={anchoredBubbleItems}
                  anchors={conversationAnchors}
                  onSend={value => chat.sendMessage(value)}
                  onCancel={() => chat.cancelActiveSession('用户停止当前会话')}
                  loading={isThinking}
                />
              ) : (
                <EmptyConversation
                  chatMode={chatMode}
                  onSend={value => chat.sendMessage(value)}
                  onCancel={() => chat.cancelActiveSession('用户停止当前会话')}
                  loading={chat.loading}
                />
              )}
            </section>

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
          </main>
        </AntApp>
      </XProvider>
    </ConfigProvider>
  );
}

interface ConversationProps {
  chatMode: ChatMode;
  onSend: ReturnType<typeof useChatSession>['sendMessage'];
  onCancel: ReturnType<typeof useChatSession>['cancelActiveSession'];
  loading: boolean;
}

interface ActiveConversationProps extends ConversationProps {
  activeTitle: string;
  activeStatus?: string;
  bubbleItems: BubbleItemType[];
  anchors: ReturnType<typeof buildConversationAnchors>;
}

function ActiveConversation(props: ActiveConversationProps) {
  return (
    <div className="chatx-conversation">
      <header className="chatx-conversation__header">
        <div>
          <Title level={2}>{props.activeTitle}</Title>
          {props.activeStatus ? (
            <Text className="chatx-conversation__mode">{getSessionStatusLabel(props.activeStatus)}</Text>
          ) : null}
        </div>
      </header>

      <ConversationAnchorRail anchors={props.anchors} />

      <div className="chatx-conversation__stream">
        <Bubble.List items={props.bubbleItems} autoScroll className="chatx-bubble-list" />
        <div className="chatx-conversation__composer">
          <ChatComposer
            chatMode={props.chatMode}
            onSend={props.onSend}
            onCancel={props.onCancel}
            loading={props.loading}
            active
          />
        </div>
      </div>
    </div>
  );
}

function EmptyConversation(props: ConversationProps) {
  return (
    <div className="chatx-empty-conversation">
      <div className="chatx-empty-conversation__hero">
        <div className="chatx-empty-conversation__title">
          <span className="chatx-brand-mark" aria-hidden="true" />
          <Title level={1}>开始新对话</Title>
        </div>
        <ChatComposer
          chatMode={props.chatMode}
          onSend={props.onSend}
          onCancel={props.onCancel}
          loading={props.loading}
        />
      </div>
    </div>
  );
}

function ChatComposer(props: ConversationProps & { active?: boolean }) {
  const [draft, setDraft] = useState('');
  const [deepThinkingEnabled, setDeepThinkingEnabled] = useState(true);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  useEffect(() => {
    setDraft('');
  }, [props.chatMode]);

  return (
    <div className={`chatx-agent-composer ${props.active ? 'is-active-thread' : 'is-empty-thread'}`}>
      <Sender
        className="chatx-sender"
        value={draft}
        onChange={setDraft}
        onSubmit={value => {
          const nextValue = value.trim();
          if (!nextValue) {
            return;
          }
          const activeModes = [
            props.chatMode === 'expert' || deepThinkingEnabled ? 'plan' : '',
            webSearchEnabled ? 'browse' : ''
          ].filter(Boolean);
          const outbound = buildSubmitMessage(nextValue, activeModes);
          setDraft('');
          props.onSend(outbound);
        }}
        onCancel={props.onCancel}
        suffix={false}
        loading={props.loading}
        placeholder="给 Agent Chat 发送消息"
        autoSize={{ minRows: 2, maxRows: 3 }}
        footer={actionNode => (
          <div className="chatx-sender-footer">
            <div className="chatx-sender-footer__left">
              <button
                type="button"
                className={`chatx-sender-chip${deepThinkingEnabled ? ' is-active' : ''}`}
                aria-pressed={deepThinkingEnabled}
                onClick={() => setDeepThinkingEnabled(enabled => !enabled)}
              >
                <AimOutlined aria-hidden="true" />
                <span>深度思考</span>
              </button>
              <button
                type="button"
                className={`chatx-sender-chip${webSearchEnabled ? ' is-active' : ''}`}
                aria-pressed={webSearchEnabled}
                onClick={() => setWebSearchEnabled(enabled => !enabled)}
              >
                <GlobalOutlined aria-hidden="true" />
                <span>智能搜索</span>
              </button>
            </div>
            <div className="chatx-sender-footer__right">
              <button type="button" className="chatx-sender-attach" aria-label="上传文件">
                <PaperClipOutlined aria-hidden="true" />
              </button>
              {actionNode}
            </div>
          </div>
        )}
      />
      <Text className="chatx-ai-disclaimer">内容由 AI 生成，请仔细甄别</Text>
    </div>
  );
}

function attachConversationAnchorTargets(
  items: BubbleItemType[],
  anchors: ReturnType<typeof buildConversationAnchors>
) {
  if (!anchors.length) {
    return items;
  }

  const anchorByMessageId = new Map(anchors.map(anchor => [anchor.messageId, anchor]));

  return items.map(item => {
    const anchor = anchorByMessageId.get(String(item.key));
    if (!anchor) {
      return item;
    }

    return {
      ...item,
      content: (
        <div id={anchor.id} className="chatx-message-anchor-target">
          {item.content}
        </div>
      )
    };
  });
}

function filterVisibleConversationAnchors(
  anchors: ReturnType<typeof buildConversationAnchors>,
  items: BubbleItemType[]
) {
  if (!anchors.length) {
    return anchors;
  }

  const visibleMessageIds = new Set(items.map(item => String(item.key)));
  const visibleAnchors = anchors.filter(anchor => visibleMessageIds.has(anchor.messageId));

  return visibleAnchors.length >= 2 ? visibleAnchors : [];
}
