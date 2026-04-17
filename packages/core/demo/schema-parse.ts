import {
  ApprovalRecordSchema,
  ChatSessionRecordSchema,
  SkillCardSchema,
  WorkflowPresetDefinitionSchema
} from '../src/index.js';

const session = ChatSessionRecordSchema.parse({
  id: 'session-1',
  title: 'Core demo session',
  status: 'idle',
  createdAt: '2026-04-16T00:00:00.000Z',
  updatedAt: '2026-04-16T00:00:00.000Z'
});

const skill = SkillCardSchema.parse({
  id: 'skill-1',
  name: 'Repo Auditor',
  description: 'Summarize repo structure and risks.',
  applicableGoals: ['audit repo'],
  requiredTools: ['filesystem.read'],
  steps: [{ title: 'Inspect', instruction: 'Read repo files', toolNames: ['filesystem.read'] }],
  constraints: ['read only'],
  successSignals: ['clear summary'],
  riskLevel: 'low',
  source: 'research',
  status: 'stable',
  createdAt: '2026-04-16T00:00:00.000Z',
  updatedAt: '2026-04-16T00:00:00.000Z'
});

const workflow = WorkflowPresetDefinitionSchema.parse({
  id: 'workflow-1',
  displayName: 'Audit Workflow',
  intentPatterns: ['audit repo'],
  requiredMinistries: ['gongbu-code'],
  allowedCapabilities: ['filesystem.read'],
  approvalPolicy: 'high-risk-only',
  outputContract: {
    type: 'markdown',
    requiredSections: ['summary']
  }
});

const approval = ApprovalRecordSchema.parse({
  taskId: 'task-1',
  intent: 'write_file',
  decision: 'pending',
  decidedAt: '2026-04-16T00:00:00.000Z'
});

console.log('schema parse session:', session.id);
console.log('schema parse skill:', skill.name);
console.log('schema parse workflow:', workflow.displayName);
console.log('schema parse approval:', approval.decision);
