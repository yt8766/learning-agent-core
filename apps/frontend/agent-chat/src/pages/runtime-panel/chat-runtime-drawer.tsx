import { Alert, Button, Card, Collapse, Descriptions, Drawer, Empty, Space, Tag, Typography } from 'antd';

import type { WorkbenchThoughtProjectionItem } from '@/types/workbench-thought-projection';
import { CognitionInferenceSection } from '@/components/cognition';

import type { ChatCheckpointRecord, ChatSessionRecord, ApprovalRecord, ChatThinkState } from '@/types/chat';
import {
  buildRouteReason,
  getExecutionModeLabel,
  getExecutionModeSummary,
  getInterruptInteractionKind,
  getInterruptInteractionKindLabel,
  getInterruptStatusSummary,
  getLegacyModeNote,
  getMinistryLabel,
  getRuntimeDrawerExportScopeCopy
} from './chat-runtime-drawer-helpers';
import {
  ApprovalSummaryCard,
  ExecutionStateCard,
  ExecutionStepsCard,
  LearningRecoveryCard,
  ModelRouteCard,
  ThoughtTimelineCard,
  WorkflowRolesCard
} from './chat-runtime-drawer-cards';
import { renderCompressionDetails } from './chat-runtime-drawer-sections';
import { normalizeExecutionMode } from '@/lib/runtime-semantics';

const { Text } = Typography;

export {
  getInterruptStatusSummary,
  getRuntimeDrawerExportFilters,
  getRuntimeDrawerExportScopeCopy
} from './chat-runtime-drawer-helpers';

interface ChatRuntimeDrawerProps {
  open: boolean;
  activeSession?: ChatSessionRecord;
  checkpoint?: ChatCheckpointRecord;
  thinkState?: ChatThinkState;
  pendingApprovals: ApprovalRecord[];
  thoughtItems: WorkbenchThoughtProjectionItem[];
  onClose: () => void;
  onConfirmLearning: () => void;
  onRecover: () => void;
  onExportRuntime: () => void;
  onExportApprovals: () => void;
  onDownloadReplay: () => void;
  onCopyShareLinks: () => void;
  getAgentLabel: (role?: string) => string;
  getSessionStatusLabel: (status?: string) => string;
}

