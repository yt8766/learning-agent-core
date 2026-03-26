export interface SubgraphDescriptor {
  id: 'research' | 'execution' | 'review' | 'skill-install' | 'background-runner';
  displayName: string;
  description: string;
  owner: string;
  entryNodes: string[];
}

const SUBGRAPH_DESCRIPTORS: SubgraphDescriptor[] = [
  {
    id: 'research',
    displayName: 'Research Subgraph',
    description: '负责资料检索、来源整理、证据收集与 research 进展上报。',
    owner: 'hubu-search',
    entryNodes: ['research', 'research_progress']
  },
  {
    id: 'execution',
    displayName: 'Execution Subgraph',
    description: '负责代码执行、终端动作、浏览器动作与 tool route。',
    owner: 'gongbu-code/bingbu-ops',
    entryNodes: ['execute', 'tool_called']
  },
  {
    id: 'review',
    displayName: 'Review Subgraph',
    description: '负责刑部审查、风险判定、复盘与交付前 review。',
    owner: 'xingbu-review',
    entryNodes: ['review', 'review_completed']
  },
  {
    id: 'skill-install',
    displayName: 'Skill Install Subgraph',
    description: '负责本地或远程 skill 候选、安全评估、安装、审批与入 lab。',
    owner: 'hubu-search/gongbu-code',
    entryNodes: ['skill_resolved', 'skill_stage_started', 'skill_stage_completed']
  },
  {
    id: 'background-runner',
    displayName: 'Background Runner Subgraph',
    description: '负责后台队列、lease、heartbeat、stale reclaim 与 worker pool。',
    owner: 'runtime',
    entryNodes: ['background_queued', 'background_lease_acquired', 'background_lease_reclaimed']
  }
];

export function listSubgraphDescriptors(): SubgraphDescriptor[] {
  return SUBGRAPH_DESCRIPTORS;
}
