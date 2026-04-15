import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DashboardEmptyState } from '@/components/dashboard-center-shell';
import { getExecutionModeDisplayName, getMinistryDisplayName } from '@/lib/runtime-semantics';

import type { RuntimeSummarySectionProps } from './runtime-summary-types';
import { getChainNodeLabel } from './runtime-summary-visuals-helpers';

// runtime.interruptLedger carries persisted 司礼监 / InterruptController projections for admin observability.
export function RuntimeSummaryVisuals({
  runtime,
  onSelectTask
}: Pick<RuntimeSummarySectionProps, 'runtime' | 'onSelectTask'>) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Imperial Chain</CardTitle>
          <Badge variant="outline">{runtime.imperialChain?.length ?? 0}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          {!runtime.imperialChain?.length ? (
            <DashboardEmptyState message="当前还没有首辅七节点链路样本。" />
          ) : (
            runtime.imperialChain.slice(0, 4).map(item => (
              <article key={item.taskId} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.goal}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {getChainNodeLabel(item.node)} /{' '}
                      {getExecutionModeDisplayName(item.modeGateState?.activeMode) ?? '模式待定'}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => void onSelectTask(item.taskId)}>
                    查看任务
                  </Button>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                  <p>{item.modeGateState?.reason ?? '模式门尚未登记原因。'}</p>
                  {item.budgetGateState ? (
                    <p>
                      预算门: {item.budgetGateState.status} / {item.budgetGateState.summary}
                      {typeof item.budgetGateState.queueDepth === 'number'
                        ? ` / queue ${item.budgetGateState.queueDepth}`
                        : ''}
                    </p>
                  ) : null}
                  {item.complexTaskPlan ? (
                    <p>
                      军机处: {item.complexTaskPlan.summary} / subGoals {item.complexTaskPlan.subGoals.length}
                    </p>
                  ) : null}
                  {item.blackboardState ? (
                    <p>
                      尚方宝剑: traces {item.blackboardState.refs.traceCount} / evidence{' '}
                      {item.blackboardState.refs.evidenceCount}
                    </p>
                  ) : null}
                  {item.dispatches?.length ? (
                    <p>
                      票拟分发: {Array.from(new Set(item.dispatches.map(dispatch => dispatch.kind))).join(' / ')} / 共{' '}
                      {item.dispatches.length} 条
                    </p>
                  ) : null}
                  {item.contextFilterState?.filteredContextSlice ? (
                    <p>
                      文书科摘要: {item.contextFilterState.filteredContextSlice.summary} / traces{' '}
                      {item.contextFilterState.filteredContextSlice.historyTraceCount}
                    </p>
                  ) : null}
                  {item.contextFilterState?.audienceSlices ? (
                    <p>
                      受众切片: 策略 {item.contextFilterState.audienceSlices.strategy.dispatchCount} / 六部{' '}
                      {item.contextFilterState.audienceSlices.ministry.dispatchCount} / 兜底{' '}
                      {item.contextFilterState.audienceSlices.fallback.dispatchCount}
                    </p>
                  ) : null}
                  {item.finalReviewState ? (
                    <p>
                      终审: {item.finalReviewState.summary}
                      {item.finalReviewState.deliveryStatus
                        ? ` / 交付 ${item.finalReviewState.deliveryStatus}${item.finalReviewState.deliveryMinistry ? ` via ${getMinistryDisplayName(item.finalReviewState.deliveryMinistry) ?? item.finalReviewState.deliveryMinistry}` : ''}`
                        : ''}
                    </p>
                  ) : null}
                  {item.criticState ? (
                    <p>
                      批判层: {item.criticState.decision} / {item.criticState.summary}
                    </p>
                  ) : null}
                  {item.guardrailState ? (
                    <p>
                      护栏: {item.guardrailState.stage} / {item.guardrailState.verdict} / {item.guardrailState.summary}
                    </p>
                  ) : null}
                  {item.sandboxState ? (
                    <p>
                      演武场: {item.sandboxState.stage} / {item.sandboxState.status} / {item.sandboxState.attempt}/
                      {item.sandboxState.maxAttempts}
                    </p>
                  ) : null}
                  {item.knowledgeIndexState ? (
                    <p>
                      藏经阁索引: {item.knowledgeIndexState.indexStatus} / searchable{' '}
                      {item.knowledgeIndexState.searchableDocumentCount ?? 0} / blocked{' '}
                      {item.knowledgeIndexState.blockedDocumentCount ?? 0}
                    </p>
                  ) : null}
                  {item.governanceScore ? (
                    <p>
                      吏部评分: {item.governanceScore.score} / {item.governanceScore.status} /{' '}
                      {item.governanceScore.trustAdjustment}
                    </p>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Execution & Interrupt Ledger</CardTitle>
          <Badge variant="outline">{runtime.executionSpans?.length ?? 0}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          {!runtime.executionSpans?.length ? (
            <DashboardEmptyState message="当前还没有六部执行 span。" />
          ) : (
            runtime.executionSpans.slice(0, 4).map(item => {
              const interrupt = runtime.interruptLedger?.find(ledger => ledger.taskId === item.taskId);
              return (
                <article key={item.taskId} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.taskId}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {(item.ministries ?? [])
                          .map(ministry => getMinistryDisplayName(ministry) ?? ministry)
                          .join(' / ') || '未装载执行部'}
                      </p>
                    </div>
                    <Badge variant={item.microLoopCount >= item.maxMicroLoops ? 'warning' : 'secondary'}>
                      微循环 {item.microLoopCount}/{item.maxMicroLoops}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                    <p>
                      当前执行部: {getMinistryDisplayName(item.currentMinistry) ?? item.currentMinistry ?? '待分派'}
                    </p>
                    <p>分发类型: {item.dispatchKinds?.join(' / ') || 'ministry'}</p>
                    {item.sandboxState ? (
                      <p>
                        演武场: {item.sandboxState.stage} / {item.sandboxState.status} / verdict{' '}
                        {item.sandboxState.verdict ?? 'n/a'}
                      </p>
                    ) : null}
                    {item.microLoopState ? (
                      <p>
                        微循环状态: {item.microLoopState.state} / {item.microLoopState.attempt} /{' '}
                        {item.microLoopState.maxAttempts}
                        {item.microLoopState.exhaustedReason ? ` / ${item.microLoopState.exhaustedReason}` : ''}
                      </p>
                    ) : null}
                    <p>
                      司礼监账本: {interrupt?.activeInterrupt ? '有待恢复中断' : '当前无阻断'} / history{' '}
                      {interrupt?.interruptHistory.length ?? 0}
                      {item.taskId &&
                      runtime.imperialChain?.find(chain => chain.taskId === item.taskId)?.finalReviewState
                        ?.interruptRequired
                        ? ' / 来源 刑部终审'
                        : ''}
                    </p>
                  </div>
                </article>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Visual ThoughtChain</CardTitle>
          <Badge variant="outline">{runtime.thoughtGraphs?.length ?? 0}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          {!runtime.thoughtGraphs?.length ? (
            <DashboardEmptyState message="当前还没有可视化 ThoughtGraph。" />
          ) : (
            runtime.thoughtGraphs.slice(0, 3).map(item => (
              <article key={item.taskId} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.goal}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.currentMinistry ?? 'unknown'} / {item.currentNode ?? '-'}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => void onSelectTask(item.taskId)}>
                    查看任务
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.graph.nodes.map(node => (
                    <span key={node.id} className="inline-flex items-center gap-2">
                      <Badge
                        variant={
                          node.status === 'failed'
                            ? 'destructive'
                            : node.status === 'blocked'
                              ? 'warning'
                              : node.status === 'running'
                                ? 'success'
                                : 'outline'
                        }
                      >
                        {node.kind}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{node.label}</span>
                    </span>
                  ))}
                </div>
              </article>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Model Heatmap</CardTitle>
          <Badge variant="outline">{runtime.modelHeatmap?.length ?? 0}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          {!runtime.modelHeatmap?.length ? (
            <DashboardEmptyState message="当前还没有模型效能热力图数据。" />
          ) : (
            runtime.modelHeatmap.map(row => (
              <article key={row.ministry} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {getMinistryDisplayName(row.ministry) ?? row.ministry}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{row.model}</p>
                  </div>
                  <Badge variant="secondary">
                    {row.successRate == null ? 'N/A' : `${Math.round(row.successRate * 100)}% success`}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                  <p>avgLatency: {row.avgLatencyMs == null ? 'N/A' : `${row.avgLatencyMs} ms`}</p>
                  <p>avgCost: {row.avgCostUsd == null ? 'N/A' : `$${row.avgCostUsd.toFixed(4)}`}</p>
                  <p>retryRate: {row.retryRate == null ? 'N/A' : `${Math.round(row.retryRate * 100)}%`}</p>
                </div>
              </article>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Strategy & Learning</CardTitle>
          <Badge variant="outline">{runtime.strategyCounselors?.length ?? 0}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          {!runtime.strategyCounselors?.length ? (
            <DashboardEmptyState message="当前还没有群辅票拟与学习联动样本。" />
          ) : (
            runtime.strategyCounselors.slice(0, 3).map(item => (
              <article key={item.taskId} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
                <p className="text-sm font-semibold text-foreground">{item.goal}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  群辅: {item.counselors.map(counselor => counselor.displayName).join(' / ') || '通才阁臣兜底'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  吏部评分:{' '}
                  {runtime.libuScorecards?.find(scorecard => scorecard.taskId === item.taskId)?.summary ??
                    '暂无评分摘要'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  治理信号:{' '}
                  {runtime.governanceScorecards?.find(scorecard => scorecard.taskId === item.taskId)?.summary ??
                    '暂无治理评分'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Shilu:{' '}
                  {(
                    runtime.shiluAdjustments?.find(adjustment => adjustment.taskId === item.taskId)
                      ?.recommendedCandidateIds ?? []
                  ).join(' / ') || '暂无调整建议'}
                </p>
              </article>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Wenyuan & Cangjing</CardTitle>
          <Badge variant="outline">{runtime.knowledgeOverview?.stores.length ?? 0}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          {!runtime.knowledgeOverview ? (
            <DashboardEmptyState message="当前还没有知识库总览。" />
          ) : (
            <>
              <article className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4 text-xs text-muted-foreground">
                <p>sources {runtime.knowledgeOverview.sourceCount}</p>
                <p>chunks {runtime.knowledgeOverview.chunkCount}</p>
                <p>embeddings {runtime.knowledgeOverview.embeddingCount}</p>
                <p>
                  searchable {runtime.knowledgeOverview.searchableDocumentCount} / blocked{' '}
                  {runtime.knowledgeOverview.blockedDocumentCount}
                </p>
              </article>
              {runtime.knowledgeOverview.stores.map(store => (
                <article key={store.id} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
                  <p className="text-sm font-semibold text-foreground">{store.displayName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{store.summary}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {store.store} / {store.status}
                  </p>
                </article>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
