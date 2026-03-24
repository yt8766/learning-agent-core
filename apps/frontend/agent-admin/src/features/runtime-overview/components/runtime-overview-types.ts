import type { RuntimeCenterRecord, TaskBundle } from '../../../types/admin';

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
  onExport: () => void;
}