export function ChatRuntimeDrawer({
  open,
  activeSession,
  checkpoint,
  thinkState,
  pendingApprovals,
  thoughtItems,
  onClose,
  onConfirmLearning,
  onRecover,
  onExportRuntime,
  onExportApprovals,
  onDownloadReplay,
  onCopyShareLinks,
  getAgentLabel,
  getSessionStatusLabel
}: ChatRuntimeDrawerProps) {
  const latestRoute = checkpoint?.modelRoute?.[(checkpoint?.modelRoute?.length ?? 1) - 1];
  const routeReason = buildRouteReason(checkpoint);
  const activeMode = normalizeExecutionMode(checkpoint?.executionMode);
  const canonicalModeLabel = getExecutionModeLabel(checkpoint?.executionMode);
  const legacyModeNote = getLegacyModeNote(checkpoint);
  const strategyParticipants = [
    checkpoint?.specialistLead?.displayName,
    ...(checkpoint?.supportingSpecialists?.map(item => item.displayName) ?? [])
  ].filter((value): value is string => Boolean(value));
  const executionParticipants = Array.from(
    new Set([...(checkpoint?.resolvedWorkflow?.requiredMinistries ?? []), checkpoint?.currentMinistry].filter(Boolean))
  ).map(item => getMinistryLabel(item));

  return (
    <Drawer title="工作台" placement="right" size="large" open={open} onClose={onClose}>
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Card title="会话概览" variant="borderless">
          <Descriptions
            column={1}
            size="small"
            items={[
              { key: 'session', label: '会话', children: activeSession?.title ?? '未命名会话' },
              { key: 'status', label: '状态', children: getSessionStatusLabel(activeSession?.status) },
              { key: 'task', label: '任务', children: checkpoint?.taskId ?? '--' },
              {
                key: 'step',
                label: '节点',
                children: checkpoint?.streamStatus?.nodeLabel ?? checkpoint?.graphState?.currentStep ?? '--'
              },
              {
                key: 'stream',
                label: '节点战报',
                children: checkpoint?.streamStatus?.detail
                  ? `${checkpoint.streamStatus.detail}${
                      typeof checkpoint.streamStatus.progressPercent === 'number'
                        ? `（${checkpoint.streamStatus.progressPercent}%）`
                        : ''
                    }`
                  : '--'
              },
              {
                key: 'executionMode',
                label: '当前模式',
                children: legacyModeNote ? `${canonicalModeLabel} · ${legacyModeNote}` : canonicalModeLabel
              },
              {
                key: 'interactionKind',
                label: '交互类型',
                children: getInterruptInteractionKindLabel(getInterruptInteractionKind(checkpoint))
              },
              { key: 'interruptSummary', label: '中断摘要', children: getInterruptStatusSummary(checkpoint) }
            ]}
          />
          <Space style={{ marginTop: 12 }} wrap>
            <Button size="small" onClick={onExportRuntime}>
              导出 runtime
            </Button>
            <Button size="small" onClick={onExportApprovals}>
              导出 approvals
            </Button>
            <Button size="small" onClick={onDownloadReplay} disabled={!activeSession?.id}>
              下载 replay
            </Button>
            <Button size="small" onClick={onCopyShareLinks}>
              复制分享链接
            </Button>
          </Space>
          <Alert
            style={{ marginTop: 12 }}
            type="info"
            showIcon
            title="导出与回放范围"
            description={getRuntimeDrawerExportScopeCopy(checkpoint)}
          />
          <Alert
            style={{ marginTop: 12 }}
            type={activeMode === 'plan' ? 'info' : 'success'}
            showIcon
            title={activeMode === 'plan' ? '模式门已切到 plan' : '模式门已切到 execute'}
            description={getExecutionModeSummary(checkpoint)}
          />
          <Descriptions
            style={{ marginTop: 12 }}
            column={1}
            size="small"
            items={[
              {
                key: 'ministries',
                label: '当前六部参与者',
                children: executionParticipants.length ? executionParticipants.join(' / ') : '尚未装载执行部'
              },
              {
                key: 'counselors',
                label: '当前群辅参与者',
                children: strategyParticipants.length ? strategyParticipants.join(' / ') : '当前未启用群辅票拟'
              },
              {
                key: 'interrupt-controller',
                label: '司礼监状态',
                children: checkpoint?.activeInterrupt ? '有待恢复中断，恢复入口统一经司礼监。' : '当前无待恢复中断'
              }
            ]}
          />
        </Card>

        <Card title="处理过程" variant="borderless">
          {thinkState ? (
            <CognitionInferenceSection title={thinkState.title} loading={thinkState.loading}>
              {thinkState.content}
            </CognitionInferenceSection>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前还没有可展示的处理过程。" />
          )}
        </Card>

        <Card title="历史上下文" variant="borderless">
          {activeSession?.compression ? (
            <Space orientation="vertical" size={10} style={{ width: '100%' }}>
              <Alert
                type="info"
                showIcon
                title="Earlier Context 已压缩"
                description={
                  activeSession.compression.summary ||
                  `系统已压缩 ${activeSession.compression.condensedMessageCount} 条较早消息，用于控制上下文长度。`
                }
              />
              <Space wrap>
                {activeSession.compression.periodOrTopic ? (
                  <Tag color="blue">{activeSession.compression.periodOrTopic}</Tag>
                ) : null}
                {(activeSession.compression.focuses ?? []).slice(0, 3).map(item => (
                  <Tag key={`focus-${item}`} color="processing">
                    {item}
                  </Tag>
                ))}
                {(activeSession.compression.risks ?? []).slice(0, 2).map(item => (
                  <Tag key={`risk-${item}`} color="orange">
                    {item}
                  </Tag>
                ))}
              </Space>
              <Descriptions
                column={1}
                size="small"
                items={[
                  {
                    key: 'source',
                    label: '来源',
                    children: activeSession.compression.source === 'llm' ? 'LLM 总结' : '启发式总结'
                  },
                  {
                    key: 'trigger',
                    label: '触发条件',
                    children:
                      activeSession.compression.trigger === 'character_count' ? '字符数达到阈值' : '消息数达到阈值'
                  },
                  {
                    key: 'count',
                    label: '压缩消息数',
                    children: `${activeSession.compression.condensedMessageCount} 条`
                  },
                  {
                    key: 'chars',
                    label: '字符统计',
                    children: `${activeSession.compression.condensedCharacterCount} / ${activeSession.compression.totalCharacterCount}`
                  },
                  { key: 'updatedAt', label: '更新时间', children: activeSession.compression.updatedAt }
                ]}
              />
              <Collapse
                items={[
                  {
                    key: 'summary',
                    label: '查看压缩上下文',
                    children: (
                      <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                        <Card size="small">
                          <Text type="secondary">{activeSession.compression.summary}</Text>
                        </Card>
                        {renderCompressionDetails(
                          activeSession.compression.focuses,
                          activeSession.compression.keyDeliverables,
                          activeSession.compression.risks,
                          activeSession.compression.nextActions,
                          activeSession.compression.supportingFacts,
                          activeSession.compression.previewMessages
                        )}
                      </Space>
                    )
                  }
                ]}
              />
            </Space>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前还没有发生历史压缩。" />
          )}
        </Card>

        <ExecutionStateCard checkpoint={checkpoint} getAgentLabel={getAgentLabel} />
        <ExecutionStepsCard checkpoint={checkpoint} />
        <ApprovalSummaryCard pendingApprovals={pendingApprovals} />
        <WorkflowRolesCard checkpoint={checkpoint} routeReason={routeReason} getAgentLabel={getAgentLabel} />
        <ModelRouteCard latestRoute={latestRoute} getAgentLabel={getAgentLabel} />
        <LearningRecoveryCard
          checkpoint={checkpoint}
          activeSession={activeSession}
          onRecover={onRecover}
          onConfirmLearning={onConfirmLearning}
        />
        <ThoughtTimelineCard thoughtItems={thoughtItems} />
      </Space>
    </Drawer>
  );
}
