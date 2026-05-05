import { useEffect, useMemo, useState } from 'react';
import { Alert, Card, Spin, Typography } from 'antd';

import { useKnowledgeAgentFlow } from '../../hooks/use-knowledge-agent-flow';
import { RagOpsPage } from '../shared/ui';
import { AgentFlowPropertiesPanel } from './agent-flow-properties-panel';
import { AgentFlowToolbar } from './agent-flow-toolbar';
import { LazyAgentFlowCanvas } from './lazy-agent-flow-canvas';

export function AgentFlowPage() {
  const {
    activeFlow,
    activeFlowId,
    error,
    flows,
    lastRun,
    loading,
    runFlow,
    running,
    saveFlow,
    saving,
    setActiveFlowId
  } = useKnowledgeAgentFlow();
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const selectedNodeStillExists = useMemo(
    () => activeFlow?.nodes.some(node => node.id === selectedNodeId) ?? false,
    [activeFlow?.nodes, selectedNodeId]
  );

  useEffect(() => {
    if (selectedNodeId && !selectedNodeStillExists) {
      setSelectedNodeId(undefined);
    }
  }, [selectedNodeId, selectedNodeStillExists]);

  return (
    <RagOpsPage
      eyebrow="RAG Agent Flow"
      subTitle="编排 Query Rewrite、Retriever、Reranker、Answer、Citation、Feedback 和 Eval Sink。"
      title="Agent Flow"
    >
      <Card className="knowledge-agent-flow-shell">
        <AgentFlowToolbar
          activeFlowId={activeFlowId}
          flows={flows}
          lastRun={lastRun}
          loading={loading}
          onFlowChange={flowId => {
            setActiveFlowId(flowId);
            setSelectedNodeId(undefined);
          }}
          onRun={() => {
            void runFlow();
          }}
          onSave={() => {
            void saveFlow();
          }}
          running={running}
          saving={saving}
        />
        {error ? <Alert message={error.message} showIcon type="error" /> : null}
        {loading ? (
          <div className="knowledge-agent-flow-loading">
            <Spin />
            <Typography.Text type="secondary">正在加载智能代理流程...</Typography.Text>
          </div>
        ) : activeFlow ? (
          <div className="knowledge-agent-flow-layout">
            <LazyAgentFlowCanvas
              flow={activeFlow}
              onSelectedNodeChange={setSelectedNodeId}
              selectedNodeId={selectedNodeId}
            />
            <AgentFlowPropertiesPanel flow={activeFlow} selectedNodeId={selectedNodeId} />
          </div>
        ) : (
          <Typography.Text type="secondary">暂无智能代理流程</Typography.Text>
        )}
      </Card>
    </RagOpsPage>
  );
}
