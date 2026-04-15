import type { BootstrapSkillRecord } from '@agent/shared';

export const BOOTSTRAP_SKILLS: BootstrapSkillRecord[] = [
  {
    id: 'task-intake',
    displayName: 'Task Intake',
    description: '识别用户意图、执行模式和显式能力请求。',
    bootstrap: true,
    ownerType: 'shared',
    activationPhase: 'session_start',
    responsibilities: ['intent-routing', 'requested-hints']
  },
  {
    id: 'capability-gap-detector',
    displayName: 'Capability Gap Detector',
    description: '判断当前缺的是 specialist、skill 还是 connector。',
    bootstrap: true,
    ownerType: 'shared',
    activationPhase: 'task_create',
    responsibilities: ['gap-detection', 'capability-judgement']
  },
  {
    id: 'augmentation-orchestrator',
    displayName: 'Augmentation Orchestrator',
    description: '统一编排 skill 搜索、MCP 建议、安装、审批与恢复。',
    bootstrap: true,
    ownerType: 'shared',
    activationPhase: 'pre_execution',
    responsibilities: ['skill-search', 'connector-suggestion', 'approval-resume']
  },
  {
    id: 'approval-safety',
    displayName: 'Approval Safety',
    description: '统一处理高风险动作、审批门和拒绝反馈。',
    bootstrap: true,
    ownerType: 'shared',
    activationPhase: 'pre_execution',
    responsibilities: ['approval-policy', 'risk-gating']
  },
  {
    id: 'evidence-and-citation',
    displayName: 'Evidence And Citation',
    description: '聚合来源、证据和引用展示。',
    bootstrap: true,
    ownerType: 'shared',
    activationPhase: 'pre_execution',
    responsibilities: ['sources', 'evidence', 'citation']
  },
  {
    id: 'learning-reuse',
    displayName: 'Learning Reuse',
    description: '管理 reused memory/rule/skill 与学习沉淀线索。',
    bootstrap: true,
    ownerType: 'shared',
    activationPhase: 'pre_execution',
    responsibilities: ['reuse', 'learning', 'promotion-signals']
  }
];

export function listBootstrapSkills() {
  return BOOTSTRAP_SKILLS.slice();
}
