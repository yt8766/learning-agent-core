import { Alert, Button, Collapse, Dropdown, Flex, Segmented, Space, Tag, Typography, type MenuProps } from 'antd';
import { Bubble, Sender } from '@ant-design/x';
import type { BubbleItemType } from '@ant-design/x';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { getWorkspaceCenterReadiness, type WorkspaceCenterReadinessSummary } from '@/api/workspace-center-api';
import type { useChatSession } from '@/hooks/use-chat-session';
import { ConversationAnchorRail } from './chat-home-anchor-rail';
import { buildConversationAnchors } from './chat-home-anchor-rail-helpers';
import { CHAT_ROLE_CONFIG, buildProjectContextSnapshot } from './chat-home-helpers';
import { SessionMissionControl } from './chat-home-mission-control';
import { stripLeadingWorkflowCommand } from './chat-home-submit';
import {
  buildQuickActionMenuItems,
  type ChatMode,
  resetComposerState,
  resolveComposerChange,
  resolveComposerSubmitForMode,
  resolveQuickActionSelection
} from './chat-home-workbench-composer-helpers';
import {
  buildQuickActionChips,
  buildWorkspaceVaultSignals,
  buildWorkspaceFollowUpActions,
  buildWorkspaceShareText,
  shouldShowMissionControl,
  type QuickActionChip
} from './chat-home-workbench-support';
import {
  buildWorkbenchSectionState,
  ChatHomeApprovalActions,
  type StreamEventRecord
} from './chat-home-workbench-sections';

interface ChatHomeWorkbenchProps {
  chat: ReturnType<typeof useChatSession>;
  chatMode: ChatMode;
  onChatModeChange: (chatMode: ChatMode) => void;
  showWorkbench: boolean;
  bubbleItems: BubbleItemType[];
  streamEvents: StreamEventRecord[];
}

const SenderSwitch = Sender.Switch;
const { Text } = Typography;

