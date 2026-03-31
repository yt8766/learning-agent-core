import type { RuntimeCenterRecord, TaskBundle } from '@/types/admin';

export interface RuntimeOverviewPanelProps {
  runtime: RuntimeCenterRecord;
  bundle: TaskBundle | null;
  historyDays: number;
  onHistoryDaysChange: (days: number) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  modelFilter: string;
  onModelFilterChange: (value: string) => void;
  pricingSourceFilter: string;
  onPricingSourceFilterChange: (value: string) => void;
  executionModeFilter: 'all' | 'plan' | 'execute' | 'imperial_direct';
  onExecutionModeFilterChange: (value: 'all' | 'plan' | 'execute' | 'imperial_direct') => void;
  interactionKindFilter:
    | 'all'
    | 'approval'
    | 'plan-question'
    | 'supplemental-input'
    | 'revise-required'
    | 'micro-loop-exhausted'
    | 'mode-transition';
  onInteractionKindFilterChange: (
    value:
      | 'all'
      | 'approval'
      | 'plan-question'
      | 'supplemental-input'
      | 'revise-required'
      | 'micro-loop-exhausted'
      | 'mode-transition'
  ) => void;
  onCopyShareLink: () => void;
  onExport: () => void;
  onSelectTask: (taskId: string) => void | Promise<void>;
  onRetryTask: (taskId: string) => void | Promise<void>;
  onRefreshRuntime: () => void | Promise<void>;
  onCreateDiagnosisTask: (params: {
    taskId: string;
    goal: string;
    errorCode: string;
    ministry?: string;
    message: string;
    diagnosisHint?: string;
    recommendedAction?: string;
    stack?: string;
    recoveryPlaybook?: string[];
  }) => void | Promise<void>;
}
