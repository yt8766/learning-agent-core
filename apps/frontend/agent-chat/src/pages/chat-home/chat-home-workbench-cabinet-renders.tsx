import { Alert, Tag, Typography } from 'antd';
import type { CollapseProps } from 'antd';

import type { useChatSession } from '@/hooks/use-chat-session';
import { getExecutionModeLabel, getMinistryLabel, getMinistryTone, getWorkflowSummary } from './chat-home-helpers';
import { normalizeExecutionMode } from '@/lib/runtime-semantics';
import { normalizeSpecialistFinding } from './chat-home-specialist-findings';

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

export function renderCabinetSection(params: {
  chat: ReturnType<typeof useChatSession>;
  routeSummary?: {
    selectedModel: string;
    defaultModel: string;
    workerId: string;
    ministry: string;
  };
  activeMode: ReturnType<typeof normalizeExecutionMode>;
  interruptCopy?: { tag: string; summary: string; detail: string };
}) {
  const { chat, routeSummary, activeMode, interruptCopy } = params;
  if (!chat.checkpoint) {
    return null;
  }

  return {
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
            <Text type="secondary">{getWorkflowSummary(chat.checkpoint.resolvedWorkflow?.requiredMinistries)}</Text>
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
            <Title level={5}>{chat.checkpoint.chatRoute?.adapter ?? routeSummary?.selectedModel ?? '待决策'}</Title>
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
                ? ` 只读预算 ${chat.checkpoint.planDraft.microBudget.readOnlyToolsUsed}/${chat.checkpoint.planDraft.microBudget.readOnlyToolLimit}${chat.checkpoint.planDraft.microBudget.budgetTriggered ? '，已触顶。' : '。'}`
                : ''}
            </Text>
          </article>
        ) : null}

        {interruptCopy ? (
          <article className="chatx-decree-note">
            <div className="chatx-decree-note__header">
              <Tag color={interruptCopy.tag === '计划提问' ? 'blue' : 'orange'}>{interruptCopy.tag}</Tag>
              <Text type="secondary">{interruptCopy.summary}</Text>
            </div>
            <Text>{interruptCopy.detail}</Text>
          </article>
        ) : null}
      </section>
    )
  } satisfies NonNullable<CollapseProps['items']>[number];
}

export function renderSpecialistSection(chat: ReturnType<typeof useChatSession>) {
  if (!chat.checkpoint?.specialistFindings?.length) {
    return null;
  }
  return {
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
                {normalized.degraded ? <Alert type="warning" showIcon title={normalized.fallbackMessage} /> : null}
                <div className="chatx-war-card__meta">
                  <Tag>{normalized.contractVersion}</Tag>
                  <Tag>{normalized.stage}</Tag>
                  <Tag>{normalized.source}</Tag>
                  <Tag color="blue">{normalized.specialistId}</Tag>
                  {normalized.riskLevel ? <Tag color="orange">{getFindingRiskLabel(normalized.riskLevel)}</Tag> : null}
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
  } satisfies NonNullable<CollapseProps['items']>[number];
}
