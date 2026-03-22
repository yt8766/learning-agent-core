import { Alert, Button, Card, Collapse, Descriptions, Drawer, Empty, Space, Tag, Typography } from 'antd';
import { ThoughtChain } from '@ant-design/x';
import type { ThoughtChainItemType } from '@ant-design/x';

import type { ChatCheckpointRecord, ChatSessionRecord, ApprovalRecord } from '../../types/chat';

const { Text } = Typography;

interface ChatRuntimeDrawerProps {
  open: boolean;
  activeSession?: ChatSessionRecord;
  checkpoint?: ChatCheckpointRecord;
  pendingApprovals: ApprovalRecord[];
  thoughtItems: ThoughtChainItemType[];
  onClose: () => void;
  onApprove: (intent: string, approved: boolean) => void;
  onConfirmLearning: () => void;
  onRecover: () => void;
  getAgentLabel: (role?: string) => string;
  getSessionStatusLabel: (status?: string) => string;
}

export function ChatRuntimeDrawer({
  open,
  activeSession,
  checkpoint,
  pendingApprovals,
  thoughtItems,
  onClose,
  onApprove,
  onConfirmLearning,
  onRecover,
  getAgentLabel,
  getSessionStatusLabel
}: ChatRuntimeDrawerProps) {
  return (
    <Drawer title="?????" placement="right" width={420} open={open} onClose={onClose}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card title="????" variant="borderless">
          <Descriptions
            column={1}
            size="small"
            items={[
              { key: 'session', label: '????', children: activeSession?.title ?? '???' },
              { key: 'status', label: '??', children: getSessionStatusLabel(activeSession?.status) },
              { key: 'task', label: '??', children: checkpoint?.taskId ?? '--' },
              { key: 'step', label: '??', children: checkpoint?.graphState.currentStep ?? '--' }
            ]}
          />
        </Card>

        <Card title="?????" variant="borderless">
          {activeSession?.compression ? (
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Alert
                type="info"
                showIcon
                message="?????????"
                description={`????? ${activeSession.compression.condensedMessageCount} ???????????????????`}
              />
              <Descriptions
                column={1}
                size="small"
                items={[
                  {
                    key: 'source',
                    label: '????',
                    children: activeSession.compression.source === 'llm' ? 'LLM ????' : '?????'
                  },
                  {
                    key: 'trigger',
                    label: '????',
                    children: activeSession.compression.trigger === 'character_count' ? '??????' : '??????'
                  },
                  { key: 'count', label: '?????', children: `${activeSession.compression.condensedMessageCount} ?` },
                  {
                    key: 'chars',
                    label: '?????',
                    children: `${activeSession.compression.condensedCharacterCount} / ${activeSession.compression.totalCharacterCount}`
                  },
                  { key: 'updatedAt', label: '??????', children: activeSession.compression.updatedAt }
                ]}
              />
              <Collapse
                items={[
                  {
                    key: 'summary',
                    label: '????????????',
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
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="????????????" />
          )}
        </Card>

        <Card title="Agent ??" variant="borderless">
          {checkpoint?.agentStates?.length ? (
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {checkpoint.agentStates.map(state => (
                <div key={state.role} className="agent-state-item">
                  <div>
                    <Text strong>{getAgentLabel(state.role)}</Text>
                    <div>
                      <Text type="secondary">{state.finalOutput || state.subTask || '????'}</Text>
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
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="?? Agent ??" />
          )}
        </Card>

        <Card title="????" variant="borderless">
          {pendingApprovals.length ? (
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {pendingApprovals.map(approval => (
                <Card key={`${approval.intent}-${approval.decision}`} size="small">
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    <Alert
                      type="warning"
                      showIcon
                      message={approval.intent}
                      description={approval.reason || '????????????'}
                    />
                    <Space>
                      <Button type="primary" onClick={() => onApprove(approval.intent, true)}>
                        ??
                      </Button>
                      <Button onClick={() => onApprove(approval.intent, false)}>??</Button>
                    </Space>
                  </Space>
                </Card>
              ))}
            </Space>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="???????" />
          )}
        </Card>

        <Card title="????" variant="borderless" extra={<Button onClick={onRecover}>????</Button>}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Alert
              type={activeSession?.status === 'waiting_learning_confirmation' ? 'success' : 'info'}
              showIcon
              message="??????"
              description="??????????????????????????????????"
            />
            <Button
              type="primary"
              block
              disabled={activeSession?.status !== 'waiting_learning_confirmation'}
              onClick={onConfirmLearning}
            >
              ??????????
            </Button>
          </Space>
        </Card>

        <Card title="?????" variant="borderless">
          {thoughtItems.length ? (
            <ThoughtChain
              items={thoughtItems}
              defaultExpandedKeys={thoughtItems.slice(0, 3).map(item => item.key as string)}
            />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="?????????" />
          )}
        </Card>
      </Space>
    </Drawer>
  );
}
