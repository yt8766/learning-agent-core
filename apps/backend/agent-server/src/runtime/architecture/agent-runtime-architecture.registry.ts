import { listWorkflowPresets, WorkerRegistry } from '@agent/agent-core';
import type {
  ArchitectureDescriptor,
  ArchitectureDescriptorRegistryEntry,
  ArchitectureNodeDescriptor
} from '@agent/shared';

export function buildAgentArchitectureDescriptor(input: {
  workflows: ReturnType<typeof listWorkflowPresets>;
  workers: ReturnType<WorkerRegistry['list']>;
}): ArchitectureDescriptor {
  const ministryCounts = input.workers.reduce<Record<string, number>>((acc, worker) => {
    acc[worker.ministry] = (acc[worker.ministry] ?? 0) + 1;
    return acc;
  }, {});

  const nodes: ArchitectureNodeDescriptor[] = [
    { id: 'entry-router', label: 'EntryRouter', kind: 'entry', subgraphId: 'main-chain' },
    { id: 'budget-gate', label: 'BudgetGate', kind: 'governance', subgraphId: 'main-chain' },
    {
      id: 'mode-gate',
      label: 'ModeGate\nplan | execute | imperial_direct',
      kind: 'governance',
      subgraphId: 'main-chain'
    },
    { id: 'complex-task-plan', label: 'ComplexTaskPlanner', kind: 'runtime', subgraphId: 'main-chain' },
    { id: 'dispatch-planner', label: 'DispatchPlanner', kind: 'runtime', subgraphId: 'main-chain' },
    { id: 'context-filter', label: 'ContextFilter', kind: 'runtime', subgraphId: 'main-chain' },
    { id: 'result-aggregator', label: 'ResultAggregator', kind: 'runtime', subgraphId: 'main-chain' },
    { id: 'critic', label: 'Critic', kind: 'governance', subgraphId: 'review-chain' },
    { id: 'xingbu-final', label: 'Xingbu Final Review', kind: 'ministry', subgraphId: 'review-chain' },
    { id: 'libu-delivery', label: 'Libu Delivery', kind: 'ministry', subgraphId: 'review-chain' },
    { id: 'interrupt-controller', label: 'InterruptController', kind: 'runtime', subgraphId: 'review-chain' },
    { id: 'learning-recorder', label: 'LearningRecorder', kind: 'governance', subgraphId: 'review-chain' },
    { id: 'strategy-layer', label: '群辅策略层', kind: 'strategy', subgraphId: 'dispatch' },
    { id: 'ministry-layer', label: '六部执行层', kind: 'ministry', subgraphId: 'dispatch' },
    { id: 'fallback-layer', label: '通才兜底', kind: 'fallback', subgraphId: 'dispatch' },
    { id: 'blackboard', label: 'blackboardState', kind: 'data', subgraphId: 'state' },
    { id: 'sandbox', label: 'safe-exec sandbox', kind: 'governance', subgraphId: 'state' }
  ];

  Object.entries(ministryCounts).forEach(([ministry, count]) => {
    nodes.push({
      id: `worker-${ministry}`,
      label: `${ministry}\nworkers: ${count}`,
      kind: 'ministry',
      subgraphId: 'dispatch'
    });
  });
  input.workflows.slice(0, 4).forEach(workflow => {
    nodes.push({
      id: `workflow-${workflow.id}`,
      label: `${workflow.id}\n${workflow.requiredMinistries.join(' / ')}`,
      kind: 'registry',
      subgraphId: 'state'
    });
  });

  return {
    id: 'agent-architecture',
    title: 'Agent 架构图',
    scope: 'agent',
    direction: 'TD',
    sourceDescriptors: [
      'workflow route registry',
      'workflow preset registry',
      'worker registry',
      'subgraph registry',
      'runtime center descriptor'
    ],
    subgraphs: [
      { id: 'main-chain', title: 'Main Runtime Chain' },
      { id: 'dispatch', title: 'Strategy / Ministry / Fallback' },
      { id: 'review-chain', title: 'Critic / Final Review / Delivery' },
      { id: 'state', title: 'Blackboard / Sandbox / Workflow Context' }
    ],
    nodes,
    edges: [
      { from: 'entry-router', to: 'budget-gate' },
      { from: 'budget-gate', to: 'mode-gate' },
      { from: 'mode-gate', to: 'complex-task-plan' },
      { from: 'complex-task-plan', to: 'dispatch-planner' },
      { from: 'dispatch-planner', to: 'context-filter' },
      { from: 'context-filter', to: 'result-aggregator' },
      { from: 'result-aggregator', to: 'critic' },
      { from: 'critic', to: 'xingbu-final', label: 'pass_through' },
      { from: 'critic', to: 'dispatch-planner', label: 'rewrite_required', style: 'dashed' },
      { from: 'xingbu-final', to: 'libu-delivery', label: 'pass' },
      { from: 'xingbu-final', to: 'interrupt-controller', label: 'revise / block', style: 'dashed' },
      { from: 'libu-delivery', to: 'learning-recorder' },
      { from: 'dispatch-planner', to: 'strategy-layer', label: 'strategy' },
      { from: 'dispatch-planner', to: 'ministry-layer', label: 'ministry' },
      { from: 'dispatch-planner', to: 'fallback-layer', label: 'fallback' },
      { from: 'strategy-layer', to: 'blackboard', label: 'read' },
      { from: 'ministry-layer', to: 'blackboard', label: 'read / write' },
      { from: 'ministry-layer', to: 'sandbox', label: 'gongbu / bingbu safe-exec' }
    ]
  };
}

export function createAgentArchitectureRegistryEntry(input: {
  workflows: ReturnType<typeof listWorkflowPresets>;
  workers: ReturnType<WorkerRegistry['list']>;
}): ArchitectureDescriptorRegistryEntry {
  const sourceDescriptors = [
    'workflow route registry',
    'workflow preset registry',
    'worker registry',
    'subgraph registry',
    'runtime center descriptor'
  ];

  return {
    id: 'agent',
    sourceDescriptors,
    build: () => buildAgentArchitectureDescriptor(input)
  };
}
