import { ExecutionPlanRecordSchema, PlanDraftRecordSchema, PlanQuestionRecordSchema } from '../src/index.js';

const question = PlanQuestionRecordSchema.parse({
  id: 'q-1',
  question: 'Should we execute directly or plan first?',
  questionType: 'tradeoff',
  options: [
    { id: 'plan', label: 'Plan First', description: 'Clarify the execution path before acting.' },
    { id: 'execute', label: 'Execute First', description: 'Move quickly when risk is low.' }
  ],
  recommendedOptionId: 'plan'
});

const plan = ExecutionPlanRecordSchema.parse({
  mode: 'plan',
  modeCapabilities: ['filesystem.read'],
  dispatchChain: ['entry_router', 'mode_gate', 'dispatch_planner']
});

const draft = PlanDraftRecordSchema.parse({
  summary: 'Plan task before writing code.',
  autoResolved: ['Use read-only inspection first'],
  openQuestions: ['Should we edit files in this turn?'],
  assumptions: ['Filesystem access is available'],
  questions: [question]
});

console.log('planning question:', question.questionType);
console.log('planning mode:', plan.mode);
console.log('planning draft questions:', draft.questions?.length ?? 0);
