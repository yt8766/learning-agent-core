import { Alert, Collapse, Tag, Typography } from 'antd';
import type { CollapseProps } from 'antd';

import type { useChatSession } from '@/hooks/use-chat-session';
import {
  getCompressionHint,
  getExecutionModeLabel,
  getMinistryLabel,
  getMinistryTone,
  getRunningHint,
  getWorkflowSummary
} from './chat-home-helpers';
import { normalizeExecutionMode } from '@/lib/runtime-semantics';
import { normalizeSpecialistFinding } from './chat-home-specialist-findings';

// activeInterrupt is the persisted 司礼监 / InterruptController projection for the workbench.
const { Text, Title } = Typography;

function getFindingRiskLabel(riskLevel?: string) {
  switch (riskLevel) {
    case 'high':
      return '高风险';
    case 'medium':
      return '中风险';
    case 'low':
      return '低风险';
    default:
      return '';
  }
}

export interface StreamEventRecord {
  id: string;
  type: string;
  summary: string;
  at: string;
  raw: string;
}

export interface WorkbenchSectionState {
  runningHint: string | undefined;
  compressionHint: string | undefined;
  llmFallbackNotes: string[];
  workbenchItems: NonNullable<CollapseProps['items']>;
}

function getCheckpointInteractionKind(checkpoint?: ReturnType<typeof useChatSession>['checkpoint']) {
  const payload = checkpoint?.activeInterrupt?.payload;
  if (
    payload &&
    typeof payload === 'object' &&
    typeof (payload as { interactionKind?: unknown }).interactionKind === 'string'
  ) {
    return (payload as { interactionKind: 'approval' | 'plan-question' | 'supplemental-input' }).interactionKind;
  }
  if (checkpoint?.activeInterrupt?.kind === 'user-input') {
    return 'plan-question';
  }
  if (checkpoint?.activeInterrupt || checkpoint?.pendingApproval) {
    return 'approval';
  }
  return undefined;
}

export function getWorkbenchInterruptCopy(checkpoint?: ReturnType<typeof useChatSession>['checkpoint']) {
  const interactionKind = getCheckpointInteractionKind(checkpoint);
  if (interactionKind === 'plan-question') {
    return {
      tag: '计划提问',
      summary: checkpoint?.planDraft?.questionSet?.title ?? '等待方案澄清',
      detail: checkpoint?.planDraft?.questionSet?.summary ?? '当前仍在方案收敛阶段，等待你回答关键问题后再继续推进。'
    };
  }
  if (interactionKind === 'supplemental-input') {
    return {
      tag: '补充输入',
      summary: checkpoint?.activeInterrupt?.intent ?? '等待补充上下文',
      detail: checkpoint?.activeInterrupt?.reason ?? '当前需要更多信息才能继续执行。'
    };
  }
  if (interactionKind === 'approval') {
    return {
      tag: '操作确认',
      summary: checkpoint?.pendingApproval?.toolName ?? checkpoint?.activeInterrupt?.toolName ?? '等待操作确认',
      detail: checkpoint?.pendingApproval?.reason ?? checkpoint?.activeInterrupt?.reason ?? '当前存在待确认操作。'
    };
  }
  return undefined;
}

