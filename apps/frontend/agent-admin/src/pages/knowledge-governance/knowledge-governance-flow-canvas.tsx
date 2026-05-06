import { Background, Controls, ReactFlow, type Edge, type Node } from '@xyflow/react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { KnowledgeGovernanceNode } from './knowledge-governance-node';
import type { KnowledgeGovernanceFlowNodeData, KnowledgeGovernanceProjection } from './knowledge-governance-types';

type GovernanceFlowNode = Node<KnowledgeGovernanceFlowNodeData>;

const nodeTypes = {
  governance: KnowledgeGovernanceNode
};

function pickProviderTone(projection: KnowledgeGovernanceProjection): KnowledgeGovernanceFlowNodeData['tone'] {
  if (projection.providerHealth.some(provider => provider.status === 'unconfigured')) {
    return 'danger';
  }
  if (
    projection.providerHealth.some(provider => provider.status === 'degraded') ||
    projection.summary.warningCount > 0
  ) {
    return 'warning';
  }
  return 'success';
}

function pickIngestionTone(projection: KnowledgeGovernanceProjection): KnowledgeGovernanceFlowNodeData['tone'] {
  if (projection.ingestionSources.some(source => source.status === 'failed')) {
    return 'danger';
  }
  if (projection.ingestionSources.some(source => source.status === 'paused' || source.failedDocumentCount > 0)) {
    return 'warning';
  }
  return 'success';
}

function pickRetrievalTone(projection: KnowledgeGovernanceProjection): KnowledgeGovernanceFlowNodeData['tone'] {
  if (projection.retrievalDiagnostics.some(diagnostic => diagnostic.failedRetrieverCount > 0)) {
    return 'warning';
  }
  return 'success';
}

function buildGovernanceNodes(projection: KnowledgeGovernanceProjection): GovernanceFlowNode[] {
  const primarySource = projection.ingestionSources[0];
  const primaryDiagnostic = projection.retrievalDiagnostics[0];
  const primaryAgent = projection.agentUsage[0];

  return [
    {
      id: 'ingestion',
      type: 'governance',
      position: { x: 0, y: 90 },
      data: {
        label: primarySource?.label ?? '来源',
        detail: 'Ingestion 来源进入知识治理队列',
        meta: `${projection.ingestionSources.length} sources`,
        tone: pickIngestionTone(projection)
      }
    },
    {
      id: 'index',
      type: 'governance',
      position: { x: 280, y: 20 },
      data: {
        label: '索引',
        detail: `${projection.summary.readyDocumentCount}/${projection.summary.documentCount} 个文档 ready`,
        meta: `${projection.summary.failedJobCount} failed jobs`,
        tone: projection.summary.failedJobCount > 0 ? 'warning' : 'success'
      }
    },
    {
      id: 'retrieval',
      type: 'governance',
      position: { x: 560, y: 90 },
      data: {
        label: '检索诊断',
        detail: primaryDiagnostic?.query ?? '暂无检索样本',
        meta: primaryDiagnostic
          ? `${primaryDiagnostic.hitCount}/${primaryDiagnostic.totalCount} hits`
          : '0 diagnostics',
        tone: pickRetrievalTone(projection)
      }
    },
    {
      id: 'evidence',
      type: 'governance',
      position: { x: 280, y: 190 },
      data: {
        label: '证据',
        detail: 'Evidence 链路回写到治理视图',
        meta: `${projection.agentUsage.reduce((total, agent) => total + agent.evidenceCount, 0)} evidence refs`,
        tone: pickProviderTone(projection)
      }
    },
    {
      id: 'agent-usage',
      type: 'governance',
      position: { x: 840, y: 90 },
      data: {
        label: primaryAgent?.agentLabel ?? 'Agent 使用',
        detail: 'Agent 运行按知识库依赖聚合',
        meta: primaryAgent ? `${primaryAgent.recentRunCount} recent runs` : '0 recent runs',
        tone: primaryAgent ? 'neutral' : 'warning'
      }
    }
  ];
}

function buildGovernanceEdges(): Edge[] {
  return [
    { id: 'ingestion-index', source: 'ingestion', target: 'index', animated: true },
    { id: 'index-retrieval', source: 'index', target: 'retrieval', animated: true },
    { id: 'retrieval-evidence', source: 'retrieval', target: 'evidence' },
    { id: 'evidence-agent-usage', source: 'evidence', target: 'agent-usage' }
  ];
}

export function KnowledgeGovernanceFlowCanvas({ projection }: { projection: KnowledgeGovernanceProjection }) {
  const nodes = buildGovernanceNodes(projection);
  const edges = buildGovernanceEdges();

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">知识治理链路</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="h-[360px] overflow-hidden rounded-lg border border-border/70 bg-background">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            nodesDraggable={false}
            nodesConnectable={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {nodes.map(node => (
            <span key={node.id}>{node.data.label}</span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