export function ChatHomeWorkbench(props: ChatHomeWorkbenchProps) {
  const { runningHint, compressionHint, llmFallbackNotes, workbenchItems } = buildWorkbenchSectionState(
    props.chat,
    props.streamEvents
  );
  const [workspaceCenterReadiness, setWorkspaceCenterReadiness] = useState<WorkspaceCenterReadinessSummary>();
  const showMissionControl = shouldShowMissionControl(props.chat);
  const quickActionChips = useMemo(() => buildQuickActionChips(props.chat), [props.chat]);
  const workspaceSnapshot = useMemo(() => buildProjectContextSnapshot(props.chat), [props.chat]);
  const workspaceVaultSignals = useMemo(
    () => buildWorkspaceVaultSignals(props.chat, workspaceCenterReadiness),
    [props.chat, workspaceCenterReadiness]
  );
  const workspaceFollowUps = useMemo(() => buildWorkspaceFollowUpActions(props.chat), [props.chat]);
  const conversationAnchors = useMemo(
    () => filterVisibleConversationAnchors(buildConversationAnchors(props.chat.messages), props.bubbleItems),
    [props.chat.messages, props.bubbleItems]
  );
  const anchoredBubbleItems = useMemo(
    () => attachConversationAnchorTargets(props.bubbleItems, conversationAnchors),
    [props.bubbleItems, conversationAnchors]
  );

  useEffect(() => {
    let disposed = false;
    void getWorkspaceCenterReadiness()
      .then(readiness => {
        if (!disposed) {
          setWorkspaceCenterReadiness(readiness);
        }
      })
      .catch(() => {
        if (!disposed) {
          setWorkspaceCenterReadiness(undefined);
        }
      });

    return () => {
      disposed = true;
    };
  }, []);

  return (
    <div className={`chatx-workbench ${props.showWorkbench ? 'is-workbench-open' : 'is-workbench-closed'}`}>
      <section className="chatx-chat-column">
        <ConversationAnchorRail anchors={conversationAnchors} />
        <div className="chatx-chat-surface">
          {props.chat.activeSession && showMissionControl ? <SessionMissionControl chat={props.chat} /> : null}
          {!props.chat.hasMessages ? (
            <EmptyFrontlineEntry chatMode={props.chatMode} onChatModeChange={props.onChatModeChange} />
          ) : null}

          <Bubble.List items={anchoredBubbleItems} autoScroll role={CHAT_ROLE_CONFIG} className="chatx-bubble-list" />
        </div>

        <div className={`chatx-composer-shell ${props.chat.hasMessages ? 'is-thread-active' : 'is-empty-thread'}`}>
          <ChatComposer
            chat={props.chat}
            chatMode={props.chatMode}
            onChatModeChange={props.onChatModeChange}
            quickActionChips={quickActionChips}
          />
        </div>
      </section>

      {props.showWorkbench ? (
        <aside className="chatx-side-column">
          <section className="chatx-workspace-shell">
            <div className="chatx-workspace-shell__header">
              <div>
                <Text className="chatx-workspace-shell__eyebrow">Current Workspace</Text>
                <Text strong>围绕当前任务的上下文与结论</Text>
              </div>
              <Tag>{props.chat.activeSession?.status ?? 'idle'}</Tag>
            </div>
            <div className="chatx-workspace-shell__body">
              <article className="chatx-workspace-shell__card">
                <Text className="chatx-workspace-shell__label">当前目标</Text>
                <Text>{workspaceSnapshot.objective}</Text>
              </article>
              <article className="chatx-workspace-shell__card">
                <Text className="chatx-workspace-shell__label">最新结论</Text>
                <Text>{workspaceSnapshot.latestOutcome}</Text>
              </article>
              <div className="chatx-workspace-shell__meta">
                <Tag color="blue">{workspaceSnapshot.evidenceCount} 条来源</Tag>
                <Tag color="purple">{workspaceSnapshot.skillCount} 个技能</Tag>
                <Tag color="cyan">{workspaceSnapshot.connectorCount} 个连接器</Tag>
                {workspaceSnapshot.currentWorker ? <Tag>{workspaceSnapshot.currentWorker}</Tag> : null}
              </div>
              <article className="chatx-workspace-shell__card">
                <Text className="chatx-workspace-shell__label">Workspace Vault</Text>
                <div className="chatx-workspace-shell__meta">
                  {workspaceVaultSignals.map(signal => (
                    <Tag key={signal.label} color={signal.tone}>
                      {signal.label}: {signal.value}
                    </Tag>
                  ))}
                </div>
                <Space size={4} direction="vertical">
                  {workspaceVaultSignals.map(signal => (
                    <Text key={`${signal.label}:detail`} type="secondary">
                      {signal.label} · {signal.detail}
                    </Text>
                  ))}
                </Space>
              </article>
              <div className="chatx-workspace-shell__actions">
                {workspaceFollowUps.map(action => (
                  <Button
                    key={action.label}
                    size="small"
                    onClick={() =>
                      void props.chat.sendMessage({
                        display: stripLeadingWorkflowCommand(action.value),
                        payload: action.value
                      })
                    }
                  >
                    {action.label}
                  </Button>
                ))}
                <Button
                  size="small"
                  type="default"
                  onClick={() => void navigator.clipboard.writeText(buildWorkspaceShareText(props.chat))}
                >
                  复制工作区摘要
                </Button>
              </div>
            </div>
          </section>
          {runningHint ? <Alert type="info" showIcon title={runningHint} className="chatx-running-alert" /> : null}
          {compressionHint ? (
            <Alert type="success" showIcon title={compressionHint} className="chatx-running-alert" />
          ) : null}
          {llmFallbackNotes.length ? (
            <Alert
              type="warning"
              showIcon
              title="当前轮次未取得模型正常输出，正在展示兜底响应。"
              description={llmFallbackNotes.join('；')}
              className="chatx-running-alert"
            />
          ) : null}

          {workbenchItems.length ? (
            <section className="chatx-workbench-sections">
              <Collapse
                ghost
                items={workbenchItems}
                defaultActiveKey={['cabinet']}
                className="chatx-workbench-collapse"
              />
            </section>
          ) : null}

          <ChatHomeApprovalActions chat={props.chat} />
        </aside>
      ) : null}
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
          {item.content as ReactNode}
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

// checkpoint.activeInterrupt is the persisted 司礼监 / InterruptController projection used by the frontline workbench.
function EmptyFrontlineEntry({
  chatMode,
  onChatModeChange
}: {
  chatMode: ChatMode;
  onChatModeChange: (chatMode: ChatMode) => void;
}) {
  return (
    <div className="chatx-empty-entry">
      <div className="chatx-empty-entry__brand">AC</div>
      <div className="chatx-empty-entry__copy">
        <Text className="chatx-empty-entry__eyebrow">Agent Chat</Text>
        <Typography.Title level={1}>使用快速模式开始对话</Typography.Title>
        <Typography.Paragraph>快速提问直接开始；需要拆解、计划和多步执行时切换专家模式。</Typography.Paragraph>
      </div>
      <Segmented
        className="chatx-empty-entry__modes"
        value={chatMode}
        onChange={value => onChatModeChange(value as ChatMode)}
        options={[
          { label: '快速模式', value: 'quick' },
          { label: '专家模式', value: 'expert' }
        ]}
      />
    </div>
  );
}

function ChatComposer({
  chat,
  chatMode,
  onChatModeChange,
  quickActionChips
}: {
  chat: ReturnType<typeof useChatSession>;
  chatMode: ChatMode;
  onChatModeChange: (chatMode: ChatMode) => void;
  quickActionChips: QuickActionChip[];
}) {
  const [draft, setDraft] = useState('');
  const [suggestedPayload, setSuggestedPayload] = useState<string | null>(null);
  const secondaryMenuItems = buildQuickActionMenuItems(quickActionChips) satisfies MenuProps['items'];

  useEffect(() => {
    const nextState = resetComposerState();
    setDraft(nextState.draft);
    setSuggestedPayload(nextState.suggestedPayload);
  }, [chat.activeSessionId]);

  return (
    <>
      <Sender
        className="chatx-sender"
        value={draft}
        onChange={value => {
          const nextState = resolveComposerChange(value, chatMode === 'expert');
          setDraft(nextState.draft);
          setSuggestedPayload(nextState.suggestedPayload);
        }}
        onSubmit={value => {
          setDraft('');
          const outbound = resolveComposerSubmitForMode(value, suggestedPayload, chatMode);
          setSuggestedPayload(null);
          void chat.sendMessage(outbound);
        }}
        loading={chat.activeSession?.status === 'running' || Boolean(chat.checkpoint?.thinkState?.loading)}
        onCancel={() => void chat.cancelActiveSession()}
        placeholder="给 Agent Chat 发送消息"
        autoSize={{ minRows: 3, maxRows: 6 }}
        suffix={false}
        footer={actionNode => (
          <Flex justify="space-between" align="center" className="chatx-sender-footer">
            <Flex gap="small" align="center" className="chatx-sender-footer__left">
              {quickActionChips.length ? (
                <Dropdown
                  menu={{
                    items: secondaryMenuItems,
                    onClick: info => {
                      const nextState = resolveQuickActionSelection(quickActionChips, String(info.key));
                      if (!nextState) {
                        return;
                      }
                      setDraft(nextState.draft);
                      setSuggestedPayload(nextState.suggestedPayload);
                      onChatModeChange('quick');
                    }
                  }}
                  placement="topLeft"
                >
                  <SenderSwitch
                    value={false}
                    icon={<span>+</span>}
                    checkedChildren={<span className="chatx-quick-switch__label">更多建议</span>}
                    unCheckedChildren={<span className="chatx-quick-switch__label">更多建议</span>}
                    className="chatx-quick-switch"
                  />
                </Dropdown>
              ) : null}
            </Flex>
            <Flex align="center" className="chatx-sender-footer__right">
              <div className={`chatx-plan-mode-inline ${chatMode === 'expert' ? 'is-active' : ''}`}>
                <Segmented
                  size="small"
                  value={chatMode}
                  onChange={value => {
                    setSuggestedPayload(null);
                    onChatModeChange(value as ChatMode);
                  }}
                  options={[
                    { label: '快速模式', value: 'quick' },
                    { label: '专家模式', value: 'expert' }
                  ]}
                />
              </div>
              {actionNode}
            </Flex>
          </Flex>
        )}
      />
    </>
  );
}
export {
  buildQuickActionChips,
  buildThoughtItems,
  buildWorkspaceFollowUpActions,
  buildWorkspaceVaultSignals,
  buildWorkspaceShareText,
  resolveSuggestedDraftSubmission,
  shouldShowMissionControl
} from './chat-home-workbench-support';