export function buildWorkbenchSectionState(
  chat: ReturnType<typeof useChatSession>,
  streamEvents: StreamEventRecord[]
): WorkbenchSectionState {
  const runningHint = getRunningHint(chat.activeSession?.status, chat.checkpoint?.graphState?.currentStep);
  const compressionHint = getCompressionHint(chat.activeSession);
  const routeSummary = chat.checkpoint?.modelRoute?.[(chat.checkpoint?.modelRoute?.length ?? 1) - 1];
  const activeMode = normalizeExecutionMode(chat.checkpoint?.executionMode);
  const llmFallbackNotes = (chat.checkpoint?.agentStates ?? [])
    .flatMap(state => state.observations ?? [])
    .filter(note => note.startsWith('LLM '));
  const approvalHistory = chat.events
    .filter(
      event =>
        event.type === 'approval_resolved' ||
        event.type === 'approval_rejected_with_feedback' ||
        event.type === 'interrupt_resumed' ||
        event.type === 'interrupt_rejected_with_feedback'
    )
    .slice()
    .reverse()
    .map(event => {
      const payload = event.payload ?? {};
      return {
        id: event.id,
        intent: typeof payload.intent === 'string' ? payload.intent : 'unknown',
        toolName: typeof payload.toolName === 'string' ? payload.toolName : '',
        feedback: typeof payload.feedback === 'string' ? payload.feedback : '',
        reason: typeof payload.reason === 'string' ? payload.reason : '',
        at: event.at,
        status: event.type === 'approval_resolved' || event.type === 'interrupt_resumed' ? 'approved' : 'rejected'
      };
    });

  const workbenchItemsRaw = [
    chat.checkpoint
      ? {
          key: 'cabinet',
          label: (
            <div className="chatx-workbench-section__label">
              <Text strong>当前进度</Text>
              <Text type="secondary">模式门、六部执行、前线入口</Text>
            </div>
          ),
          children: (
            <section className="chatx-war-room chatx-war-room--nested">
              <div className="chatx-war-room__grid">
                <article className="chatx-war-card">
                  <Text className="chatx-war-card__label">当前模式</Text>
                  <Title level={5}>{chat.checkpoint.resolvedWorkflow?.displayName ?? '通用调度流程'}</Title>
                  <Text type="secondary">
                    {getWorkflowSummary(chat.checkpoint.resolvedWorkflow?.requiredMinistries)}
                  </Text>
                  <div className="chatx-war-card__meta">
                    <Tag color="purple">{chat.checkpoint.graphState?.currentStep ?? '等待继续处理'}</Tag>
                    {chat.checkpoint.skillStage ? <Tag>{chat.checkpoint.skillStage}</Tag> : null}
                    <Tag color={activeMode === 'plan' ? 'blue' : 'green'}>
                      {getExecutionModeLabel(chat.checkpoint.executionMode)}
                    </Tag>
                  </div>
                </article>

                <article className="chatx-war-card">
                  <Text className="chatx-war-card__label">当前六部参与者</Text>
                  <Title level={5}>{getMinistryLabel(chat.checkpoint.currentMinistry)}</Title>
                  <Text type="secondary">
                    {chat.checkpoint.currentWorker
                      ? `当前执行角色：${chat.checkpoint.currentWorker}`
                      : '尚未选定具体执行角色'}
                  </Text>
                  <div className="chatx-war-card__meta">
                    <Tag color={getMinistryTone(chat.checkpoint.currentMinistry)}>
                      {chat.checkpoint.currentNode ?? '等待进入节点'}
                    </Tag>
                    {routeSummary ? <Tag color="blue">{routeSummary.selectedModel}</Tag> : null}
                  </div>
                </article>

                <article className="chatx-war-card">
                  <Text className="chatx-war-card__label">通政司入口</Text>
                  <Title level={5}>
                    {chat.checkpoint.chatRoute?.adapter ?? routeSummary?.selectedModel ?? '待决策'}
                  </Title>
                  <Text type="secondary">
                    {chat.checkpoint.chatRoute
                      ? `本轮消息先命中 ${chat.checkpoint.chatRoute.adapter}，按 ${chat.checkpoint.chatRoute.flow} 路径处理。`
                      : routeSummary
                        ? `${getMinistryLabel(routeSummary.ministry)} 默认 ${routeSummary.defaultModel}。`
                        : '当前还没有聊天入口或模型路由决策记录。'}
                  </Text>
                  <div className="chatx-war-card__meta">
                    {chat.checkpoint.chatRoute ? (
                      <>
                        <Tag color="geekblue">{chat.checkpoint.chatRoute.flow}</Tag>
                        <Tag>priority {chat.checkpoint.chatRoute.priority}</Tag>
                      </>
                    ) : routeSummary ? (
                      <Tag>{routeSummary.workerId}</Tag>
                    ) : (
                      <Tag>等待路由</Tag>
                    )}
                  </div>
                </article>
              </div>

              {chat.checkpoint.approvalFeedback ? (
                <article className="chatx-decree-note">
                  <div className="chatx-decree-note__header">
                    <Tag color="red">最近批注</Tag>
                    <Text type="secondary">上一轮处理已被打回</Text>
                  </div>
                  <Text>{chat.checkpoint.approvalFeedback}</Text>
                </article>
              ) : null}

              {activeMode === 'plan' ? (
                <article className="chatx-decree-note">
                  <div className="chatx-decree-note__header">
                    <Tag color="blue">模式门</Tag>
                    <Text type="secondary">当前仍在 plan 收敛阶段</Text>
                  </div>
                  <Text>
                    当前只允许仓库内与受控来源研究，open-web、浏览器、终端与写入工具已暂时禁用。
                    {chat.checkpoint.planDraft?.microBudget
                      ? ` 只读预算 ${chat.checkpoint.planDraft.microBudget.readOnlyToolsUsed}/${chat.checkpoint.planDraft.microBudget.readOnlyToolLimit}${
                          chat.checkpoint.planDraft.microBudget.budgetTriggered ? '，已触顶。' : '。'
                        }`
                      : ''}
                  </Text>
                </article>
              ) : null}

              {getWorkbenchInterruptCopy(chat.checkpoint) ? (
                <article className="chatx-decree-note">
                  <div className="chatx-decree-note__header">
                    <Tag color={getWorkbenchInterruptCopy(chat.checkpoint)?.tag === '计划提问' ? 'blue' : 'orange'}>
                      {getWorkbenchInterruptCopy(chat.checkpoint)?.tag}
                    </Tag>
                    <Text type="secondary">{getWorkbenchInterruptCopy(chat.checkpoint)?.summary}</Text>
                  </div>
                  <Text>{getWorkbenchInterruptCopy(chat.checkpoint)?.detail}</Text>
                </article>
              ) : null}
            </section>
          )
        }
      : null,
    chat.checkpoint?.specialistFindings?.length
      ? {
          key: 'specialists',
          label: (
            <div className="chatx-workbench-section__label">
              <Text strong>专家发现</Text>
              <Text type="secondary">{chat.checkpoint.specialistFindings.length} 条结构化判断</Text>
            </div>
          ),
          children: (
            <section className="chatx-stream-panel chatx-stream-panel--nested">
              <div className="chatx-stream-panel__list">
                {chat.checkpoint.specialistFindings.map(finding => {
                  const normalized = normalizeSpecialistFinding(finding);
                  return (
                    <article key={`${finding.specialistId}-${finding.summary}`} className="chatx-war-card">
                      <Text className="chatx-war-card__label">{normalized.domain}</Text>
                      <Title level={5}>{normalized.summary}</Title>
                      {normalized.degraded ? (
                        <Alert type="warning" showIcon message={normalized.fallbackMessage} />
                      ) : null}
                      <div className="chatx-war-card__meta">
                        <Tag>{normalized.contractVersion}</Tag>
                        <Tag>{normalized.stage}</Tag>
                        <Tag>{normalized.source}</Tag>
                        <Tag color="blue">{normalized.specialistId}</Tag>
                        {normalized.riskLevel ? (
                          <Tag color="orange">{getFindingRiskLabel(normalized.riskLevel)}</Tag>
                        ) : null}
                        {typeof normalized.confidence === 'number' ? (
                          <Tag>{Math.round(normalized.confidence * 100)}%</Tag>
                        ) : null}
                      </div>
                      {normalized.blockingIssues.length ? (
                        <Text type="secondary">阻断项：{normalized.blockingIssues.join('；')}</Text>
                      ) : null}
                      {normalized.constraints.length ? (
                        <Text type="secondary">约束：{normalized.constraints.join('；')}</Text>
                      ) : null}
                      {normalized.suggestions.length ? (
                        <Text type="secondary">建议：{normalized.suggestions.join('；')}</Text>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          )
        }
      : null,
    chat.checkpoint?.externalSources?.length
      ? {
          key: 'evidence',
          label: (
            <div className="chatx-workbench-section__label">
              <Text strong>参考内容</Text>
              <Text type="secondary">{chat.checkpoint.externalSources.length} 条记录</Text>
            </div>
          ),
          children: (
            <section className="chatx-stream-panel chatx-stream-panel--nested">
              <div className="chatx-stream-panel__list">
                {chat.checkpoint.externalSources.slice(0, 6).map(source => (
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
    chat.checkpoint?.learningEvaluation
      ? {
          key: 'learning',
          label: (
            <div className="chatx-workbench-section__label">
              <Text strong>学习结果</Text>
              <Text type="secondary">score {chat.checkpoint.learningEvaluation.score}</Text>
            </div>
          ),
          children: (
            <section className="chatx-stream-panel chatx-stream-panel--nested">
              <div className="chatx-stream-panel__list">
                <article className="chatx-war-card">
                  <Text className="chatx-war-card__label">学习置信度</Text>
                  <Title level={5}>{chat.checkpoint.learningEvaluation.confidence}</Title>
                  <Text type="secondary">
                    {chat.checkpoint.learningEvaluation.notes.join('；') || '当前尚无附加说明。'}
                  </Text>
                  <div className="chatx-war-card__meta">
                    <Tag color="purple">推荐 {chat.checkpoint.learningEvaluation.recommendedCandidateIds.length}</Tag>
                    <Tag color="green">
                      自动确认 {chat.checkpoint.learningEvaluation.autoConfirmCandidateIds.length}
                    </Tag>
                  </div>
                </article>
              </div>
            </section>
          )
        }
      : null,
    chat.checkpoint &&
    (chat.checkpoint.reusedMemories?.length ||
      chat.checkpoint.reusedRules?.length ||
      chat.checkpoint.reusedSkills?.length ||
      chat.checkpoint.usedCompanyWorkers?.length)
      ? {
          key: 'reuse',
          label: (
            <div className="chatx-workbench-section__label">
              <Text strong>上下文复用</Text>
              <Text type="secondary">历史经验、规则、技能与执行角色</Text>
            </div>
          ),
          children: (
            <section className="chatx-stream-panel chatx-stream-panel--nested">
              <div className="chatx-stream-panel__list">
                {chat.checkpoint.reusedMemories?.length ? (
                  <article className="chatx-war-card">
                    <Text className="chatx-war-card__label">历史经验</Text>
                    <div className="chatx-war-card__meta">
                      {chat.checkpoint.reusedMemories.map(item => (
                        <Tag key={item} color="gold">
                          {item}
                        </Tag>
                      ))}
                    </div>
                  </article>
                ) : null}
                {chat.checkpoint.reusedRules?.length ? (
                  <article className="chatx-war-card">
                    <Text className="chatx-war-card__label">复用规则</Text>
                    <div className="chatx-war-card__meta">
                      {chat.checkpoint.reusedRules.map(item => (
                        <Tag key={item} color="purple">
                          {item}
                        </Tag>
                      ))}
                    </div>
                  </article>
                ) : null}
                {chat.checkpoint.reusedSkills?.length ? (
                  <article className="chatx-war-card">
                    <Text className="chatx-war-card__label">复用技能</Text>
                    <div className="chatx-war-card__meta">
                      {chat.checkpoint.reusedSkills.map(item => (
                        <Tag key={item} color="gold">
                          {item}
                        </Tag>
                      ))}
                    </div>
                  </article>
                ) : null}
                {chat.checkpoint.usedCompanyWorkers?.length ? (
                  <article className="chatx-war-card">
                    <Text className="chatx-war-card__label">公司专员</Text>
                    <div className="chatx-war-card__meta">
                      {chat.checkpoint.usedCompanyWorkers.map(item => (
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
    approvalHistory.length
      ? {
          key: 'approvals',
          label: (
            <div className="chatx-workbench-section__label">
              <Text strong>审批历史</Text>
              <Text type="secondary">{approvalHistory.length} 条处理记录</Text>
            </div>
          ),
          children: (
            <section className="chatx-stream-panel chatx-stream-panel--nested">
              <div className="chatx-stream-panel__list">
                {approvalHistory.slice(0, 8).map(item => (
                  <article key={item.id} className="chatx-war-card">
                    <Text className="chatx-war-card__label">审批结果</Text>
                    <Title level={5}>{item.toolName || item.intent}</Title>
                    <Text type="secondary">{item.reason || '该审批已处理。'}</Text>
                    <div className="chatx-war-card__meta">
                      <Tag color={item.status === 'approved' ? 'green' : 'red'}>
                        {item.status === 'approved' ? '已执行' : '已拒绝'}
                      </Tag>
                      <Tag>{item.intent}</Tag>
                      <Tag>{item.at}</Tag>
                    </div>
                    {item.feedback ? <Text type="secondary">批注：{item.feedback}</Text> : null}
                  </article>
                ))}
              </div>
            </section>
          )
        }
      : null,
    streamEvents.length
      ? {
          key: 'events',
          label: (
            <div className="chatx-workbench-section__label">
              <Text strong>过程记录</Text>
              <Text type="secondary">{streamEvents.length} 条事件</Text>
            </div>
          ),
          children: (
            <section className="chatx-stream-panel chatx-stream-panel--nested">
              <div className="chatx-stream-panel__list">
                <Collapse
                  ghost
                  size="small"
                  className="chatx-stream-collapse"
                  items={streamEvents.map(eventItem => ({
                    key: eventItem.id,
                    label: (
                      <div className="chatx-stream-event__label">
                        <div className="chatx-stream-event__label-main">
                          <Tag variant="filled" color="processing">
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

  return {
    runningHint,
    compressionHint,
    llmFallbackNotes,
    workbenchItems: workbenchItemsRaw.filter(Boolean) as NonNullable<CollapseProps['items']>
  };
}

export function ChatHomeApprovalActions({ chat }: { chat: ReturnType<typeof useChatSession> }) {
  return (
    <>
      {chat.activeSession?.status === 'failed' || chat.activeSession?.status === 'cancelled' ? (
        <AlertFailureItem />
      ) : null}
    </>
  );
}

function AlertFailureItem() {
  return (
    <article className="chatx-running-alert ant-alert ant-alert-error ant-alert-with-description ant-alert-no-icon">
      <div className="ant-alert-content">
        <div className="ant-alert-message">当前轮次已停止</div>
        <div className="ant-alert-description">
          <Text type="secondary">可以在顶部运行控制区选择“恢复执行”，基于现有上下文继续执行。</Text>
        </div>
      </div>
    </article>
  );
}
