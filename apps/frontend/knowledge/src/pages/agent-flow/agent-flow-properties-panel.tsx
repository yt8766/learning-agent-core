import { Card, Empty, Space, Tag, Typography } from 'antd';
import type { ReactNode } from 'react';

import type { AgentFlowRecord } from '../../types/api';

export function AgentFlowPropertiesPanel({ flow, selectedNodeId }: { flow: AgentFlowRecord; selectedNodeId?: string }) {
  const selectedNode = flow.nodes.find(node => node.id === selectedNodeId);

  return (
    <Card className="knowledge-agent-flow-properties" title="节点属性">
      {selectedNode ? (
        <Space direction="vertical" size={12}>
          <PropertyItem label="ID" value={selectedNode.id} />
          <PropertyItem label="名称" value={selectedNode.label} />
          <PropertyItem label="类型" value={<Tag>{selectedNode.type}</Tag>} />
          <div>
            <Typography.Text type="secondary">配置</Typography.Text>
            <pre className="knowledge-agent-flow-config">{JSON.stringify(selectedNode.config, null, 2)}</pre>
          </div>
        </Space>
      ) : (
        <Empty description="选择画布节点查看属性" />
      )}
    </Card>
  );
}

function PropertyItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Space direction="vertical" size={2}>
      <Typography.Text type="secondary">{label}</Typography.Text>
      <Typography.Text>{value}</Typography.Text>
    </Space>
  );
}
