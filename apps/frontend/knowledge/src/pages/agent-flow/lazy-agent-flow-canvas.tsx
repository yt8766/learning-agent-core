import { lazy } from 'react';

import { KnowledgeLazyBoundary } from '../../app/lazy-boundary';
import type { AgentFlowCanvasProps } from './agent-flow-canvas';

// Canvas rendering pulls in React Flow; keep that browser-heavy surface in its own chunk.
const AgentFlowCanvasChunk = lazy(() =>
  import('./agent-flow-canvas').then(module => ({ default: module.AgentFlowCanvas }))
);

export function LazyAgentFlowCanvas(props: AgentFlowCanvasProps) {
  return (
    <>
      <div className="knowledge-pro-sr-only">
        {props.flow.nodes.map(node => (
          <span key={node.id}>{node.label}</span>
        ))}
      </div>
      <KnowledgeLazyBoundary label="Agent Flow 画布">
        <AgentFlowCanvasChunk {...props} />
      </KnowledgeLazyBoundary>
    </>
  );
}
