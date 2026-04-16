import { Badge } from '@/components/ui/badge';
import { getExecutionModeDisplayName, normalizeExecutionMode } from '@/lib/runtime-semantics';
import type { TaskBundle } from '@/types/admin';

import {
  buildRouteReason,
  formatRouteConfidence,
  renderFindingMeta,
  summarizeExecutionSteps
} from './runtime-queue-section-support';

export function RuntimeQueueSelectedRunSummary({ bundle }: { bundle: TaskBundle }) {
  const executionSummary = summarizeExecutionSteps(bundle.task);

  return (
    <>
      <div>
        <p className="text-sm font-medium text-foreground">{bundle.task.goal}</p>
        <p className="mt-1 text-xs text-muted-foreground">{bundle.task.id}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {bundle.task.resolvedWorkflow ? (
          <Badge variant="secondary">
            {bundle.task.resolvedWorkflow.id} v{bundle.task.resolvedWorkflow.version ?? '1.0.0'}
          </Badge>
        ) : null}
        {bundle.task.specialistLead ? (
          <Badge variant="secondary">主导: {bundle.task.specialistLead.displayName}</Badge>
        ) : null}
        {bundle.task.supportingSpecialists?.length ? (
          <Badge variant="outline">支撑 {bundle.task.supportingSpecialists.length}</Badge>
        ) : null}
        {formatRouteConfidence(bundle.task.routeConfidence) ? (
          <Badge variant="outline">{formatRouteConfidence(bundle.task.routeConfidence)}</Badge>
        ) : null}
        {bundle.task.critiqueResult ? (
          <Badge variant="outline">刑部 {bundle.task.critiqueResult.decision}</Badge>
        ) : null}
        {bundle.task.currentNode ? <Badge variant="secondary">{bundle.task.currentNode}</Badge> : null}
        {bundle.task.currentMinistry ? <Badge variant="secondary">{bundle.task.currentMinistry}</Badge> : null}
        {bundle.task.currentWorker ? <Badge variant="secondary">{bundle.task.currentWorker}</Badge> : null}
        {bundle.task.executionMode ? <Badge variant="outline">{bundle.task.executionMode}</Badge> : null}
        {bundle.task.queueState ? <Badge variant="outline">{bundle.task.queueState.mode}</Badge> : null}
        {bundle.task.queueState ? <Badge variant="outline">attempt {bundle.task.queueState.attempt}</Badge> : null}
        {executionSummary ? <Badge variant="secondary">{executionSummary.currentCopy}</Badge> : null}
        {bundle.task.subgraphTrail?.map(subgraph => (
          <span key={`${bundle.task.id}-${subgraph}`}>
            <Badge variant="outline">{subgraph}</Badge>
          </span>
        ))}
      </div>
      {bundle.task.queueState ? (
        <div className="grid gap-1 rounded-2xl border border-border/70 bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
          <p>Queue: {bundle.task.queueState.status}</p>
          <p>Enqueued: {new Date(bundle.task.queueState.enqueuedAt).toLocaleString()}</p>
          {bundle.task.queueState.startedAt ? (
            <p>Started: {new Date(bundle.task.queueState.startedAt).toLocaleString()}</p>
          ) : null}
          {executionSummary ? (
            <p>
              Execution Steps: blocked {executionSummary.blockedCount} / recovery {executionSummary.recoveryCount}
            </p>
          ) : null}
          {executionSummary?.lastReason ? <p>Last Reason: {executionSummary.lastReason}</p> : null}
          {bundle.task.queueState.leaseOwner ? <p>Lease Owner: {bundle.task.queueState.leaseOwner}</p> : null}
          {bundle.task.queueState.lastHeartbeatAt ? (
            <p>Last Heartbeat: {new Date(bundle.task.queueState.lastHeartbeatAt).toLocaleString()}</p>
          ) : null}
          {bundle.task.queueState.leaseExpiresAt ? (
            <p>Lease Expires: {new Date(bundle.task.queueState.leaseExpiresAt).toLocaleString()}</p>
          ) : null}
          {bundle.task.queueState.finishedAt ? (
            <p>Finished: {new Date(bundle.task.queueState.finishedAt).toLocaleString()}</p>
          ) : null}
        </div>
      ) : null}
      {bundle.task.budgetState ? (
        <div className="grid gap-2 rounded-2xl border border-border/70 bg-muted/30 px-3 py-3">
          <p className="text-sm font-semibold text-foreground">Budget</p>
          <div className="grid gap-1 text-xs text-muted-foreground">
            <p>
              Step: {bundle.task.budgetState.stepsConsumed}/{bundle.task.budgetState.stepBudget}
            </p>
            <p>
              Retry: {bundle.task.budgetState.retriesConsumed}/{bundle.task.budgetState.retryBudget}
            </p>
            <p>
              Source: {bundle.task.budgetState.sourcesConsumed}/{bundle.task.budgetState.sourceBudget}
            </p>
          </div>
        </div>
      ) : null}
      {bundle.task.specialistLead ? (
        <div className="grid gap-2 rounded-2xl border border-border/70 bg-muted/30 px-3 py-3">
          <p className="text-sm font-semibold text-foreground">Specialist Routing</p>
          <div className="grid gap-1 text-xs text-muted-foreground">
            <p>Lead: {bundle.task.specialistLead.displayName}</p>
            <p>Domain: {bundle.task.specialistLead.domain}</p>
            {bundle.task.specialistLead.reason ? <p>Reason: {bundle.task.specialistLead.reason}</p> : null}
            {bundle.task.supportingSpecialists?.length ? (
              <p>Supports: {bundle.task.supportingSpecialists.map(item => item.displayName).join(' / ')}</p>
            ) : null}
            {formatRouteConfidence(bundle.task.routeConfidence) ? (
              <p>{formatRouteConfidence(bundle.task.routeConfidence)}</p>
            ) : null}
            {buildRouteReason(bundle.task) ? <p>Reason: {buildRouteReason(bundle.task)}</p> : null}
          </div>
        </div>
      ) : null}
      {bundle.task.planDraft ? (
        <div className="grid gap-2 rounded-2xl border border-border/70 bg-muted/30 px-3 py-3">
          <p className="text-sm font-semibold text-foreground">Planning Decisions</p>
          <div className="grid gap-1 text-xs text-muted-foreground">
            {bundle.task.planMode ? <p>Mode: {bundle.task.planMode}</p> : null}
            {bundle.task.executionMode ? (
              <p>
                Execution Mode: {getExecutionModeDisplayName(bundle.task.executionMode) ?? bundle.task.executionMode}
              </p>
            ) : null}
            {bundle.task.planDraft.questionSet?.title ? (
              <p>Question Set: {bundle.task.planDraft.questionSet.title}</p>
            ) : null}
            <p>{bundle.task.planDraft.summary}</p>
            {normalizeExecutionMode(bundle.task.executionMode) === 'plan' ? (
              <p>
                Guardrails: plan mode disables open-web / browser / terminal / write tools until planning is finalized.
              </p>
            ) : null}
            {bundle.task.planDraft.autoResolved?.length ? (
              <p>Auto Resolved: {bundle.task.planDraft.autoResolved.join(' / ')}</p>
            ) : null}
            {bundle.task.planDraft.openQuestions?.length ? (
              <p>Open Questions: {bundle.task.planDraft.openQuestions.join(' / ')}</p>
            ) : null}
            {bundle.task.planDraft.assumptions?.length ? (
              <p>Assumptions: {bundle.task.planDraft.assumptions.join(' / ')}</p>
            ) : null}
            {bundle.task.planDraft.microBudget ? (
              <p>
                Micro Budget: readonly {bundle.task.planDraft.microBudget.readOnlyToolsUsed}/
                {bundle.task.planDraft.microBudget.readOnlyToolLimit} · $
                {(bundle.task.planDraft.microBudget.tokenBudgetUsd ?? 0).toFixed(2)} · triggered{' '}
                {bundle.task.planDraft.microBudget.budgetTriggered ? 'yes' : 'no'}
              </p>
            ) : null}
            {bundle.task.planModeTransitions?.length ? (
              <div className="grid gap-1">
                <p>Transitions:</p>
                {bundle.task.planModeTransitions.map(transition => (
                  <p key={`${transition.at}-${transition.to}`}>
                    {transition.from ?? 'init'} {'->'} {transition.to} / {transition.reason}
                  </p>
                ))}
              </div>
            ) : null}
            {bundle.task.planDraft.decisions?.length ? (
              <div className="grid gap-1">
                {bundle.task.planDraft.decisions.map(decision => (
                  <p key={`${decision.questionId}-${decision.answeredAt}`}>
                    {decision.questionId}:{' '}
                    {decision.freeform ??
                      decision.selectedOptionId ??
                      decision.assumedValue ??
                      decision.resolutionSource}
                    {decision.whyAsked ? ` / why ${decision.whyAsked}` : ''}
                    {decision.impactOnPlan ? ` / impact ${decision.impactOnPlan}` : ''}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {bundle.task.critiqueResult ? (
        <div className="grid gap-2 rounded-2xl border border-border/70 bg-muted/30 px-3 py-3">
          <p className="text-sm font-semibold text-foreground">Critique</p>
          <div className="grid gap-1 text-xs text-muted-foreground">
            <p>Decision: {bundle.task.critiqueResult.decision}</p>
            <p>{bundle.task.critiqueResult.summary}</p>
            {bundle.task.critiqueResult.shouldBlockEarly ? <p>Early block suggested: true</p> : null}
            {bundle.task.critiqueResult.blockingIssues?.length ? (
              <p>Blocking: {bundle.task.critiqueResult.blockingIssues.join(' / ')}</p>
            ) : null}
            {bundle.task.critiqueResult.constraints?.length ? (
              <p>Constraints: {bundle.task.critiqueResult.constraints.join(' / ')}</p>
            ) : null}
            <p>
              Revision: {bundle.task.revisionCount ?? 0}/{bundle.task.maxRevisions ?? 0}
            </p>
          </div>
        </div>
      ) : null}
      {bundle.task.specialistFindings?.length ? (
        <div className="grid gap-2">
          <p className="text-sm font-semibold text-foreground">Specialist Findings</p>
          {bundle.task.specialistFindings.map((finding, index) => (
            <article
              key={`${finding.specialistId}-${finding.role}-${index}`}
              className="rounded-2xl border border-border/70 bg-muted/30 px-3 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <strong className="text-sm text-foreground">{finding.domain}</strong>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{finding.contractVersion}</Badge>
                  <Badge variant="outline">{finding.stage}</Badge>
                  <Badge variant="outline">{finding.source}</Badge>
                  <Badge variant="outline">{finding.role}</Badge>
                  <Badge variant="outline">{finding.specialistId}</Badge>
                  {finding.riskLevel ? <Badge variant="outline">{finding.riskLevel}</Badge> : null}
                  {typeof finding.confidence === 'number' ? (
                    <Badge variant="outline">{Math.round(finding.confidence * 100)}%</Badge>
                  ) : null}
                </div>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{finding.summary}</p>
              {[
                renderFindingMeta('阻断项', finding.blockingIssues),
                renderFindingMeta('约束', finding.constraints),
                renderFindingMeta('建议', finding.suggestions)
              ]
                .filter(Boolean)
                .map(copy => (
                  <p key={copy} className="mt-2 text-xs leading-5 text-muted-foreground">
                    {copy}
                  </p>
                ))}
            </article>
          ))}
        </div>
      ) : null}
    </>
  );
}
