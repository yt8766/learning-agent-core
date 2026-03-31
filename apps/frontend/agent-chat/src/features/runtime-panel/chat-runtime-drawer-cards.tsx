import { Alert, Button, Card, Descriptions, Empty, Space, Tag, Typography } from 'antd';
import { ThoughtChain } from '@ant-design/x';
import type { ThoughtChainItemType } from '@ant-design/x';

import type { ApprovalRecord, ChatCheckpointRecord, ChatSessionRecord } from '@/types/chat';
import {
  formatRouteConfidence,
  getAgentStateLabel,
  getAgentStateTagColor,
  getApprovalReasonLabel,
  getApprovalRiskLabel,
  getApprovalSummaryCopy,
  getMinistryLabel,
  getModelFallbackCopy,
  getPendingApprovalStatusCopy,
  getWorkerLabel
} from './chat-runtime-drawer-helpers';

const { Text } = Typography;

export function ExecutionStateCard({
  checkpoint,
  getAgentLabel
}: {
  checkpoint?: ChatCheckpointRecord;
  getAgentLabel: (role?: string) => string;
}) {
  return (
    <Card title="执行状态" variant="borderless">
      {checkpoint?.agentStates?.length ? (
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
          {checkpoint.agentStates.map(state => (
            <div key={state.role} className="agent-state-item">
              <div>
                <Text strong>{getAgentLabel(state.role)}</Text>
                <div>
                  <Text type="secondary">{state.finalOutput || state.subTask || '暂未产出阶段结果'}</Text>
                </div>
              </div>
              <Tag color={getAgentStateTagColor(state.status)}>{getAgentStateLabel(state.status)}</Tag>
            </div>
          ))}
        </Space>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无执行状态。" />
      )}
    </Card>
  );
}

export function ApprovalSummaryCard({ pendingApprovals }: { pendingApprovals: ApprovalRecord[] }) {
  return (
    <Card title="审批摘要" variant="borderless">
      {pendingApprovals.length ? (
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          {pendingApprovals.map(approval => (
            <Card key={`${approval.intent}-${approval.decision}`} size="small">
              <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                <Alert
                  type="info"
                  showIcon
                  title={approval.toolName || approval.intent}
                  description={getApprovalSummaryCopy(approval)}
                />
                <Space wrap>
                  <Tag color="processing">待确认</Tag>
                  <Tag
                    color={approval.riskLevel === 'high' ? 'red' : approval.riskLevel === 'medium' ? 'orange' : 'blue'}
                  >
                    {getApprovalRiskLabel(approval.riskLevel)}
                  </Tag>
                  {approval.reasonCode ? <Tag color="purple">{getApprovalReasonLabel(approval.reasonCode)}</Tag> : null}
                </Space>
              </Space>
            </Card>
          ))}
        </Space>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无待审批动作。" />
      )}
    </Card>
  );
}

