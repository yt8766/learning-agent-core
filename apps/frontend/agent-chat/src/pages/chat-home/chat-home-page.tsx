import { Alert, App as AntApp, ConfigProvider, Modal, Typography } from 'antd';
import { XProvider } from '@ant-design/x';
import type { BubbleItemType } from '@ant-design/x';
import { useEffect, useMemo, useRef, useState } from 'react';

import { buildBubbleItems } from '@/pages/chat/chat-message-adapter';
import { stripWorkflowCommandPrefix } from '@/pages/chat/chat-message-adapter-helpers';
import { useChatSession } from '@/hooks/use-chat-session';
import { foldChatResponseStepProjectionsFromEvents } from '@/lib/chat-response-step-projections';
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
import { buildConversationAnchors } from './chat-home-anchor-rail-helpers';
import { ActiveConversation, EmptyConversation } from './chat-home-conversation';
import { ChatHomeSidebar } from './chat-home-sidebar';
import { buildThoughtItems } from './chat-home-workbench-thoughts';

const { Text } = Typography;

export function ChatHomePage() {
  const chat = useChatSession();
  const [feedbackIntent, setFeedbackIntent] = useState('');
  const [feedbackDraft, setFeedbackDraft] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState('');
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
  const responseSteps = useMemo(() => foldChatResponseStepProjectionsFromEvents(chat.events), [chat.events]);

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
        responseStepsByMessageId: responseSteps.byMessageId,
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
        onRegenerate: message => {
          void chat.regenerateMessage(message);
        },
        onMessageFeedback: (message, feedback) => {
          void chat.submitMessageFeedback(message, feedback);
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
      responseSteps.byMessageId,
      chat.updatePlanInterrupt,
      chat.installSuggestedSkill,
      chat.regenerateMessage,
      chat.submitMessageFeedback
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
          <main className={`chatx-agent-codex ${sidebarCollapsed ? 'is-sidebar-collapsed' : 'is-sidebar-expanded'}`}>
            <div className="chatx-agent-codex__sidebar" aria-label="Agent Chat 会话侧栏">
              <ChatHomeSidebar
                chat={chat}
                collapsed={sidebarCollapsed}
                onToggleCollapsed={() => setSidebarCollapsed(current => !current)}
                onLogout={handleLogout}
              />
            </div>

            <section className="chatx-agent-codex__main" aria-label="Codex 对话区">
              {showErrorAlert && errorCopy ? (
                <Alert
                  type="error"
                  showIcon
                  closable
                  className="chatx-agent-codex__error"
                  title={errorCopy.title}
                  description={errorCopy.description}
                  onClose={() => setDismissedError(chat.error)}
                />
              ) : null}

              {chat.hasMessages ? (
                <ActiveConversation
                  activeTitle={stripWorkflowCommandPrefix(chat.activeSession?.title ?? '当前会话')}
                  activeStatus={chat.activeSession?.status}
                  bubbleItems={anchoredBubbleItems}
                  anchors={conversationAnchors}
                  onSend={value => chat.sendMessage(value)}
                  onCancel={() => chat.cancelActiveSession('用户停止当前会话')}
                  loading={isThinking}
                />
              ) : (
                <EmptyConversation
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
