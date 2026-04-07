import { Alert, Button, Collapse, Dropdown, Flex, Space, Switch, Tag, Typography, type MenuProps } from 'antd';
import { Bubble, Sender } from '@ant-design/x';
import type { BubbleItemType, ThoughtChainItemType } from '@ant-design/x';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import type { useChatSession } from '@/hooks/use-chat-session';
import {
  CHAT_ROLE_CONFIG,
  EVENT_LABELS,
  buildEventSummary,
  buildProjectContextSnapshot,
  humanizeOperationalCopy
} from './chat-home-helpers';
import { SessionMissionControl } from './chat-home-mission-control';
import { buildSubmitMessage, stripLeadingWorkflowCommand } from './chat-home-submit';
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

interface QuickActionChip {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: 'primary' | 'secondary';
}

const SenderSwitch = Sender.Switch;
const { Text } = Typography;

const QUICK_SUGGESTIONS: QuickActionChip[] = [
  {
    label: '普通聊天',
    value: '请直接回答我接下来的问题，并在必要时给出简短依据',
    icon: <span>·</span>,
    tone: 'secondary'
  },
  {
    label: '代码修改',
    value: '/browse 请帮我分析当前代码并给出修改方案',
    icon: <span>{`{}`}</span>,
    tone: 'secondary'
  },
  { label: '审查风险', value: '/review 请审查我当前会话里的改动和风险', icon: <span>!</span>, tone: 'secondary' },
  { label: '研究整理', value: '/qa 请帮我调研这个问题并整理关键结论', icon: <span>#</span>, tone: 'secondary' }
];

export function resolveSuggestedDraftSubmission(input: string, suggestedPayload: string | null) {
  const normalizedValue = input.trim();
  if (suggestedPayload && normalizedValue === stripLeadingWorkflowCommand(suggestedPayload)) {
    return {
      display: normalizedValue,
      payload: suggestedPayload
    };
  }

  return buildSubmitMessage(input);
}

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

export function shouldShowMissionControl(chat: ReturnType<typeof useChatSession>) {
  const hasDialogue = chat.messages.some(message => message.role === 'user' || message.role === 'assistant');
  if (hasDialogue) {
    return false;
  }

  if (chat.pendingApprovals.length) {
    return true;
  }

  const status = chat.activeSession?.status;
  if (status && status !== 'idle') {
    return true;
  }

  return Boolean(
    chat.checkpoint?.currentMinistry ||
    chat.checkpoint?.currentWorker ||
    chat.checkpoint?.chatRoute ||
    chat.checkpoint?.thinkState?.content
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
  const secondaryMenuItems = quickActionChips.map(item => ({
    key: item.label,
    icon: item.icon,
    label: item.label
  })) satisfies MenuProps['items'];

  useEffect(() => {
    setDraft('');
    setSuggestedPayload(null);
    setPlanModeEnabled(false);
  }, [chat.activeSessionId]);

  return (
    <>
      <Sender
        className="chatx-sender"
        value={draft}
        onChange={value => {
          setDraft(value);
          setSuggestedPayload(null);
        }}
        onSubmit={value => {
          setDraft('');
          const outbound =
            suggestedPayload && !planModeEnabled
              ? resolveSuggestedDraftSubmission(value, suggestedPayload)
              : buildSubmitMessage(value, planModeEnabled ? ['plan'] : []);
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
                      const matched = quickActionChips.find(item => item.label === info.key);
                      if (!matched) {
                        return;
                      }
                      setDraft(stripLeadingWorkflowCommand(matched.value));
                      setSuggestedPayload(matched.value);
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
                    setPlanModeEnabled(checked);
                    setSuggestedPayload(null);
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

export function buildQuickActionChips(chat: ReturnType<typeof useChatSession>): QuickActionChip[] {
  const currentStep = chat.checkpoint?.graphState?.currentStep;
  const status = chat.activeSession?.status;
  const hasSettledAssistantReply = chat.messages.some(
    message => message.role === 'assistant' && message.content.trim() && !message.id.startsWith('pending_assistant_')
  );
  const resultFollowUps: QuickActionChip[] = hasSettledAssistantReply
    ? [
        {
          label: '继续深挖',
          value: '/qa 请基于刚才的结论继续深挖最关键的风险、假设和下一步',
          icon: <span>+</span>,
          tone: 'secondary'
        },
        {
          label: '改成计划',
          value: '/plan-eng-review 请把刚才的结论改写成一个可执行计划',
          icon: <span>^</span>,
          tone: 'secondary'
        },
        {
          label: '生成执行任务',
          value: '/browse 请基于刚才的结论生成下一步执行任务并继续推进',
          icon: <span>{`{}`}</span>,
          tone: 'secondary'
        },
        {
          label: '输出检查单',
          value: '/qa 请基于刚才的结论生成检查单和验收标准',
          icon: <span>@</span>,
          tone: 'secondary'
        }
      ]
    : [];
  const contextChildren: QuickActionChip[] =
    currentStep === 'review'
      ? [
          {
            label: '列出风险与回归点',
            value: '/review 请按严重程度列出风险、回归点和缺失测试',
            icon: <span>!</span>,
            tone: 'secondary'
          },
          { label: '给出发布前检查单', value: '/qa 请给我一份发布前检查单', icon: <span>@</span>, tone: 'secondary' }
        ]
      : currentStep === 'execute'
        ? [
            {
              label: '给出下一步改动',
              value: '/browse 请基于当前进度给我下一步最小改动方案',
              icon: <span>^</span>,
              tone: 'secondary'
            },
            { label: '先补测试再继续', value: '/qa 请先列出本轮最该补的测试', icon: <span>#</span>, tone: 'secondary' }
          ]
        : [
            {
              label: '审查改动',
              value: '/review 请审查我当前会话里的改动和风险',
              icon: <span>!</span>,
              tone: 'secondary'
            },
            {
              label: '列测试点',
              value: '/qa 请帮我列出这个需求的测试点和验收标准',
              icon: <span>#</span>,
              tone: 'secondary'
            }
          ];

  const chips = [
    ...resultFollowUps,
    ...QUICK_SUGGESTIONS,
    ...(status === 'running' ? contextChildren : contextChildren.slice(0, 2))
  ];

  const deduped = chips.filter(
    (item, index, list) => list.findIndex(candidate => candidate.label === item.label) === index
  );

  return deduped.slice(0, 5);
}

export function buildWorkspaceFollowUpActions(chat: ReturnType<typeof useChatSession>) {
  const chips = buildQuickActionChips(chat);
  return chips.filter(item => ['继续深挖', '改成计划', '生成执行任务', '输出检查单'].includes(item.label));
}

export function buildWorkspaceShareText(chat: ReturnType<typeof useChatSession>) {
  const snapshot = buildProjectContextSnapshot(chat);
  const lines = [
    `当前目标：${snapshot.objective}`,
    `最新结论：${snapshot.latestOutcome}`,
    `来源数：${snapshot.evidenceCount}`,
    `技能数：${snapshot.skillCount}`,
    `连接器数：${snapshot.connectorCount}`,
    snapshot.currentWorker ? `当前执行者：${snapshot.currentWorker}` : '',
    snapshot.currentMinistry ? `当前执行线：${snapshot.currentMinistry}` : ''
  ].filter(Boolean);

  return lines.join('\n');
}

export function buildThoughtItems(chat: ReturnType<typeof useChatSession>): ThoughtChainItemType[] {
  const capabilityThought = buildCapabilityThoughtItem(chat);
  const streamStatusThought = buildStreamStatusThoughtItem(chat);
  const recentCompletedNodeThoughts = buildRecentCompletedNodeThoughtItems(chat);
  const optimisticThought = buildOptimisticThoughtItem(chat);

  if (optimisticThought) {
    return [streamStatusThought, ...recentCompletedNodeThoughts, capabilityThought, optimisticThought].filter(
      Boolean
    ) as ThoughtChainItemType[];
  }

  if (chat.checkpoint?.thoughtChain?.length) {
    const activeMessageId = chat.checkpoint.thinkState?.messageId;
    const scopedThoughtChain =
      activeMessageId && chat.checkpoint.thoughtChain.some(item => item.messageId === activeMessageId)
        ? chat.checkpoint.thoughtChain.filter(item => !item.messageId || item.messageId === activeMessageId)
        : chat.checkpoint.thoughtChain;
    const items = scopedThoughtChain.map(item => ({
      key: item.key,
      title: humanizeOperationalCopy(item.title),
      description: humanizeOperationalCopy(item.description),
      content: item.content ? (
        <pre className="chatx-thought-raw">{humanizeOperationalCopy(item.content)}</pre>
      ) : undefined,
      footer: item.footer,
      status: item.status,
      collapsible: item.collapsible,
      blink: item.blink
    }));

    return [streamStatusThought, ...recentCompletedNodeThoughts, capabilityThought, ...items].filter(
      Boolean
    ) as ThoughtChainItemType[];
  }

  const items = chat.events
    .slice()
    .reverse()
    .map(eventItem => {
      const payload = eventItem.payload ?? {};
      const meta = [
        typeof payload.from === 'string' ? `来源：${payload.from}` : '',
        typeof payload.node === 'string' ? `节点：${payload.node}` : '',
        typeof payload.intent === 'string' ? `意图：${payload.intent}` : '',
        typeof payload.decision === 'string' ? `结果：${payload.decision}` : ''
      ]
        .filter(Boolean)
        .join(' · ');

      return {
        key: eventItem.id,
        title: humanizeOperationalCopy(EVENT_LABELS[eventItem.type] ?? eventItem.type),
        description: buildEventSummary(eventItem),
        footer: meta || eventItem.at,
        status: resolveThoughtItemStatus(eventItem.type),
        collapsible: Boolean(meta)
      };
    });

  return [streamStatusThought, ...recentCompletedNodeThoughts, capabilityThought, ...items].filter(
    Boolean
  ) as ThoughtChainItemType[];
}

function resolveThoughtItemStatus(eventType: string) {
  if (
    eventType === 'session_failed' ||
    eventType === 'approval_rejected_with_feedback' ||
    eventType === 'interrupt_rejected_with_feedback'
  ) {
    return 'error' as const;
  }

  if (
    eventType === 'session_started' ||
    eventType === 'user_message' ||
    eventType === 'assistant_message' ||
    eventType === 'final_response_completed' ||
    eventType === 'session_finished' ||
    eventType === 'approval_resolved' ||
    eventType === 'interrupt_resumed' ||
    eventType === 'learning_confirmed' ||
    eventType === 'review_completed' ||
    eventType === 'skill_stage_completed'
  ) {
    return 'success' as const;
  }

  return 'loading' as const;
}

function buildOptimisticThoughtItem(chat: ReturnType<typeof useChatSession>): ThoughtChainItemType | undefined {
  const checkpoint = chat.checkpoint;
  if (!checkpoint?.thinkState?.loading || !checkpoint.taskId.startsWith('optimistic_')) {
    return undefined;
  }

  return {
    key: `optimistic-think-${checkpoint.taskId}`,
    title: humanizeOperationalCopy(checkpoint.thinkState.title),
    description: humanizeOperationalCopy(checkpoint.thinkState.content),
    footer: '正在准备这轮回复',
    status: 'loading',
    collapsible: false,
    blink: true
  };
}

function buildStreamStatusThoughtItem(chat: ReturnType<typeof useChatSession>): ThoughtChainItemType | undefined {
  const streamStatus = chat.checkpoint?.streamStatus;
  if (!streamStatus) {
    return undefined;
  }

  const summary = buildNodeStreamCognitionSummary(streamStatus);
  if (!summary) {
    return undefined;
  }

  return {
    key: `stream-status-${chat.checkpoint?.taskId ?? chat.activeSessionId ?? 'current'}`,
    title: streamStatus.nodeLabel ?? '当前节点',
    description: summary,
    footer: streamStatus.updatedAt,
    status:
      typeof streamStatus.progressPercent === 'number' && streamStatus.progressPercent >= 100 ? 'success' : 'loading',
    collapsible: false,
    blink: true
  };
}

function buildRecentCompletedNodeThoughtItems(chat: ReturnType<typeof useChatSession>): ThoughtChainItemType[] {
  const currentNodeId = chat.checkpoint?.streamStatus?.nodeId;
  return chat.events
    .filter(eventItem => eventItem.type === 'node_status' && eventItem.payload?.phase === 'end')
    .slice()
    .reverse()
    .map(eventItem => {
      const payload = eventItem.payload ?? {};
      const nodeId = typeof payload.nodeId === 'string' ? payload.nodeId : '';
      const nodeLabel = typeof payload.nodeLabel === 'string' ? payload.nodeLabel : nodeId || '节点';
      const detail = typeof payload.detail === 'string' ? payload.detail : '';
      const progressPercent = typeof payload.progressPercent === 'number' ? payload.progressPercent : undefined;
      return {
        key: `node-complete-${eventItem.id}`,
        nodeId,
        item: {
          key: `node-complete-${eventItem.id}`,
          title: nodeLabel,
          description: buildNodeStreamCognitionSummary({ nodeLabel, detail, progressPercent }) ?? (detail || '已完成'),
          footer: eventItem.at,
          status: 'success' as const,
          collapsible: false
        }
      };
    })
    .filter(entry => !currentNodeId || entry.nodeId !== currentNodeId)
    .slice(0, 3)
    .map(entry => entry.item);
}

function buildNodeStreamCognitionSummary(streamStatus?: {
  nodeLabel?: string;
  detail?: string;
  progressPercent?: number;
}) {
  if (!streamStatus) {
    return undefined;
  }

  const segments = [
    typeof streamStatus.nodeLabel === 'string' ? streamStatus.nodeLabel : '',
    typeof streamStatus.detail === 'string' ? streamStatus.detail : '',
    typeof streamStatus.progressPercent === 'number' ? `进度 ${streamStatus.progressPercent}%` : ''
  ].filter(Boolean);

  if (!segments.length) {
    return undefined;
  }

  const source = segments.join(' · ');
  const normalized = source.replace(/\s+/g, ' ').trim();
  const firstSentence = normalized.split(/[。！？\n]/)[0]?.trim() || normalized;

  if (firstSentence.length <= 26) {
    return firstSentence;
  }

  return `${firstSentence.slice(0, 26).trimEnd()}...`;
}

function buildCapabilityThoughtItem(chat: ReturnType<typeof useChatSession>): ThoughtChainItemType | undefined {
  const checkpoint = chat.checkpoint;
  if (!checkpoint) {
    return undefined;
  }

  const usedSkills = checkpoint.usedInstalledSkills ?? [];
  const workers = checkpoint.usedCompanyWorkers ?? [];
  const connectors = checkpoint.connectorRefs ?? [];
  const pendingSkill =
    checkpoint.pendingApproval?.intent === 'install_skill'
      ? checkpoint.pendingApproval.preview?.find(item => item.label === 'Skill')?.value
      : checkpoint.activeInterrupt?.kind === 'skill-install'
        ? checkpoint.activeInterrupt.preview?.find(item => item.label === 'Skill')?.value
        : undefined;
  const missingConnector =
    checkpoint.skillSearch?.mcpRecommendation?.kind === 'connector' &&
    !connectors.length &&
    checkpoint.skillSearch.mcpRecommendation.connectorTemplateId
      ? formatConnectorLabel(checkpoint.skillSearch.mcpRecommendation.connectorTemplateId)
      : undefined;

  const summaryParts = [
    usedSkills.length ? `已复用 ${usedSkills.slice(0, 3).join('、')}` : '',
    workers.length ? `已调用 ${workers.slice(0, 2).join('、')}` : '',
    connectors.length ? `已接入 ${connectors.slice(0, 2).join('、')}` : '',
    pendingSkill ? `等待安装 ${pendingSkill}` : '',
    missingConnector ? `未接入 ${missingConnector}，按现有能力继续` : '',
    checkpoint.currentWorker ? `当前由 ${checkpoint.currentWorker} 推进` : ''
  ].filter(Boolean);

  if (!summaryParts.length) {
    return undefined;
  }

  const details = [
    usedSkills.length ? `Skills: ${usedSkills.join(', ')}` : '',
    workers.length ? `Workers: ${workers.join(', ')}` : '',
    connectors.length ? `MCP / Connectors: ${connectors.join(', ')}` : '',
    pendingSkill ? `Pending install: ${pendingSkill}` : '',
    missingConnector ? `Capability gap: ${missingConnector}` : ''
  ]
    .filter(Boolean)
    .join('\n');

  return {
    key: `capability-${checkpoint.taskId}`,
    title: '能力链路',
    description: summaryParts.join(' · '),
    content: details ? <pre className="chatx-thought-raw">{details}</pre> : undefined,
    footer: checkpoint.updatedAt,
    status:
      pendingSkill || checkpoint.graphState?.status === 'running'
        ? 'loading'
        : checkpoint.graphState?.status === 'failed'
          ? 'error'
          : 'success',
    collapsible: Boolean(details)
  };
}

function formatConnectorLabel(templateId: 'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template') {
  switch (templateId) {
    case 'github-mcp-template':
      return 'GitHub MCP';
    case 'browser-mcp-template':
      return 'Browser MCP';
    case 'lark-mcp-template':
      return 'Lark MCP';
    default:
      return templateId;
  }
}
