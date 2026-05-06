import { lazy } from 'react';

import { LazyCenterBoundary } from '@/components/lazy-center-boundary';

import type { RuntimeAnalyticsChartsProps } from './runtime-analytics-charts';

// Intentional chart split point for the Recharts-heavy runtime analytics bundle.
const LazyRuntimeAnalyticsChartsContent = lazy(() =>
  import('./runtime-analytics-charts').then(module => ({
    default: module.RuntimeAnalyticsCharts
  }))
);

export function LazyRuntimeAnalyticsCharts(props: RuntimeAnalyticsChartsProps) {
  return (
    <LazyCenterBoundary label="Runtime 图表">
      <LazyRuntimeAnalyticsChartsContent {...props} />
    </LazyCenterBoundary>
  );
}
