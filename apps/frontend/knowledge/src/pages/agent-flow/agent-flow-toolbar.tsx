import { PlayCircleOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Select, Space, Tag, Typography } from 'antd';

import type { AgentFlowRecord, AgentFlowRunResponse } from '../../types/api';

export function AgentFlowToolbar({
  activeFlowId,
  flows,
  lastRun,
  loading,
  onFlowChange,
  onRun,
  onSave,
  running,
  saving
}: {
  activeFlowId?: string;
  flows: AgentFlowRecord[];
  lastRun: AgentFlowRunResponse | null;
  loading: boolean;
  onFlowChange: (flowId: string) => void;
  onRun: () => void;
  onSave: () => void;
  running: boolean;
  saving: boolean;
}) {
  return (
    <div className="knowledge-agent-flow-toolbar">
      <Space align="center" wrap>
        <Typography.Text type="secondary">流程</Typography.Text>
        <Select
          className="knowledge-agent-flow-select"
          disabled={loading}
          onChange={onFlowChange}
          options={flows.map(flow => ({ label: flow.name, value: flow.id }))}
          value={activeFlowId}
        />
        <Button
          disabled={!activeFlowId || loading}
          icon={<PlayCircleOutlined />}
          loading={running}
          onClick={onRun}
          type="primary"
        >
          运行流程
        </Button>
        <Button disabled={!activeFlowId || loading} icon={<SaveOutlined />} loading={saving} onClick={onSave}>
          保存
        </Button>
        {lastRun ? (
          <Tag
            className="knowledge-agent-flow-run-tag"
            color={lastRun.status === 'completed' ? 'success' : 'processing'}
          >
            {lastRun.runId}
          </Tag>
        ) : null}
      </Space>
    </div>
  );
}
