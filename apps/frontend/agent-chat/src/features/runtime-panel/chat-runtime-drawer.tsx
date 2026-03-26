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

  const latestRoute = checkpoint?.modelRoute?.[(checkpoint?.modelRoute?.length ?? 1) - 1];

  return (
    <Drawer title="工作台" placement="right" size="large" open={open} onClose={onClose}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card title="会话概览" variant="borderless">
          <Descriptions
            column={1}
            size="small"
            items={[
              { key: 'session', label: '会话', children: activeSession?.title ?? '未命名会话' },
              { key: 'status', label: '状态', children: getSessionStatusLabel(activeSession?.status) },
              { key: 'task', label: '任务', children: checkpoint?.taskId ?? '--' },
              { key: 'step', label: '节点', children: checkpoint?.graphState?.currentStep ?? '--' }
            ]}
          />
        </Card>

        <Card title="处理过程" variant="borderless">
          {thinkState ? (
            <Think title={thinkState.title} loading={thinkState.loading} blink={thinkState.blink} defaultExpanded>
              <Text>{thinkState.content}</Text>
            </Think>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前还没有可展示的处理过程。" />
          )}
        </Card>

        <Card title="历史上下文" variant="borderless">
          {activeSession?.compression ? (
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Alert
                type="info"
                showIcon
                title="检测到历史消息已压缩"
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
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前还没有发生历史压缩。" />
          )}
        </Card>

        <Card title="执行状态" variant="borderless">
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
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无执行状态。" />
          )}
        </Card>

        <Card title="待确认操作" variant="borderless">
          {pendingApprovals.length ? (
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {pendingApprovals.map(approval => (
                <Card key={`${approval.intent}-${approval.decision}`} size="small">
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    <Alert
                      type="warning"
                      showIcon
                      title={approval.intent}
                      description={approval.reason || '该动作需要你确认后才能继续执行。'}
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
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前没有待确认操作。" />
          )}
        </Card>

        <Card title="流程与角色" variant="borderless">
          <Descriptions
            column={1}
            size="small"
            items={[
              { key: 'workflow', label: '流程模板', children: checkpoint?.resolvedWorkflow?.displayName ?? '通用流程' },
              { key: 'ministry', label: '当前角色组', children: checkpoint?.currentMinistry ?? '--' },
              { key: 'worker', label: '当前执行角色', children: checkpoint?.currentWorker ?? '--' },
              { key: 'pending', label: '待处理动作', children: checkpoint?.pendingAction?.intent ?? '--' },
              {
                key: 'approval',
                label: '待确认动作',
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
              title="最近一次批注"
              description={checkpoint.approvalFeedback}
            />
          ) : null}
        </Card>

        <Card title="模型与路由" variant="borderless">
          {latestRoute ? (
            <Descriptions
              column={1}
              size="small"
              items={[
                { key: 'ministry', label: '角色组', children: latestRoute.ministry },
                { key: 'worker', label: '执行角色', children: latestRoute.workerId },
                { key: 'default', label: '默认模型', children: latestRoute.defaultModel },
                { key: 'selected', label: '实际模型', children: latestRoute.selectedModel },
                { key: 'reason', label: '调整原因', children: latestRoute.reason }
              ]}
            />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前还没有模型或路由记录。" />
          )}
        </Card>

        <Card title="学习与恢复" variant="borderless" extra={<Button onClick={onRecover}>继续会话</Button>}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Alert
              type={activeSession?.status === 'waiting_learning_confirmation' ? 'success' : 'info'}
              showIcon
              title="学习记录确认"
              description="当会话产出可沉淀的信息时，可以在这里统一确认是否写入长期记录。"
            />
            <Button
              type="primary"
              block
              disabled={activeSession?.status !== 'waiting_learning_confirmation'}
              onClick={onConfirmLearning}
            >
              确认写入
            </Button>
          </Space>
        </Card>

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
      </Space>
      <Modal
        title="打回并附批注"
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
          <Text type="secondary">批注意见会回注到当前流程，供系统重新处理这一轮任务。</Text>
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
