import { Alert, Button, Collapse, Space, Tag, Typography } from 'antd';
import { Bubble, Sender, Think, ThoughtChain, Welcome } from '@ant-design/x';
import type { BubbleItemType, ThoughtChainItemType } from '@ant-design/x';

import type { useChatSession } from '../../hooks/use-chat-session';
import {
  CHAT_ROLE_CONFIG,
  EVENT_LABELS,
  buildEventSummary,
  getCompressionHint,
  getMinistryLabel,
  getMinistryTone,
  getRiskColor,
  getRunningHint,
  getWorkflowSummary
} from './chat-home-helpers';

const { Text, Title } = Typography;

interface ChatHomeWorkbenchProps {
  chat: ReturnType<typeof useChatSession>;
  showWorkbench: boolean;
  bubbleItems: BubbleItemType[];
  thoughtItems: ThoughtChainItemType[];
  streamEvents: Array<{ id: string; type: string; summary: string; at: string; raw: string }>;
}

export function ChatHomeWorkbench(props: ChatHomeWorkbenchProps) {
  const thinkState = props.chat.checkpoint?.thinkState;
  const runningHint = getRunningHint(props.chat.activeSession?.status, props.chat.checkpoint?.graphState.currentStep);
  const compressionHint = getCompressionHint(props.chat.activeSession);
  const routeSummary = props.chat.checkpoint?.modelRoute?.[props.chat.checkpoint.modelRoute.length - 1];

  return (
    <div className={`chatx-workbench ${props.showWorkbench ? 'is-workbench-open' : 'is-workbench-closed'}`}>
      <section className="chatx-chat-column">
        <div className="chatx-chat-surface">
          {!props.chat.hasMessages ? (
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

          <Bubble.List items={props.bubbleItems} autoScroll role={CHAT_ROLE_CONFIG} className="chatx-bubble-list" />
        </div>

        <div className="chatx-composer-shell">
          <div className="chatx-composer-meta">
            <Space size={6} wrap>
              <Tag color="purple">SSE 流式返回</Tag>
              {props.chat.checkpoint?.skillId ? <Tag color="gold">Skill: {props.chat.checkpoint.skillId}</Tag> : null}
              {props.chat.checkpoint?.graphState.currentStep ? (
                <Tag>{props.chat.checkpoint.graphState.currentStep}</Tag>
              ) : null}
              {props.chat.activeSessionId ? (
                <Tag color="default">Session 已连接</Tag>
              ) : (
                <Tag color="gold">将自动创建会话</Tag>
              )}
            </Space>
          </div>
          <Sender
            value={props.chat.draft}
            onChange={value => props.chat.setDraft(value)}
            onSubmit={value => void props.chat.sendMessage(value)}
            loading={props.chat.activeSession?.status === 'running'}
            onCancel={() => void props.chat.cancelActiveSession()}
            placeholder="输入问题，或使用 /review /qa /browse /ship /retro 等 Skill 命令"
            autoSize={{ minRows: 1, maxRows: 6 }}
          />
        </div>
      </section>

      {props.showWorkbench ? (
        <aside className="chatx-side-column">
          {thinkState ? (
            <section className="chatx-think-panel">
              <Think title={thinkState.title} loading={thinkState.loading} blink={thinkState.blink} defaultExpanded>
                <Text>{thinkState.content}</Text>
              </Think>
            </section>
          ) : null}

          {props.thoughtItems.length ? (
            <section className="chatx-think-panel">
              <ThoughtChain items={props.thoughtItems} />
            </section>
          ) : null}

          {runningHint ? <Alert type="info" showIcon title={runningHint} className="chatx-running-alert" /> : null}
          {compressionHint ? (
            <Alert type="success" showIcon title={compressionHint} className="chatx-running-alert" />
          ) : null}

          {props.chat.checkpoint ? (
            <section className="chatx-war-room">
              <div className="chatx-war-room__header">
                <div>
                  <Text strong>内阁看板</Text>
                  <Text type="secondary">这轮圣旨的尚书分派、模型路由与奏折批注会集中展示在这里。</Text>
                </div>
                <Space size={8} wrap>
                  {props.chat.checkpoint.skillId ? (
                    <Tag color="gold">Skill: {props.chat.checkpoint.skillId}</Tag>
                  ) : null}
                  {props.chat.checkpoint.runId ? <Tag>Run {props.chat.checkpoint.runId.slice(0, 8)}</Tag> : null}
                </Space>
              </div>

              <div className="chatx-war-room__grid">
                <article className="chatx-war-card">
                  <Text className="chatx-war-card__label">首辅规划</Text>
                  <Title level={5}>{props.chat.checkpoint.resolvedWorkflow?.displayName ?? '通用调度流程'}</Title>
                  <Text type="secondary">
                    {getWorkflowSummary(props.chat.checkpoint.resolvedWorkflow?.requiredMinistries)}
                  </Text>
                  <div className="chatx-war-card__meta">
                    <Tag color="purple">{props.chat.checkpoint.graphState.currentStep ?? '等待首辅继续规划'}</Tag>
                    {props.chat.checkpoint.skillStage ? <Tag>{props.chat.checkpoint.skillStage}</Tag> : null}
                  </div>
                </article>

                <article className="chatx-war-card">
                  <Text className="chatx-war-card__label">当值尚书</Text>
                  <Title level={5}>{getMinistryLabel(props.chat.checkpoint.currentMinistry)}</Title>
                  <Text type="secondary">
                    {props.chat.checkpoint.currentWorker
                      ? `当前执行官：${props.chat.checkpoint.currentWorker}`
                      : '尚未选定具体执行官'}
                  </Text>
                  <div className="chatx-war-card__meta">
                    <Tag color={getMinistryTone(props.chat.checkpoint.currentMinistry)}>
                      {props.chat.checkpoint.currentNode ?? '等待进入节点'}
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

              {props.chat.checkpoint.approvalFeedback ? (
                <article className="chatx-decree-note">
                  <div className="chatx-decree-note__header">
                    <Tag color="red">最近批注</Tag>
                    <Text type="secondary">皇帝已打回上一份奏折</Text>
                  </div>
                  <Text>{props.chat.checkpoint.approvalFeedback}</Text>
                </article>
              ) : null}

              {props.chat.checkpoint.pendingApproval ? (
                <article className="chatx-decree-note is-pending">
                  <div className="chatx-decree-note__header">
                    <Tag color="orange">待批奏折</Tag>
                    <Tag color={getRiskColor(props.chat.checkpoint.pendingApproval.riskLevel)}>
                      风险 {props.chat.checkpoint.pendingApproval.riskLevel ?? 'unknown'}
                    </Tag>
                  </div>
                  <Text strong>{props.chat.checkpoint.pendingApproval.intent}</Text>
                  <Text type="secondary">
                    {props.chat.checkpoint.pendingApproval.reason ?? '该动作需要你拍板后才会继续执行。'}
                  </Text>
                  <Space size={8} wrap>
                    <Tag>{props.chat.checkpoint.pendingApproval.toolName}</Tag>
                    <Tag>{props.chat.checkpoint.pendingApproval.requestedBy}</Tag>
                  </Space>
                </article>
              ) : null}
            </section>
          ) : null}

          {props.chat.activeSession?.status === 'waiting_approval' && props.chat.pendingApprovals.length ? (
            <div className="chatx-inline-actions">
              {props.chat.pendingApprovals.map(approval => (
                <Alert
                  key={approval.intent}
                  type="warning"
                  showIcon
                  className="chatx-running-alert"
                  title={`检测到高风险动作：${approval.intent}`}
                  description={
                    <Space wrap>
                      <Text type="secondary">{approval.reason || '该动作需要你确认后才能继续执行。'}</Text>
                      <Button
                        type="primary"
                        size="small"
                        onClick={() => void props.chat.updateApproval(approval.intent, true)}
                      >
                        继续执行
                      </Button>
                      <Button size="small" onClick={() => void props.chat.updateApproval(approval.intent, false)}>
                        拒绝执行
                      </Button>
                    </Space>
                  }
                />
              ))}
            </div>
          ) : null}

          {props.chat.activeSession?.status === 'failed' ? (
            <Alert
              type="error"
              showIcon
              className="chatx-running-alert"
              title="系统执行被中断"
              description={
                <Space wrap>
                  <Text type="secondary">你可以恢复当前会话，让系统基于现有上下文继续下一步。</Text>
                  <Button type="primary" size="small" onClick={() => void props.chat.recoverActiveSession()}>
                    继续下一步
                  </Button>
                </Space>
              }
            />
          ) : null}

          {props.streamEvents.length ? (
            <section className="chatx-stream-panel">
              <div className="chatx-stream-panel__header">
                <div>
                  <Text strong>实时事件流</Text>
                  <Text type="secondary">/api/chat/stream</Text>
                </div>
                <Tag color="blue">{props.streamEvents.length} 条事件</Tag>
              </div>
              <div className="chatx-stream-panel__list">
                <Collapse
                  ghost
                  size="small"
                  className="chatx-stream-collapse"
                  items={props.streamEvents.map(eventItem => ({
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
  );
}

export function buildThoughtItems(chat: ReturnType<typeof useChatSession>): ThoughtChainItemType[] {
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
        typeof payload.from === 'string' ? `来源：${payload.from}` : '',
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
        footer: meta || eventItem.at,
        status:
          eventItem.type === 'session_failed' ? 'error' : eventItem.type === 'session_finished' ? 'success' : 'loading',
        collapsible: Boolean(meta)
      };
    });
}
