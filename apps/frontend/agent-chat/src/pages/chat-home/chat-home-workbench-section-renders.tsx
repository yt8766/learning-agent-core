import { Collapse, Tag, Typography } from 'antd';
import type { CollapseProps } from 'antd';

import type { useChatSession } from '@/hooks/use-chat-session';
import type { AgentToolProjectedEvent } from '@/utils/agent-tool-event-projections';
import { extractEvidenceEntities } from './chat-home-workbench-evidence-helpers';

export { renderCabinetSection, renderSpecialistSection } from './chat-home-workbench-cabinet-renders';

const { Text, Title } = Typography;

export function renderEvidenceSection(chat: ReturnType<typeof useChatSession>) {
  if (!chat.checkpoint?.externalSources?.length) {
    return null;
  }
  return {
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
                {typeof source.detail?.scopeType === 'string' ? <Tag>{source.detail.scopeType}</Tag> : null}
                {extractEvidenceEntities(source)
                  .slice(0, 2)
                  .map(entity => (
                    <Tag key={`${source.id}:${entity}`}>{entity}</Tag>
                  ))}
              </div>
              {typeof source.detail?.reason === 'string' && source.detail.reason ? (
                <Text type="secondary">采用原因：{source.detail.reason}</Text>
              ) : null}
              {typeof source.detail?.score === 'number' ? (
                <Text type="secondary">score {source.detail.score.toFixed(2)}</Text>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    )
  } satisfies NonNullable<CollapseProps['items']>[number];
}

export function renderLearningSection(chat: ReturnType<typeof useChatSession>) {
  if (!chat.checkpoint?.learningEvaluation) {
    return null;
  }
  return {
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
            <Text className="chatx-war-card__label">本轮学习</Text>
            <Title level={5}>{chat.checkpoint.learningEvaluation.confidence}</Title>
            <Text type="secondary">Workspace learning 已记录本轮评估，可作为 Skill Flywheel 候选输入。</Text>
            <Text type="secondary">{chat.checkpoint.learningEvaluation.notes.join('；') || '当前尚无附加说明。'}</Text>
            <div className="chatx-war-card__meta">
              <Tag color="purple">推荐 {chat.checkpoint.learningEvaluation.recommendedCandidateIds.length}</Tag>
              <Tag color="green">自动确认 {chat.checkpoint.learningEvaluation.autoConfirmCandidateIds.length}</Tag>
              <Tag color="blue">草案提示</Tag>
            </div>
          </article>
        </div>
      </section>
    )
  } satisfies NonNullable<CollapseProps['items']>[number];
}

export function renderReuseSection(chat: ReturnType<typeof useChatSession>) {
  if (
    !chat.checkpoint ||
    !(
      chat.checkpoint.reusedMemories?.length ||
      chat.checkpoint.reusedRules?.length ||
      chat.checkpoint.reusedSkills?.length ||
      chat.checkpoint.usedInstalledSkills?.length ||
      chat.checkpoint.usedCompanyWorkers?.length
    )
  ) {
    return null;
  }
  return {
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
          {chat.checkpoint.reusedSkills?.length || chat.checkpoint.usedInstalledSkills?.length ? (
            <article className="chatx-war-card">
              <Text className="chatx-war-card__label">技能复用</Text>
              <Title level={5}>Skill Flywheel readiness</Title>
              <Text type="secondary">草案提示：当前仅展示真实 checkpoint 复用信号，未收到独立 Skill Draft。</Text>
              <div className="chatx-war-card__meta">
                <Tag color="gold">复用 {chat.checkpoint.reusedSkills?.length ?? 0}</Tag>
                <Tag color="cyan">已安装 {chat.checkpoint.usedInstalledSkills?.length ?? 0}</Tag>
              </div>
            </article>
          ) : null}
          {chat.checkpoint.reusedMemories?.length ? (
            <TagCard title="历史经验" items={chat.checkpoint.reusedMemories} color="gold" />
          ) : null}
          {chat.checkpoint.reusedRules?.length ? (
            <TagCard title="复用规则" items={chat.checkpoint.reusedRules} color="purple" />
          ) : null}
          {chat.checkpoint.reusedSkills?.length ? (
            <TagCard title="复用技能" items={chat.checkpoint.reusedSkills} color="gold" />
          ) : null}
          {chat.checkpoint.usedInstalledSkills?.length ? (
            <TagCard title="已安装技能" items={chat.checkpoint.usedInstalledSkills} color="cyan" />
          ) : null}
          {chat.checkpoint.usedCompanyWorkers?.length ? (
            <TagCard title="公司专员" items={chat.checkpoint.usedCompanyWorkers} color="cyan" />
          ) : null}
        </div>
      </section>
    )
  } satisfies NonNullable<CollapseProps['items']>[number];
}