export function WorkflowRolesCard({
  checkpoint,
  routeReason,
  getAgentLabel
}: {
  checkpoint?: ChatCheckpointRecord;
  routeReason?: string;
  getAgentLabel: (role?: string) => string;
}) {
  return (
    <Card title="流程与角色" variant="borderless">
      <Descriptions
        column={1}
        size="small"
        items={[
          { key: 'workflow', label: '流程模板', children: checkpoint?.resolvedWorkflow?.displayName ?? '通用流程' },
          {
            key: 'ministry',
            label: '当前角色组',
            children: getMinistryLabel(checkpoint?.currentMinistry)
          },
          {
            key: 'worker',
            label: '当前执行角色',
            children: getWorkerLabel(checkpoint?.currentWorker, getAgentLabel)
          },
          {
            key: 'lead',
            label: '主导专家',
            children: checkpoint?.specialistLead
              ? `${checkpoint.specialistLead.displayName} (${checkpoint.specialistLead.domain})`
              : '--'
          },
          {
            key: 'supports',
            label: '支撑专家',
            children: checkpoint?.supportingSpecialists?.length
              ? checkpoint.supportingSpecialists.map(item => item.displayName).join(' / ')
              : '--'
          },
          {
            key: 'confidence',
            label: '路由置信度',
            children: formatRouteConfidence(checkpoint?.routeConfidence)
          },
          { key: 'pending', label: '待处理动作', children: checkpoint?.pendingAction?.intent ?? '--' },
          {
            key: 'approval',
            label: '审批状态',
            children: getPendingApprovalStatusCopy(checkpoint)
          }
        ]}
      />
      {routeReason ? (
        <Alert
          style={{ marginTop: 12 }}
          type="info"
          showIcon
          title={checkpoint?.specialistLead?.domain === 'general-assistant' ? '通用助理兜底原因' : '专家路由依据'}
          description={routeReason}
        />
      ) : null}
      {checkpoint?.dispatches?.length ? (
        <Alert
          style={{ marginTop: 12 }}
          type="info"
          showIcon
          title="票拟分发纪律"
          description={`本轮共记录 ${checkpoint.dispatches.length} 条分发：${
            checkpoint.contextFilterState?.dispatchOrder?.join(' -> ') ??
            Array.from(new Set(checkpoint.dispatches.map(item => item.kind))).join(' / ')
          }。`}
        />
      ) : null}
      {checkpoint?.contextFilterState?.audienceSlices ? (
        <Alert
          style={{ marginTop: 12 }}
          type="info"
          showIcon
          title="文书科受众切片"
          description={`群辅 ${checkpoint.contextFilterState.audienceSlices.strategy.dispatchCount} / 六部 ${checkpoint.contextFilterState.audienceSlices.ministry.dispatchCount} / 通才 ${checkpoint.contextFilterState.audienceSlices.fallback.dispatchCount}`}
        />
      ) : null}
      {checkpoint?.budgetGateState ? (
        <Alert
          style={{ marginTop: 12 }}
          type={checkpoint.budgetGateState.status === 'open' ? 'success' : 'warning'}
          showIcon
          title={`预算门：${checkpoint.budgetGateState.status}`}
          description={`${checkpoint.budgetGateState.summary}${
            typeof checkpoint.budgetGateState.queueDepth === 'number'
              ? `（queue ${checkpoint.budgetGateState.queueDepth}）`
              : ''
          }`}
        />
      ) : null}
      {checkpoint?.complexTaskPlan ? (
        <Alert
          style={{ marginTop: 12 }}
          type="info"
          showIcon
          title={`复杂任务拆解：${checkpoint.complexTaskPlan.status}`}
          description={`${checkpoint.complexTaskPlan.summary}（subGoals ${checkpoint.complexTaskPlan.subGoals.length}）`}
        />
      ) : null}
      {checkpoint?.blackboardState ? (
        <Alert
          style={{ marginTop: 12 }}
          type="info"
          showIcon
          title="全局态视图"
          description={`trace ${checkpoint.blackboardState.refs.traceCount} / evidence ${checkpoint.blackboardState.refs.evidenceCount} / scopes ${checkpoint.blackboardState.visibleScopes.join(' / ')}`}
        />
      ) : null}
      {checkpoint?.finalReviewState ? (
        <Alert
          style={{ marginTop: 12 }}
          type={checkpoint.finalReviewState.decision === 'pass' ? 'success' : 'warning'}
          showIcon
          title={`终审链：${checkpoint.finalReviewState.decision}`}
          description={`${checkpoint.finalReviewState.summary}${
            checkpoint.finalReviewState.deliveryStatus
              ? `；礼部交付 ${checkpoint.finalReviewState.deliveryStatus}${
                  checkpoint.finalReviewState.deliveryMinistry
                    ? `（${getMinistryLabel(checkpoint.finalReviewState.deliveryMinistry)}）`
                    : ''
                }`
              : ''
          }`}
        />
      ) : null}
      {checkpoint?.critiqueResult ? (
        <Alert
          style={{ marginTop: 12 }}
          type={
            checkpoint.critiqueResult.decision === 'pass'
              ? 'success'
              : checkpoint.critiqueResult.decision === 'needs_human_approval'
                ? 'warning'
                : 'error'
          }
          showIcon
          title={`刑部结论：${checkpoint.critiqueResult.decision}`}
          description={`${checkpoint.critiqueResult.summary}（修订 ${checkpoint?.graphState?.revisionCount ?? 0} / ${
            checkpoint?.graphState?.maxRevisions ?? 0
          }）${checkpoint.critiqueResult.shouldBlockEarly ? '；建议前置阻断。' : ''}`}
        />
      ) : null}
      {checkpoint?.criticState ? (
        <Alert
          style={{ marginTop: 12 }}
          type={checkpoint.criticState.decision === 'pass_through' ? 'success' : 'warning'}
          showIcon
          title={`批判层：${checkpoint.criticState.decision}`}
          description={checkpoint.criticState.summary}
        />
      ) : null}
      {checkpoint?.guardrailState ? (
        <Alert
          style={{ marginTop: 12 }}
          type={checkpoint.guardrailState.verdict === 'pass_through' ? 'success' : 'warning'}
          showIcon
          title={`护栏：${checkpoint.guardrailState.stage} / ${checkpoint.guardrailState.verdict}`}
          description={checkpoint.guardrailState.summary}
        />
      ) : null}
      {checkpoint?.governanceScore ? (
        <Alert
          style={{ marginTop: 12 }}
          type={
            checkpoint.governanceScore.status === 'healthy'
              ? 'success'
              : checkpoint.governanceScore.status === 'watch'
                ? 'warning'
                : 'error'
          }
          showIcon
          title={`吏部评分：${checkpoint.governanceScore.score} / ${checkpoint.governanceScore.status}`}
          description={`${checkpoint.governanceScore.summary}（信任调整 ${checkpoint.governanceScore.trustAdjustment}）`}
        />
      ) : null}
      {checkpoint?.governanceReport ? (
        <Alert
          style={{ marginTop: 12 }}
          type="info"
          showIcon
          title="治理报告摘要"
          description={`${checkpoint.governanceReport.reviewOutcome.summary}；证据 ${checkpoint.governanceReport.evidenceSufficiency.score}；sandbox ${checkpoint.governanceReport.sandboxReliability.score}`}
        />
      ) : null}
      {checkpoint?.graphState?.microLoopState ? (
        <Alert
          style={{ marginTop: 12 }}
          type={checkpoint.graphState.microLoopState.state === 'exhausted' ? 'error' : 'info'}
          showIcon
          title={`工兵微循环：${checkpoint.graphState.microLoopState.state}`}
          description={`当前轮次 ${checkpoint.graphState.microLoopState.attempt} / ${checkpoint.graphState.microLoopState.maxAttempts}${
            checkpoint.graphState.microLoopState.exhaustedReason
              ? `；熔断原因 ${checkpoint.graphState.microLoopState.exhaustedReason}`
              : ''
          }`}
        />
      ) : null}
      {checkpoint?.sandboxState ? (
        <Alert
          style={{ marginTop: 12 }}
          type={
            checkpoint.sandboxState.status === 'passed'
              ? 'success'
              : checkpoint.sandboxState.status === 'failed'
                ? 'error'
                : 'info'
          }
          showIcon
          title={`演武场：${checkpoint.sandboxState.stage} / ${checkpoint.sandboxState.status}`}
          description={`attempt ${checkpoint.sandboxState.attempt} / ${checkpoint.sandboxState.maxAttempts}${
            checkpoint.sandboxState.verdict ? `；verdict ${checkpoint.sandboxState.verdict}` : ''
          }${checkpoint.sandboxState.exhaustedReason ? `；${checkpoint.sandboxState.exhaustedReason}` : ''}`}
        />
      ) : null}
      {checkpoint?.knowledgeIngestionState || checkpoint?.knowledgeIndexState ? (
        <Alert
          style={{ marginTop: 12 }}
          type="info"
          showIcon
          title="藏经阁摘要"
          description={`ingestion ${checkpoint?.knowledgeIngestionState?.status ?? 'idle'} / index ${
            checkpoint?.knowledgeIndexState?.indexStatus ?? 'building'
          } / searchable ${checkpoint?.knowledgeIndexState?.searchableDocumentCount ?? 0} / blocked ${
            checkpoint?.knowledgeIndexState?.blockedDocumentCount ?? 0
          }`}
        />
      ) : null}
      {checkpoint?.approvalFeedback ? (
        <Alert
          style={{ marginTop: 12 }}
          type="error"
          showIcon
          title="最近一次批注"
          description={checkpoint.approvalFeedback}
        />
      ) : null}
    </Card>
  );
}

