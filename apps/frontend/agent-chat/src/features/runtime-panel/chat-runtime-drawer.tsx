import { Alert, Button, Card, Collapse, Descriptions, Drawer, Empty, Input, Modal, Space, Tag, Typography } from 'antd';
import { Think, ThoughtChain } from '@ant-design/x';
import type { ThoughtChainItemType } from '@ant-design/x';
import { useState } from 'react';

import type { ChatCheckpointRecord, ChatSessionRecord, ApprovalRecord, ChatThinkState } from '../../types/chat';

const { Text } = Typography;

interface ChatRuntimeDrawerProps {
  open: boolean;
  activeSession?: ChatSessionRecord;
  checkpoint?: ChatCheckpointRecord;
  thinkState?: ChatThinkState;
  pendingApprovals: ApprovalRecord[];
  thoughtItems: ThoughtChainItemType[];
  onClose: () => void;
  onApprove: (intent: string, approved: boolean, feedback?: string) => void;
  onConfirmLearning: () => void;
  onRecover: () => void;
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
  onApprove,
  onConfirmLearning,
  onRecover,
  getAgentLabel,
  getSessionStatusLabel
}: ChatRuntimeDrawerProps) {
  const [feedbackIntent, setFeedbackIntent] = useState('');
  const [feedbackDraft, setFeedbackDraft] = useState('');

  const latestRoute = checkpoint?.modelRoute?.[checkpoint.modelRoute.length - 1];

  return (
    <Drawer title="运行态面板" placement="right" size="large" open={open} onClose={onClose}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card title="会话概览" variant="borderless">
          <Descriptions
            column={1}
            size="small"
            items={[
              { key: 'session', label: '会话', children: activeSession?.title ?? '未命名会话' },
              { key: 'status', label: '状态', children: getSessionStatusLabel(activeSession?.status) },
              { key: 'task', label: '任务', children: checkpoint?.taskId ?? '--' },
              { key: 'step', label: '节点', children: checkpoint?.graphState.currentStep ?? '--' }
            ]}
          />
        </Card>

        <Card title="思考过程" variant="borderless">
          {thinkState ? (
            <Think title={thinkState.title} loading={thinkState.loading} blink={thinkState.blink} defaultExpanded>
              <Text>{thinkState.content}</Text>
            </Think>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前还没有可展示的思考过程。" />
          )}
        </Card>

        <Card title="上下文压缩" variant="borderless">
          {activeSession?.compression ? (
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Alert
                type="info"
                showIcon
                title="检测到历史上下文已压缩"
                description={`系统已压缩 ${activeSession.compression.condensedMessageCount} 条较早消息，用于控制上下文长度。`}
              />
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
                    label: '查看压缩摘要',
                    children: (
                      <Card size="small">
                        <Text type="secondary">{activeSession.compression.summary}</Text>
                      </Card>
                    )
                  }
                ]}
              />
            </Space>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前还没有发生上下文压缩。" />
          )}
        </Card>

        <Card title="Agent 状态" variant="borderless">
          {checkpoint?.agentStates?.length ? (
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {checkpoint.agentStates.map(state => (
                <div key={state.role} className="agent-state-item">
                  <div>
                    <Text strong>{getAgentLabel(state.role)}</Text>
                    <div>
                      <Text type="secondary">{state.finalOutput || state.subTask || '暂未产出阶段结果'}</Text>
                    </div>
                  </div>
                  <Tag
                    color={
                      state.status === 'completed'
                        ? 'success'
                        : state.status === 'running'
                          ? 'processing'
                          : state.status === 'failed'
                            ? 'error'
                            : 'default'
                    }
                  >
                    {state.status}
                  </Tag>
                </div>
              ))}
            </Space>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 Agent 状态。" />
          )}
        </Card>

        <Card title="审批动作" variant="borderless">
          {pendingApprovals.length ? (
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {pendingApprovals.map(approval => (
                <Card key={`${approval.intent}-${approval.decision}`} size="small">
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    <Alert
                      type="warning"
                      showIcon
                      title={approval.intent}
                      description={approval.reason || '该动作需要皇帝批阅后才能继续执行。'}
                    />
                    <Space>
                      <Button type="primary" onClick={() => onApprove(approval.intent, true)}>
                        继续执行
                      </Button>
                      <Button onClick={() => onApprove(approval.intent, false)}>拒绝</Button>
                      <Button
                        type="dashed"
                        onClick={() => {
                          setFeedbackIntent(approval.intent);
                          setFeedbackDraft(approval.reason ?? '');
                        }}
                      >
                        打回并附批注
                      </Button>
                    </Space>
                  </Space>
                </Card>
              ))}
            </Space>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前没有待审批动作。" />
          )}
        </Card>

        <Card title="内阁与尚书" variant="borderless">
          <Descriptions
            column={1}
            size="small"
            items={[
              { key: 'workflow', label: '流程模板', children: checkpoint?.resolvedWorkflow?.displayName ?? '通用流程' },
              { key: 'ministry', label: '当前尚书', children: checkpoint?.currentMinistry ?? '--' },
              { key: 'worker', label: '当前执行官', children: checkpoint?.currentWorker ?? '--' },
              { key: 'pending', label: '待处理动作', children: checkpoint?.pendingAction?.intent ?? '--' },
              {
                key: 'approval',
                label: '待批奏折',
                children: checkpoint?.pendingApproval
                  ? `${checkpoint.pendingApproval.intent} (${checkpoint.pendingApproval.riskLevel ?? 'unknown'})`
                  : '--'
              }
            ]}
          />
          {checkpoint?.approvalFeedback ? (
            <Alert
              style={{ marginTop: 12 }}
              type="error"
              showIcon
              title="最近一次皇帝批注"
              description={checkpoint.approvalFeedback}
            />
          ) : null}
        </Card>

        <Card title="吏部路由" variant="borderless">
          {latestRoute ? (
            <Descriptions
              column={1}
              size="small"
              items={[
                { key: 'ministry', label: '分派部门', children: latestRoute.ministry },
                { key: 'worker', label: '分派执行官', children: latestRoute.workerId },
                { key: 'default', label: '默认模型', children: latestRoute.defaultModel },
                { key: 'selected', label: '实际模型', children: latestRoute.selectedModel },
                { key: 'reason', label: '调整原因', children: latestRoute.reason }
              ]}
            />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前还没有模型路由决策。" />
          )}
        </Card>

        <Card title="学习与恢复" variant="borderless" extra={<Button onClick={onRecover}>恢复会话</Button>}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Alert
              type={activeSession?.status === 'waiting_learning_confirmation' ? 'success' : 'info'}
              showIcon
              title="学习候选确认"
              description="当会话产生 memory、rule、skill 候选时，可以在这里统一确认沉淀。"
            />
            <Button
              type="primary"
              block
              disabled={activeSession?.status !== 'waiting_learning_confirmation'}
              onClick={onConfirmLearning}
            >
              确认写入学习结果
            </Button>
          </Space>
        </Card>

        <Card title="事件时间线" variant="borderless">
          {thoughtItems.length ? (
            <ThoughtChain
              items={thoughtItems}
              defaultExpandedKeys={thoughtItems.slice(0, 3).map(item => item.key as string)}
            />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前还没有可展示的事件。" />
          )}
        </Card>
      </Space>
      <Modal
        title="打回奏折并附批注"
        open={Boolean(feedbackIntent)}
        okText="提交打回意见"
        cancelText="取消"
        onCancel={() => {
          setFeedbackIntent('');
          setFeedbackDraft('');
        }}
        onOk={() => {
          if (!feedbackIntent) {
            return;
          }
          onApprove(feedbackIntent, false, feedbackDraft.trim() || undefined);
          setFeedbackIntent('');
          setFeedbackDraft('');
        }}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Text type="secondary">批注意见会回注到当前流程，供首辅或相关尚书重新处理。</Text>
          <Input.TextArea
            rows={5}
            value={feedbackDraft}
            onChange={event => setFeedbackDraft(event.target.value)}
            placeholder="例如：先补测试截图，再继续执行。"
          />
        </Space>
      </Modal>
    </Drawer>
  );
}
