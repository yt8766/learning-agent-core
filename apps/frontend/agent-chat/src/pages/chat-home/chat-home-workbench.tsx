import { Alert, Button, Collapse, Space, Tag, Typography } from 'antd';
import { Bubble, Sender, Welcome } from '@ant-design/x';
import type { BubbleItemType, ThoughtChainItemType } from '@ant-design/x';
import type { CollapseProps } from 'antd';

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
  streamEvents: Array<{ id: string; type: string; summary: string; at: string; raw: string }>;
}

export function ChatHomeWorkbench(props: ChatHomeWorkbenchProps) {
  const runningHint = getRunningHint(props.chat.activeSession?.status, props.chat.checkpoint?.graphState?.currentStep);
  const compressionHint = getCompressionHint(props.chat.activeSession);
  const routeSummary = props.chat.checkpoint?.modelRoute?.[(props.chat.checkpoint?.modelRoute?.length ?? 1) - 1];
  const llmFallbackNotes = (props.chat.checkpoint?.agentStates ?? [])
    .flatMap(state => state.observations ?? [])
    .filter(note => note.startsWith('LLM '));
  const workbenchItemsRaw = [
    props.chat.checkpoint
      ? {
          key: 'cabinet',
          label: (
            <div className="chatx-workbench-section__label">
              <Text strong>当前进度</Text>
              <Text type="secondary">流程、执行角色、入口路由</Text>
            </div>
          ),
          children: (
            <section className="chatx-war-room chatx-war-room--nested">
              <div className="chatx-war-room__grid">
                <article className="chatx-war-card">
                  <Text className="chatx-war-card__label">当前流程</Text>
                  <Title level={5}>{props.chat.checkpoint.resolvedWorkflow?.displayName ?? '通用调度流程'}</Title>
                  <Text type="secondary">
                    {getWorkflowSummary(props.chat.checkpoint.resolvedWorkflow?.requiredMinistries)}
                  </Text>
                  <div className="chatx-war-card__meta">
                    <Tag color="purple">{props.chat.checkpoint.graphState?.currentStep ?? '等待继续处理'}</Tag>
                    {props.chat.checkpoint.skillStage ? <Tag>{props.chat.checkpoint.skillStage}</Tag> : null}
                  </div>
                </article>

                <article className="chatx-war-card">
                  <Text className="chatx-war-card__label">当前角色</Text>
                  <Title level={5}>{getMinistryLabel(props.chat.checkpoint.currentMinistry)}</Title>
                  <Text type="secondary">
                    {props.chat.checkpoint.currentWorker
                      ? `当前执行角色：${props.chat.checkpoint.currentWorker}`
                      : '尚未选定具体执行角色'}
                  </Text>
                  <div className="chatx-war-card__meta">
                    <Tag color={getMinistryTone(props.chat.checkpoint.currentMinistry)}>
                      {props.chat.checkpoint.currentNode ?? '等待进入节点'}
                    </Tag>
                    {routeSummary ? <Tag color="blue">{routeSummary.selectedModel}</Tag> : null}
                  </div>
                </article>

                <article className="chatx-war-card">
                  <Text className="chatx-war-card__label">消息入口</Text>
                  <Title level={5}>
                    {props.chat.checkpoint.chatRoute?.adapter ?? routeSummary?.selectedModel ?? '待决策'}
                  </Title>
                  <Text type="secondary">
                    {props.chat.checkpoint.chatRoute
                      ? `本轮消息先命中 ${props.chat.checkpoint.chatRoute.adapter}，按 ${props.chat.checkpoint.chatRoute.flow} 路径处理。`
                      : routeSummary
                        ? `${getMinistryLabel(routeSummary.ministry)} 默认 ${routeSummary.defaultModel}。`
                        : '当前还没有聊天入口或模型路由决策记录。'}
                  </Text>
                  <div className="chatx-war-card__meta">
                    {props.chat.checkpoint.chatRoute ? (
                      <>
                        <Tag color="geekblue">{props.chat.checkpoint.chatRoute.flow}</Tag>
                        <Tag>priority {props.chat.checkpoint.chatRoute.priority}</Tag>
                      </>
                    ) : routeSummary ? (
                      <Tag>{routeSummary.workerId}</Tag>
                    ) : (
                      <Tag>等待路由</Tag>
                    )}
                  </div>
                </article>
              </div>

              {props.chat.checkpoint.approvalFeedback ? (
                <article className="chatx-decree-note">
                  <div className="chatx-decree-note__header">
                    <Tag color="red">最近批注</Tag>
                    <Text type="secondary">上一轮处理已被打回</Text>
                  </div>
                  <Text>{props.chat.checkpoint.approvalFeedback}</Text>
                </article>
              ) : null}

              {props.chat.checkpoint.pendingApproval ? (
                <article className="chatx-decree-note is-pending">
                  <div className="chatx-decree-note__header">
                    <Tag color="orange">待确认</Tag>
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
          )
        }
      : null,
    props.chat.checkpoint?.externalSources?.length
      ? {
          key: 'evidence',
          label: (
            <div className="chatx-workbench-section__label">
              <Text strong>参考内容</Text>
              <Text type="secondary">{props.chat.checkpoint.externalSources.length} 条记录</Text>
            </div>
          ),
          children: (
            <section className="chatx-stream-panel chatx-stream-panel--nested">
              <div className="chatx-stream-panel__list">
                {props.chat.checkpoint.externalSources.slice(0, 6).map(source => (
                  <article key={source.id} className="chatx-war-card">
                    <Text className="chatx-war-card__label">
                      {source.sourceType === 'freshness_meta' ? 'freshness' : source.sourceType}
                    </Text>
                    <Title level={5}>{source.summary}</Title>
                    <Text type="secondary">
                      {source.sourceType === 'freshness_meta'
                        ? typeof source.detail?.referenceTime === 'string'
                          ? source.detail.referenceTime
                          : (source.fetchedAt ?? 'internal-evidence')
                        : (source.sourceUrl ?? source.sourceId ?? 'internal-evidence')}
                    </Text>
                    <div className="chatx-war-card__meta">
                      <Tag color={source.sourceType === 'freshness_meta' ? 'orange' : 'blue'}>{source.trustClass}</Tag>
                      {source.sourceType === 'freshness_meta' && typeof source.detail?.sourceCount === 'number' ? (
                        <Tag>{source.detail.sourceCount} 条来源</Tag>
                      ) : null}
                      {source.fetchedAt ? <Tag>{source.fetchedAt}</Tag> : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )
        }
      : null,
    props.chat.checkpoint?.learningEvaluation
      ? {
          key: 'learning',
          label: (
            <div className="chatx-workbench-section__label">
              <Text strong>学习结果</Text>
              <Text type="secondary">score {props.chat.checkpoint.learningEvaluation.score}</Text>
            </div>
          ),
          children: (
            <section className="chatx-stream-panel chatx-stream-panel--nested">
              <div className="chatx-stream-panel__list">
                <article className="chatx-war-card">
                  <Text className="chatx-war-card__label">学习置信度</Text>
                  <Title level={5}>{props.chat.checkpoint.learningEvaluation.confidence}</Title>
                  <Text type="secondary">
                    {props.chat.checkpoint.learningEvaluation.notes.join('；') || '当前尚无附加说明。'}
                  </Text>
                  <div className="chatx-war-card__meta">
                    <Tag color="purple">
                      推荐 {props.chat.checkpoint.learningEvaluation.recommendedCandidateIds.length}
                    </Tag>
                    <Tag color="green">
                      自动确认 {props.chat.checkpoint.learningEvaluation.autoConfirmCandidateIds.length}
                    </Tag>
                  </div>
                </article>
              </div>
            </section>
          )
        }
      : null,
    props.chat.checkpoint &&
    (props.chat.checkpoint.reusedSkills?.length || props.chat.checkpoint.usedCompanyWorkers?.length)
      ? {
          key: 'reuse',
          label: (
            <div className="chatx-workbench-section__label">
              <Text strong>复用记录</Text>
              <Text type="secondary">技能与执行角色复用</Text>
            </div>
          ),
          children: (
            <section className="chatx-stream-panel chatx-stream-panel--nested">
              <div className="chatx-stream-panel__list">
                {props.chat.checkpoint.reusedSkills?.length ? (
                  <article className="chatx-war-card">
                    <Text className="chatx-war-card__label">复用技能</Text>
                    <div className="chatx-war-card__meta">
                      {props.chat.checkpoint.reusedSkills.map(item => (
                        <Tag key={item} color="gold">
                          {item}
                        </Tag>
                      ))}
                    </div>
                  </article>
                ) : null}
                {props.chat.checkpoint.usedCompanyWorkers?.length ? (
                  <article className="chatx-war-card">
                    <Text className="chatx-war-card__label">公司专员</Text>
                    <div className="chatx-war-card__meta">
                      {props.chat.checkpoint.usedCompanyWorkers.map(item => (
                        <Tag key={item} color="cyan">
                          {item}
                        </Tag>
                      ))}
                    </div>
                  </article>
                ) : null}
              </div>
            </section>
          )
        }
      : null,
    props.streamEvents.length
      ? {
          key: 'events',
          label: (
            <div className="chatx-workbench-section__label">
              <Text strong>过程记录</Text>
              <Text type="secondary">{props.streamEvents.length} 条事件</Text>
            </div>
          ),
          children: (
            <section className="chatx-stream-panel chatx-stream-panel--nested">
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
          )
        }
      : null
  ];
  const workbenchItems = workbenchItemsRaw.filter(Boolean) as NonNullable<CollapseProps['items']>;

  return (
    <div className={`chatx-workbench ${props.showWorkbench ? 'is-workbench-open' : 'is-workbench-closed'}`}>
      <section className="chatx-chat-column">
        <div className="chatx-chat-surface">
          {!props.chat.hasMessages ? (
            <div className="chatx-welcome-wrap">
              <Welcome
                variant="borderless"
                title="开始对话"
                description="直接提问或继续追问。需要时再打开右侧详情，查看过程、参考内容和学习结果。"
                extra={
                  <Space size={8} wrap>
                    <Tag color="blue">自然对话</Tag>
                    <Tag color="purple">按需展开详情</Tag>
                  </Space>
                }
              />
            </div>
          ) : null}

          <Bubble.List items={props.bubbleItems} autoScroll role={CHAT_ROLE_CONFIG} className="chatx-bubble-list" />
        </div>

        <div className="chatx-composer-shell">
          <Sender
            value={props.chat.draft}
            onChange={value => props.chat.setDraft(value)}
            onSubmit={value => void props.chat.sendMessage(value)}
            loading={
              props.chat.activeSession?.status === 'running' || Boolean(props.chat.checkpoint?.thinkState?.loading)
            }
            onCancel={() => void props.chat.cancelActiveSession()}
            placeholder="输入问题，继续追问，或使用 /review /qa /browse /ship"
            autoSize={{ minRows: 1, maxRows: 6 }}
          />
        </div>
      </section>

      {props.showWorkbench ? (
        <aside className="chatx-side-column">
          {runningHint ? <Alert type="info" showIcon title={runningHint} className="chatx-running-alert" /> : null}
          {compressionHint ? (
            <Alert type="success" showIcon title={compressionHint} className="chatx-running-alert" />
          ) : null}
          {llmFallbackNotes.length ? (
            <Alert
              type="warning"
              showIcon
              title="本轮普通聊天没有拿到模型正常输出，当前展示的是兜底回复。"
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
