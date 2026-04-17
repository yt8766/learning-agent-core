import type { ActionIntent } from '../types/primitives';
import type { CurrentSkillExecutionRecord } from '../types/tasking-orchestration';

export interface PendingExecutionContext {
  taskId: string;
  intent: ActionIntent;
  toolName: string;
  researchSummary: string;
  toolInput?: Record<string, unknown>;
  kind?: 'tool_execution' | 'skill_install';
  receiptId?: string;
  goal?: string;
  usedInstalledSkills?: string[];
  skillDisplayName?: string;
  currentSkillExecution?: CurrentSkillExecutionRecord;
}
