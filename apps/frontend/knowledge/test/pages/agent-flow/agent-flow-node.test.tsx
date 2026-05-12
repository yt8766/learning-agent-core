/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@ant-design/icons', () => ({
  ApiOutlined: () => 'ApiOutlined',
  BranchesOutlined: () => 'BranchesOutlined',
  CheckCircleOutlined: () => 'CheckCircleOutlined',
  CloudSyncOutlined: () => 'CloudSyncOutlined',
  DatabaseOutlined: () => 'DatabaseOutlined',
  SendOutlined: () => 'SendOutlined',
  ThunderboltOutlined: () => 'ThunderboltOutlined'
}));

vi.mock('@xyflow/react', () => ({
  Handle: ({ position, type }: any) => (
    <div data-position={position} data-type={type}>
      Handle
    </div>
  ),
  Position: { Top: 'top', Bottom: 'bottom' }
}));

vi.mock('antd', () => ({
  Space: ({ children }: any) => <div>{children}</div>,
  Tag: ({ children, className }: any) => <span className={className}>{children}</span>,
  Typography: {
    Text: ({ children, strong, type, className }: any) => {
      if (strong) return <strong className={className}>{children}</strong>;
      return (
        <span className={className} data-type={type}>
          {children}
        </span>
      );
    }
  }
}));

import { AgentFlowNode, type AgentFlowNodeData } from '@/pages/agent-flow/agent-flow-node';

const NodeComponent = AgentFlowNode as any;

function renderNode(data: AgentFlowNodeData, selected = false, id = 'node-1') {
  return renderToStaticMarkup(<NodeComponent data={data} selected={selected} id={id} type="custom" />);
}

describe('AgentFlowNode', () => {
  it('renders node with label and type tag', () => {
    const data: AgentFlowNodeData = {
      label: 'Knowledge Retrieval',
      nodeType: 'knowledge_retrieve'
    };
    const html = renderNode(data);

    expect(html).toContain('Knowledge Retrieval');
    expect(html).toContain('知识检索');
  });

  it('renders description when provided', () => {
    const data: AgentFlowNodeData = {
      label: 'LLM Generate',
      nodeType: 'llm_generate',
      description: 'Generates text using LLM'
    };
    const html = renderNode(data);

    expect(html).toContain('Generates text using LLM');
    expect(html).toContain('knowledge-agent-flow-node-description');
  });

  it('does not render description when not provided', () => {
    const data: AgentFlowNodeData = {
      label: 'Input',
      nodeType: 'input'
    };
    const html = renderNode(data);

    expect(html).not.toContain('knowledge-agent-flow-node-description');
  });

  it('applies selected class when selected', () => {
    const data: AgentFlowNodeData = {
      label: 'Output',
      nodeType: 'output'
    };
    const html = renderNode(data, true, 'node-4');

    expect(html).toContain('is-selected');
  });

  it('does not apply selected class when not selected', () => {
    const data: AgentFlowNodeData = {
      label: 'Output',
      nodeType: 'output'
    };
    const html = renderNode(data, false, 'node-5');

    expect(html).not.toContain('is-selected');
  });

  it('renders correct icon for input type', () => {
    const data: AgentFlowNodeData = { label: 'Input', nodeType: 'input' };
    const html = renderNode(data, false, 'node-6');

    expect(html).toContain('SendOutlined');
  });

  it('renders correct icon for knowledge_retrieve type', () => {
    const data: AgentFlowNodeData = { label: 'Retrieve', nodeType: 'knowledge_retrieve' };
    const html = renderNode(data, false, 'node-7');

    expect(html).toContain('DatabaseOutlined');
  });

  it('renders correct icon for llm_generate type', () => {
    const data: AgentFlowNodeData = { label: 'Generate', nodeType: 'llm_generate' };
    const html = renderNode(data, false, 'node-8');

    expect(html).toContain('ThunderboltOutlined');
  });

  it('renders correct icon for approval_gate type', () => {
    const data: AgentFlowNodeData = { label: 'Approval', nodeType: 'approval_gate' };
    const html = renderNode(data, false, 'node-9');

    expect(html).toContain('CheckCircleOutlined');
  });

  it('renders correct icon for connector_action type', () => {
    const data: AgentFlowNodeData = { label: 'Connector', nodeType: 'connector_action' };
    const html = renderNode(data, false, 'node-10');

    expect(html).toContain('ApiOutlined');
  });

  it('renders correct icon for intent_classify type', () => {
    const data: AgentFlowNodeData = { label: 'Classify', nodeType: 'intent_classify' };
    const html = renderNode(data, false, 'node-11');

    expect(html).toContain('BranchesOutlined');
  });

  it('renders correct icon for rerank type', () => {
    const data: AgentFlowNodeData = { label: 'Rerank', nodeType: 'rerank' };
    const html = renderNode(data, false, 'node-12');

    expect(html).toContain('BranchesOutlined');
  });

  it('renders correct icon for output type', () => {
    const data: AgentFlowNodeData = { label: 'Output', nodeType: 'output' };
    const html = renderNode(data, false, 'node-13');

    expect(html).toContain('CloudSyncOutlined');
  });

  it('renders handles for connections', () => {
    const data: AgentFlowNodeData = { label: 'Test', nodeType: 'input' };
    const html = renderNode(data, false, 'node-14');

    expect(html).toContain('Handle');
  });

  it('renders correct label for each node type', () => {
    const types: Array<{ type: AgentFlowNodeData['nodeType']; label: string }> = [
      { type: 'approval_gate', label: '审批门' },
      { type: 'connector_action', label: '连接器' },
      { type: 'input', label: '输入' },
      { type: 'intent_classify', label: '意图识别' },
      { type: 'knowledge_retrieve', label: '知识检索' },
      { type: 'llm_generate', label: '模型生成' },
      { type: 'output', label: '输出' },
      { type: 'rerank', label: '重排' }
    ];

    for (const { type, label } of types) {
      const data: AgentFlowNodeData = { label: 'Node', nodeType: type };
      const html = renderNode(data, false, `node-${type}`);
      expect(html).toContain(label);
    }
  });
});
