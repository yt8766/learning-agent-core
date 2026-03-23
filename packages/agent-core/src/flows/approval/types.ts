import { ActionIntent } from '@agent/shared';

export interface PendingExecutionContext {
  taskId: string;
  intent: ActionIntent;
  toolName: string;
  researchSummary: string;
}