export function ModelRouteCard({
  latestRoute,
  getAgentLabel
}: {
  latestRoute?: NonNullable<ChatCheckpointRecord['modelRoute']>[number];
  getAgentLabel: (role?: string) => string;
}) {
  return (
    <Card title="模型与路由" variant="borderless">
      {latestRoute ? (
        <Descriptions
          column={1}
          size="small"
          items={[
            { key: 'ministry', label: '角色分工', children: getMinistryLabel(latestRoute.ministry) },
            { key: 'worker', label: '执行方式', children: getWorkerLabel(latestRoute.workerId, getAgentLabel) },
            { key: 'selected', label: '当前模型', children: latestRoute.selectedModel },
            {
              key: 'default',
              label: '备用模型',
              children: getModelFallbackCopy(latestRoute.selectedModel, latestRoute.defaultModel)
            },
            { key: 'reason', label: '调整原因', children: latestRoute.reason }
          ]}
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前还没有模型或路由记录。" />
      )}
    </Card>
  );
}

export function LearningRecoveryCard({
  checkpoint,
  activeSession,
  onRecover,
  onConfirmLearning
}: {
  checkpoint?: ChatCheckpointRecord;
  activeSession?: ChatSessionRecord;
  onRecover: () => void;
  onConfirmLearning: () => void;
}) {
  return (
    <Card title="学习与恢复" variant="borderless" extra={<Button onClick={onRecover}>恢复执行</Button>}>
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Alert
          type={
            checkpoint?.learningEvaluation?.conflictDetected
              ? 'warning'
              : activeSession?.status === 'waiting_learning_confirmation'
                ? 'success'
                : 'info'
          }
          showIcon
          title={activeSession?.status === 'waiting_learning_confirmation' ? '学习记录待确认' : '学习结果'}
          description={
            checkpoint?.learningEvaluation
              ? `评估分 ${checkpoint.learningEvaluation.score}，置信度 ${checkpoint.learningEvaluation.confidence}，推荐 ${checkpoint.learningEvaluation.recommendedCandidateIds.length} 项，自动确认 ${checkpoint.learningEvaluation.autoConfirmCandidateIds.length} 项。`
              : '当会话产出可沉淀的信息时，这里会显示学习结果与保守路径原因。'
          }
        />
        {checkpoint?.learningEvaluation?.candidateReasons?.length ? (
          <Descriptions
            column={1}
            size="small"
            items={checkpoint.learningEvaluation.candidateReasons.slice(0, 4).map((reason, index) => ({
              key: `candidate-reason-${index}`,
              label: `沉淀理由 ${index + 1}`,
              children: reason
            }))}
          />
        ) : null}
        {checkpoint?.learningEvaluation?.skippedReasons?.length ? (
          <Descriptions
            column={1}
            size="small"
            items={checkpoint.learningEvaluation.skippedReasons.slice(0, 4).map((reason, index) => ({
              key: `skipped-reason-${index}`,
              label: `跳过原因 ${index + 1}`,
              children: reason
            }))}
          />
        ) : null}
        <Button
          type="primary"
          block
          disabled={activeSession?.status !== 'waiting_learning_confirmation'}
          onClick={onConfirmLearning}
        >
          确认保守路径写入
        </Button>
      </Space>
    </Card>
  );
}

export function ThoughtTimelineCard({ thoughtItems }: { thoughtItems: ThoughtChainItemType[] }) {
  return (
    <Card title="过程时间线" variant="borderless">
      {thoughtItems.length ? (
        <ThoughtChain
          items={thoughtItems}
          defaultExpandedKeys={thoughtItems.slice(0, 3).map(item => item.key as string)}
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前还没有可展示的过程记录。" />
      )}
    </Card>
  );
}