function TagCard({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <article className="chatx-war-card">
      <Text className="chatx-war-card__label">{title}</Text>
      <div className="chatx-war-card__meta">
        {items.map(item => (
          <Tag key={item} color={color}>
            {item}
          </Tag>
        ))}
      </div>
    </article>
  );
}

export function renderApprovalHistorySection(
  approvalHistory: Array<{
    id: string;
    intent: string;
    toolName: string;
    feedback: string;
    reason: string;
    at: string;
    status: 'approved' | 'rejected';
  }>
) {
  if (!approvalHistory.length) {
    return null;
  }
  return {
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
  } satisfies NonNullable<CollapseProps['items']>[number];
}

export function renderToolExecutionSection(toolEvents: AgentToolProjectedEvent[]) {
  if (!toolEvents.length) {
    return null;
  }
  return {
    key: 'tool-execution',
    label: (
      <div className="chatx-workbench-section__label">
        <Text strong>工具执行</Text>
        <Text type="secondary">{toolEvents.length} 条事件</Text>
      </div>
    ),
    children: (
      <section className="chatx-stream-panel chatx-stream-panel--nested">
        <div className="chatx-stream-panel__list">
          {toolEvents.slice(0, 8).map((eventItem, index) => (
            <article key={`${eventItem.requestId}:${eventItem.kind}:${index}`} className="chatx-war-card">
              <Text className="chatx-war-card__label">{getToolEventKindLabel(eventItem.kind)}</Text>
              <Title level={5}>{eventItem.title}</Title>
              {eventItem.summary ? <Text type="secondary">{eventItem.summary}</Text> : null}
              <div className="chatx-war-card__meta">
                <Tag color={getToolStatusColor(eventItem.status)}>{getToolStatusLabel(eventItem.status)}</Tag>
                {eventItem.toolName ? <Tag>{eventItem.toolName}</Tag> : null}
                {eventItem.riskClass ? <Tag color="orange">{eventItem.riskClass}</Tag> : null}
                {eventItem.streamKind ? <Tag>{eventItem.streamKind}</Tag> : null}
                {eventItem.nodeId ? <Tag>{eventItem.nodeId}</Tag> : null}
              </div>
              {eventItem.approval?.required ? <Text type="secondary">等待审批确认</Text> : null}
            </article>
          ))}
        </div>
      </section>
    )
  } satisfies NonNullable<CollapseProps['items']>[number];
}

export function renderEventStreamSection(
  streamEvents: Array<{ id: string; type: string; summary: string; at: string; raw: string }>
) {
  if (!streamEvents.length) {
    return null;
  }
  return {
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
  } satisfies NonNullable<CollapseProps['items']>[number];
}

function getToolEventKindLabel(kind: AgentToolProjectedEvent['kind']) {
  if (kind === 'tool_selected') {
    return '工具选择';
  }
  if (kind === 'tool_called') {
    return '工具调用';
  }
  if (kind === 'tool_stream') {
    return '流式输出';
  }
  if (kind === 'execution_step') {
    return '执行步骤';
  }
  return '审批中断';
}

function getToolStatusLabel(status: AgentToolProjectedEvent['status']) {
  switch (status) {
    case 'pending':
      return '待执行';
    case 'pending_policy':
      return '策略判定中';
    case 'pending_approval':
      return '待审批';
    case 'queued':
      return '已排队';
    case 'running':
      return '执行中';
    case 'blocked':
      return '已阻断';
    case 'resumed':
      return '已恢复';
    case 'failed':
      return '失败';
    case 'cancelled':
      return '已取消';
    case 'denied':
      return '已拒绝';
    default:
      return '完成';
  }
}

function getToolStatusColor(status: AgentToolProjectedEvent['status']) {
  if (status === 'failed' || status === 'denied' || status === 'cancelled') {
    return 'red';
  }
  if (status === 'blocked' || status === 'pending_approval') {
    return 'orange';
  }
  if (status === 'succeeded' || status === 'resumed') {
    return 'green';
  }
  return 'processing';
}
