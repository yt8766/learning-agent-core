import type { ActionIntent } from '../../primitives/types/primitives.types';
import type { CurrentSkillExecutionRecord } from '../../tasking/types/orchestration';

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
