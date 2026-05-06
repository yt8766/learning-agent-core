import { useMemo } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeTypes
} from '@xyflow/react';

import type { AgentFlowRecord } from '../../types/api';
import { AgentFlowNode, type AgentFlowNodeData } from './agent-flow-node';

const nodeTypes: NodeTypes = {
  agentFlowNode: AgentFlowNode
};

export interface AgentFlowCanvasProps {
  flow: AgentFlowRecord;
  onSelectedNodeChange: (nodeId: string | undefined) => void;
  selectedNodeId?: string;
}

export function AgentFlowCanvas({ flow, onSelectedNodeChange, selectedNodeId }: AgentFlowCanvasProps) {
  const nodes = useMemo<Node<AgentFlowNodeData>[]>(
    () =>
      flow.nodes.map(node => ({
        data: {
          description: node.description,
          label: node.label,
          nodeType: node.type
        },
        id: node.id,
        position: node.position,
        selected: node.id === selectedNodeId,
        type: 'agentFlowNode'
      })),
    [flow.nodes, selectedNodeId]
  );
  const edges = useMemo<Edge[]>(
    () =>
      flow.edges.map(edge => ({
        id: edge.id,
        label: edge.label,
        source: edge.source,
        sourceHandle: edge.sourceHandle,
        target: edge.target,
        targetHandle: edge.targetHandle,
        type: 'smoothstep'
      })),
    [flow.edges]
  );

  return (
    <div className="knowledge-agent-flow-canvas" data-flow-id={flow.id}>
      <ReactFlowProvider>
        <ReactFlow
          edges={edges}
          fitView
          nodeTypes={nodeTypes}
          nodes={nodes}
          onNodeClick={(_, node) => onSelectedNodeChange(node.id)}
          onPaneClick={() => onSelectedNodeChange(undefined)}
        >
          <Background />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
