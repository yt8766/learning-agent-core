import { Alert, Button, Collapse, Dropdown, Flex, Space, Switch, Tag, Typography, type MenuProps } from 'antd';
import { Bubble, Sender } from '@ant-design/x';
import type { BubbleItemType } from '@ant-design/x';
import { useEffect, useMemo, useState } from 'react';

import type { useChatSession } from '@/hooks/use-chat-session';
import { CHAT_ROLE_CONFIG, buildProjectContextSnapshot } from './chat-home-helpers';
import { SessionMissionControl } from './chat-home-mission-control';
import { stripLeadingWorkflowCommand } from './chat-home-submit';
import {
  buildQuickActionMenuItems,
  resetComposerState,
  resolveComposerChange,
  resolveComposerPlanModeChange,
  resolveComposerSubmit,
  resolveQuickActionSelection
} from './chat-home-workbench-composer-helpers';
import {
  buildQuickActionChips,
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
  const showMissionControl = shouldShowMissionControl(props.chat);
  const quickActionChips = useMemo(() => buildQuickActionChips(props.chat), [props.chat]);
  const workspaceSnapshot = useMemo(() => buildProjectContextSnapshot(props.chat), [props.chat]);
  const workspaceFollowUps = useMemo(() => buildWorkspaceFollowUpActions(props.chat), [props.chat]);

  return (
    <div className={`chatx-workbench ${props.showWorkbench ? 'is-workbench-open' : 'is-workbench-closed'}`}>
      <section className="chatx-chat-column">
        <div className="chatx-chat-surface">
          {props.chat.activeSession && showMissionControl ? <SessionMissionControl chat={props.chat} /> : null}
          {!props.chat.hasMessages ? <EmptyFrontlineEntry /> : null}

          <Bubble.List items={props.bubbleItems} autoScroll role={CHAT_ROLE_CONFIG} className="chatx-bubble-list" />
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

// checkpoint.activeInterrupt is the persisted 司礼监 / InterruptController projection used by the frontline workbench.
function EmptyFrontlineEntry() {
  return (
    <div className="chatx-empty-entry">
      <div className="chatx-empty-entry__copy">
        <Text className="chatx-empty-entry__eyebrow">Frontline Workspace</Text>
        <Typography.Title level={1}>直接输入你的目标</Typography.Title>
        <Typography.Paragraph>普通问题直接回答，复杂任务自动升级为首辅调度、技能补强与审批闭环。</Typography.Paragraph>
        <Space size={8} wrap>
          <Tag color="blue">Direct Reply</Tag>
          <Tag color="purple">Supervisor</Tag>
          <Tag color="gold">Skill Aware</Tag>
        </Space>
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
  const [planModeEnabled, setPlanModeEnabled] = useState(false);
  const secondaryMenuItems = buildQuickActionMenuItems(quickActionChips) satisfies MenuProps['items'];

  useEffect(() => {
    const nextState = resetComposerState();
    setDraft(nextState.draft);
    setSuggestedPayload(nextState.suggestedPayload);
    setPlanModeEnabled(nextState.planModeEnabled);
  }, [chat.activeSessionId]);

  return (
    <>
      <Sender
        className="chatx-sender"
        value={draft}
        onChange={value => {
          const nextState = resolveComposerChange(value, planModeEnabled);
          setDraft(nextState.draft);
          setSuggestedPayload(nextState.suggestedPayload);
        }}
        onSubmit={value => {
          setDraft('');
          const outbound = resolveComposerSubmit(value, suggestedPayload, planModeEnabled);
          setSuggestedPayload(null);
          void chat.sendMessage(outbound);
        }}
        loading={chat.activeSession?.status === 'running' || Boolean(chat.checkpoint?.thinkState?.loading)}
        onCancel={() => void chat.cancelActiveSession()}
        placeholder="输入内容"
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
                      setPlanModeEnabled(nextState.planModeEnabled);
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
              <div className={`chatx-plan-mode-inline ${planModeEnabled ? 'is-active' : ''}`}>
                <span className="chatx-plan-mode-inline__label">计划模式</span>
                <Switch
                  size="small"
                  checked={planModeEnabled}
                  onChange={checked => {
                    const nextState = resolveComposerPlanModeChange(checked, draft);
                    setDraft(nextState.draft);
                    setSuggestedPayload(nextState.suggestedPayload);
                    setPlanModeEnabled(nextState.planModeEnabled);
                  }}
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
  buildWorkspaceShareText,
  resolveSuggestedDraftSubmission,
  shouldShowMissionControl
} from './chat-home-workbench-support';
