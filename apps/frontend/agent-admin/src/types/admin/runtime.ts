import type { RuntimeCenterRecord as SharedRuntimeCenterRecord } from '@agent/shared';

import type { TaskRecord } from './shared';

export type RuntimeCenterRecord = Omit<SharedRuntimeCenterRecord, 'recentRuns'> & {
  recentRuns: TaskRecord[];
};
