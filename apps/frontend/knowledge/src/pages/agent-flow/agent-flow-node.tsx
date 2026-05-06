import { memo } from 'react';
import {
  ApiOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  CloudSyncOutlined,
  DatabaseOutlined,
  SendOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Space, Tag, Typography } from 'antd';

import type { AgentFlowRecord } from '../../types/api';

type AgentFlowNodeRecord = AgentFlowRecord['nodes'][number];

export interface AgentFlowNodeData {
  [key: string]: unknown;
  description?: string;
  label: string;
  nodeType: AgentFlowNodeRecord['type'];
}

const nodeTypeLabels: Record<AgentFlowNodeRecord['type'], string> = {
  approval_gate: '审批门',
  connector_action: '连接器',
  input: '输入',
  intent_classify: '意图识别',
  knowledge_retrieve: '知识检索',
  llm_generate: '模型生成',
  output: '输出',
  rerank: '重排'
};

export const AgentFlowNode = memo(function AgentFlowNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as AgentFlowNodeData;

  return (
    <div className={`knowledge-agent-flow-node ${selected ? 'is-selected' : ''}`}>
      <Handle position={Position.Top} type="target" />
      <Space align="start" size={10}>
        <span aria-hidden="true" className="knowledge-agent-flow-node-icon">
          {renderNodeIcon(nodeData.nodeType)}
        </span>
        <Space direction="vertical" size={4}>
          <Typography.Text strong>{nodeData.label}</Typography.Text>
          <Tag className="knowledge-agent-flow-node-tag">{nodeTypeLabels[nodeData.nodeType]}</Tag>
          {nodeData.description ? (
            <Typography.Text className="knowledge-agent-flow-node-description" type="secondary">
              {nodeData.description}
            </Typography.Text>
          ) : null}
        </Space>
      </Space>
      <Handle position={Position.Bottom} type="source" />
    </div>
  );
});

function renderNodeIcon(type: AgentFlowNodeRecord['type']) {
  switch (type) {
    case 'input':
      return <SendOutlined />;
    case 'knowledge_retrieve':
      return <DatabaseOutlined />;
    case 'llm_generate':
      return <ThunderboltOutlined />;
    case 'approval_gate':
      return <CheckCircleOutlined />;
    case 'connector_action':
      return <ApiOutlined />;
    case 'intent_classify':
    case 'rerank':
      return <BranchesOutlined />;
    case 'output':
      return <CloudSyncOutlined />;
  }
}
