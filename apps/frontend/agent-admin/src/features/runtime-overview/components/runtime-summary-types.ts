import type { RuntimeOverviewPanelProps } from './runtime-overview-types';

export type RuntimeSummarySectionProps = Pick<
  RuntimeOverviewPanelProps,
  | 'runtime'
  | 'executionModeFilter'
  | 'onExecutionModeFilterChange'
  | 'interactionKindFilter'
  | 'onInteractionKindFilterChange'
  | 'onCopyShareLink'
  | 'onSelectTask'
  | 'onRetryTask'
  | 'onRefreshRuntime'
  | 'onCreateDiagnosisTask'
  | 'onRevokeApprovalPolicy'
>;
