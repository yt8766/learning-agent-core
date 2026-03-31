import { useEffect, useMemo, useState } from 'react';

import { getChannelDeliveries } from '@/api/admin-api';
import { RuntimeSummaryAgentErrors } from './runtime-summary-agent-errors';
import { RuntimeSummaryBudget } from './runtime-summary-budget';
import { RuntimeSummaryChannelDeliveries } from './runtime-summary-channel-deliveries';
import { RuntimeSummaryGovernance } from './runtime-summary-governance';
import { RuntimeSummaryOverview } from './runtime-summary-overview';
import { RuntimeSummaryTools } from './runtime-summary-tools';
import type { RuntimeSummarySectionProps } from './runtime-summary-types';
import { RuntimeSummaryVisuals } from './runtime-summary-visuals';

export function RuntimeSummarySection({
  runtime,
  executionModeFilter,
  onExecutionModeFilterChange,
  interactionKindFilter,
  onInteractionKindFilterChange,
  onCopyShareLink,
  onSelectTask,
  onRetryTask,
  onRefreshRuntime,
  onCreateDiagnosisTask
}: RuntimeSummarySectionProps) {
  const [errorCodeFilter, setErrorCodeFilter] = useState('');
  const [ministryFilter, setMinistryFilter] = useState('');
  const [retryableFilter, setRetryableFilter] = useState('');
  const [channelDeliveries, setChannelDeliveries] = useState<Awaited<ReturnType<typeof getChannelDeliveries>>>([]);
  const errorCodeOptions = useMemo(
    () => Array.from(new Set((runtime.recentAgentErrors ?? []).map(item => item.errorCode))).filter(Boolean),
    [runtime.recentAgentErrors]
  );
  const ministryOptions = useMemo(
    () => Array.from(new Set((runtime.recentAgentErrors ?? []).map(item => item.ministry).filter(Boolean))) as string[],
    [runtime.recentAgentErrors]
  );
  const filteredAgentErrors = useMemo(
    () =>
      (runtime.recentAgentErrors ?? []).filter(item => {
        if (errorCodeFilter && item.errorCode !== errorCodeFilter) {
          return false;
        }
        if (ministryFilter && item.ministry !== ministryFilter) {
          return false;
        }
        if (retryableFilter === 'retryable' && !item.retryable) {
          return false;
        }
        if (retryableFilter === 'fatal' && item.retryable) {
          return false;
        }
        return true;
      }),
    [runtime.recentAgentErrors, errorCodeFilter, ministryFilter, retryableFilter]
  );

  useEffect(() => {
    void getChannelDeliveries()
      .then(setChannelDeliveries)
      .catch(() => setChannelDeliveries([]));
  }, [runtime.taskCount, runtime.activeTaskCount, runtime.pendingApprovalCount]);

  return (
    <>
      <RuntimeSummaryOverview runtime={runtime} />
      <RuntimeSummaryBudget runtime={runtime} />
      <RuntimeSummaryGovernance runtime={runtime} />
      <RuntimeSummaryTools
        runtime={runtime}
        executionModeFilter={executionModeFilter}
        onExecutionModeFilterChange={onExecutionModeFilterChange}
        interactionKindFilter={interactionKindFilter}
        onInteractionKindFilterChange={onInteractionKindFilterChange}
        onCopyShareLink={onCopyShareLink}
      />
      <RuntimeSummaryAgentErrors
        runtime={runtime}
        onSelectTask={onSelectTask}
        onRetryTask={onRetryTask}
        onRefreshRuntime={onRefreshRuntime}
        onCreateDiagnosisTask={onCreateDiagnosisTask}
        errorCodeFilter={errorCodeFilter}
        ministryFilter={ministryFilter}
        retryableFilter={retryableFilter}
        errorCodeOptions={errorCodeOptions}
        ministryOptions={ministryOptions}
        filteredAgentErrors={filteredAgentErrors}
        onErrorCodeFilterChange={setErrorCodeFilter}
        onMinistryFilterChange={setMinistryFilter}
        onRetryableFilterChange={setRetryableFilter}
      />
      <RuntimeSummaryVisuals runtime={runtime} onSelectTask={onSelectTask} />
      <RuntimeSummaryChannelDeliveries channelDeliveries={channelDeliveries} />
    </>
  );
}
