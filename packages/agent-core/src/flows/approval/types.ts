import { ActionIntent, type CurrentSkillExecutionRecord } from '@agent/shared';

export interface PendingExecutionContext {
  taskId: string;
  intent: ActionIntent;
  toolName: string;
  researchSummary: string;
  kind?: 'tool_execution' | 'skill_install';
  receiptId?: string;
  goal?: string;
  usedInstalledSkills?: string[];
  skillDisplayName?: string;
  currentSkillExecution?: CurrentSkillExecutionRecord;
}
