import { Alert, Button, Collapse, Dropdown, Flex, Space, Tag, Typography, type MenuProps } from 'antd';
import { Bubble, Sender } from '@ant-design/x';
import type { BubbleItemType } from '@ant-design/x';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { getWorkspaceCenterReadiness, type WorkspaceCenterReadinessSummary } from '@/api/workspace-center-api';
import type { useChatSession } from '@/hooks/use-chat-session';
import { ConversationAnchorRail } from './chat-home-anchor-rail';
import { buildConversationAnchors, dedupeMessagesById } from './chat-home-anchor-rail-helpers';
import { CHAT_ROLE_CONFIG, buildProjectContextSnapshot } from './chat-home-helpers';
import { SessionMissionControl } from './chat-home-mission-control';
import { stripLeadingWorkflowCommand } from './chat-home-submit';
import {
  buildQuickActionMenuItems,
  resetComposerState,
  resolveComposerChange,
  resolveComposerSubmit,
  resolveQuickActionSelection
} from './chat-home-workbench-composer-helpers';
import {
  buildQuickActionChipsFromFields,
  buildWorkspaceVaultSignalsFromFields,
  buildWorkspaceFollowUpActionsFromFields,
  buildWorkspaceShareTextFromFields,
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
  const activeSessionStatus = props.chat.activeSession?.status;
  const activeSessionTitle = props.chat.activeSession?.title;
  const checkpoint = props.chat.checkpoint;
  const showMissionControl = shouldShowMissionControl(props.chat);
  const quickActionChips = useMemo(
    () =>
      buildQuickActionChipsFromFields({
        activeSession: activeSessionStatus ? { status: activeSessionStatus } : undefined,
        checkpoint: checkpoint?.graphState ? { graphState: checkpoint.graphState } : undefined,
        messages: props.chat.messages
      }),
    [activeSessionStatus, checkpoint?.graphState, props.chat.messages]
  );
  const workspaceSnapshot = useMemo(
    () =>
      buildProjectContextSnapshot({
        activeSession: activeSessionTitle ? { title: activeSessionTitle, status: activeSessionStatus } : undefined,
        checkpoint: checkpoint
          ? {
              externalSources: checkpoint.externalSources,
              connectorRefs: checkpoint.connectorRefs,
              usedInstalledSkills: checkpoint.usedInstalledSkills,
              currentWorker: checkpoint.currentWorker,
              currentMinistry: checkpoint.currentMinistry,
              thinkState: checkpoint.thinkState
            }
          : undefined,
        messages: props.chat.messages,
        pendingApprovals: props.chat.pendingApprovals
      }),
    [
      activeSessionStatus,
      activeSessionTitle,
      checkpoint?.connectorRefs,
      checkpoint?.currentMinistry,
      checkpoint?.currentWorker,
      checkpoint?.externalSources,
      checkpoint?.thinkState,
      checkpoint?.usedInstalledSkills,
      props.chat.messages,
      props.chat.pendingApprovals
    ]
  );
  const workspaceVaultSignals = useMemo(
    () =>
      buildWorkspaceVaultSignalsFromFields(
        {
          activeSession: activeSessionStatus ? { status: activeSessionStatus } : undefined,
          checkpoint: checkpoint
            ? {
                externalSources: checkpoint.externalSources,
                reusedMemories: checkpoint.reusedMemories,
                reusedRules: checkpoint.reusedRules,
                reusedSkills: checkpoint.reusedSkills,
                usedInstalledSkills: checkpoint.usedInstalledSkills,
                usedCompanyWorkers: checkpoint.usedCompanyWorkers,
                connectorRefs: checkpoint.connectorRefs,
                learningEvaluation: checkpoint.learningEvaluation,
                skillSearch: checkpoint.skillSearch,
                currentWorker: checkpoint.currentWorker,
                currentMinistry: checkpoint.currentMinistry
              }
            : undefined
        },
        workspaceCenterReadiness
      ),
    [
      activeSessionStatus,
      checkpoint?.connectorRefs,
      checkpoint?.currentMinistry,
      checkpoint?.currentWorker,
      checkpoint?.externalSources,
      checkpoint?.learningEvaluation,
      checkpoint?.reusedMemories,
      checkpoint?.reusedRules,
      checkpoint?.reusedSkills,
      checkpoint?.skillSearch,
      checkpoint?.usedCompanyWorkers,
      checkpoint?.usedInstalledSkills,
      workspaceCenterReadiness
    ]
  );
  const workspaceFollowUps = useMemo(
    () =>
      buildWorkspaceFollowUpActionsFromFields({
        activeSession: activeSessionStatus ? { status: activeSessionStatus } : undefined,
        checkpoint: checkpoint?.graphState ? { graphState: checkpoint.graphState } : undefined,
        messages: props.chat.messages
      }),
    [activeSessionStatus, checkpoint?.graphState, props.chat.messages]
  );
  const visibleMessages = useMemo(() => dedupeMessagesById(props.chat.messages), [props.chat.messages]);
  const visibleBubbleItems = useMemo(() => dedupeBubbleItemsByKey(props.bubbleItems), [props.bubbleItems]);
  const conversationAnchors = useMemo(
    () => filterVisibleConversationAnchors(buildConversationAnchors(visibleMessages), visibleBubbleItems),
    [visibleMessages, visibleBubbleItems]
  );
  const anchoredBubbleItems = useMemo(
    () => attachConversationAnchorTargets(visibleBubbleItems, conversationAnchors),
    [visibleBubbleItems, conversationAnchors]
  );

  useEffect(() => {
    if (!props.showWorkbench) {
      return;
    }

    let isActive = true;
    void getWorkspaceCenterReadiness()
      .then(readiness => {
        if (isActive) {
          setWorkspaceCenterReadiness(readiness);
        }
      })
      .catch(() => {
        if (isActive) {
          setWorkspaceCenterReadiness(undefined);
        }
      });

    return () => {
      isActive = false;
    };
  }, [props.showWorkbench, props.chat.activeSessionId]);

  return (
    <div className={`chatx-workbench ${props.showWorkbench ? 'is-workbench-open' : 'is-workbench-closed'}`}>
      <section className="chatx-chat-column">
        <ConversationAnchorRail anchors={conversationAnchors} />
        <div className="chatx-chat-surface">
          {props.chat.activeSession && showMissionControl ? <SessionMissionControl chat={props.chat} /> : null}
          {!props.chat.hasMessages ? <EmptyFrontlineEntry /> : null}

          <Bubble.List items={anchoredBubbleItems} autoScroll role={CHAT_ROLE_CONFIG} className="chatx-bubble-list" />
        </div>

        <div className={`chatx-composer-shell ${props.chat.hasMessages ? 'is-thread-active' : 'is-empty-thread'}`}>
          <ChatComposer chat={props.chat} quickActionChips={quickActionChips} />
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
                  onClick={() =>
                    void navigator.clipboard.writeText(
                      buildWorkspaceShareTextFromFields({
                        activeSession: activeSessionTitle
                          ? { title: activeSessionTitle, status: activeSessionStatus }
                          : undefined,
                        checkpoint: checkpoint
                          ? {
                              externalSources: checkpoint.externalSources,
                              connectorRefs: checkpoint.connectorRefs,
                              usedInstalledSkills: checkpoint.usedInstalledSkills,
                              currentWorker: checkpoint.currentWorker,
                              currentMinistry: checkpoint.currentMinistry,
                              thinkState: checkpoint.thinkState
                            }
                          : undefined,
                        messages: props.chat.messages,
                        pendingApprovals: props.chat.pendingApprovals
                      })
                    )
                  }
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

function dedupeBubbleItemsByKey(items: BubbleItemType[]) {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = String(item.key);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
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
function EmptyFrontlineEntry() {
  return (
    <div className="chatx-empty-entry">
      <div className="chatx-empty-entry__brand" aria-hidden="true">
        <span className="chatx-brand-mark" />
      </div>
      <div className="chatx-empty-entry__copy">
        <Typography.Title level={1}>开始新对话</Typography.Title>
      </div>
    </div>
  );
}

function ChatComposer({
  chat,
  quickActionChips
}: {
  chat: ReturnType<typeof useChatSession>;
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
          const nextState = resolveComposerChange(value, false);
          setDraft(nextState.draft);
          setSuggestedPayload(nextState.suggestedPayload);
        }}
        onSubmit={value => {
          setDraft('');
          const outbound = resolveComposerSubmit(value, suggestedPayload, false);
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
  buildQuickActionChipsFromFields,
  buildThoughtItems,
  buildThoughtItemsFromFields,
  buildWorkspaceFollowUpActions,
  buildWorkspaceFollowUpActionsFromFields,
  buildWorkspaceVaultSignals,
  buildWorkspaceVaultSignalsFromFields,
  buildWorkspaceShareText,
  buildWorkspaceShareTextFromFields,
  resolveSuggestedDraftSubmission,
  shouldIncludeEventInThoughtLog,
  shouldShowMissionControl
} from './chat-home-workbench-support';
