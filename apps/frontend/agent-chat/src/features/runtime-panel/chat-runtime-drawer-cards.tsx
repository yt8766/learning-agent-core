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
import { getExecutionStepOwnerLabel, getExecutionStepStatusColor } from './chat-runtime-drawer-card-helpers';
import { WorkflowRoleAlerts } from './chat-runtime-drawer-workflow-alerts';

const { Text } = Typography;

export function ExecutionStepsCard({ checkpoint }: { checkpoint?: ChatCheckpointRecord }) {
  const steps = checkpoint?.chatRoute?.stepsSummary ?? checkpoint?.executionSteps ?? [];
  const current = checkpoint?.currentExecutionStep;

  return (
    <Card title="执行步骤" variant="borderless">
      {steps.length ? (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {current ? (
            <Alert
              type={getExecutionStepStatusColor(current.status)}
              showIcon
              title={`当前阶段：${current.label}`}
              description={`${getExecutionStepOwnerLabel(current.owner)}负责${
                current.reason ? `；原因 ${current.reason}` : current.detail ? `；${current.detail}` : ''
              }`}
            />
          ) : null}
          {steps.map(step => (
            <Card key={step.id} size="small">
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Space wrap>
                  <Tag color={getExecutionStepStatusColor(step.status)}>{step.status}</Tag>
                  <Tag>{step.label}</Tag>
                  <Tag color="blue">{getExecutionStepOwnerLabel(step.owner)}</Tag>
                </Space>
                {step.detail ? <Text type="secondary">{step.detail}</Text> : null}
                {step.reason ? <Text type="secondary">阻断/恢复原因：{step.reason}</Text> : null}
              </Space>
            </Card>
          ))}
        </Space>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前还没有执行步骤投影。" />
      )}
    </Card>
  );
}

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
      <WorkflowRoleAlerts checkpoint={checkpoint} routeReason={routeReason} />
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
