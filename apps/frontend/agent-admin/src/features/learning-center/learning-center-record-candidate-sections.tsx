import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardEmptyState } from '@/components/dashboard-center-shell';

import type { LearningCenterRecord } from '@/types/admin';

export function LearningCandidatesCard(props: { candidates: LearningCenterRecord['candidates'] }) {
  const { candidates } = props;
  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-foreground">Learning Candidates</CardTitle>
        <Badge variant="outline">{candidates.length}</Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
        {candidates.length === 0 ? (
          <DashboardEmptyState message="当前没有学习候选。" />
        ) : (
          candidates.map(candidate => (
            <article key={candidate.id} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{candidate.summary}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{candidate.taskGoal}</p>
                </div>
                <Badge variant={candidate.status === 'confirmed' ? 'success' : 'warning'}>{candidate.status}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{candidate.type}</Badge>
                {candidate.currentMinistry ? <Badge variant="secondary">{candidate.currentMinistry}</Badge> : null}
                {candidate.currentWorker ? <Badge variant="secondary">{candidate.currentWorker}</Badge> : null}
                {candidate.evaluationConfidence ? (
                  <Badge variant="secondary">{candidate.evaluationConfidence}</Badge>
                ) : null}
                {typeof candidate.confidenceScore === 'number' ? (
                  <Badge variant="secondary">score {Math.round(candidate.confidenceScore)}</Badge>
                ) : null}
                {candidate.provenanceCount ? (
                  <Badge variant="secondary">sources {candidate.provenanceCount}</Badge>
                ) : null}
                {candidate.autoConfirmEligible ? <Badge variant="success">auto-confirm</Badge> : null}
                {(candidate.expertiseSignals ?? []).map(signal => (
                  <span key={`${candidate.id}-${signal}`}>
                    <Badge variant="outline">{signal}</Badge>
                  </span>
                ))}
                {candidate.policyMode ? <Badge variant="outline">{candidate.policyMode}</Badge> : null}
              </div>
              {candidate.candidateReasons?.length ? (
                <p className="mt-3 text-xs text-emerald-700">{candidate.candidateReasons.join('；')}</p>
              ) : null}
              {candidate.skippedReasons?.length ? (
                <p className="mt-2 text-xs text-amber-700">{candidate.skippedReasons.join('；')}</p>
              ) : null}
              {candidate.conflictDetected ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="destructive">conflict</Badge>
                  {(candidate.conflictTargets ?? []).map(target => (
                    <span key={`${candidate.id}-${target}`}>
                      <Badge variant="outline">{target}</Badge>
                    </span>
                  ))}
                  {(candidate.derivedFromLayers ?? []).map(layer => (
                    <span key={`${candidate.id}-${layer}`}>
                      <Badge variant="secondary">{layer}</Badge>
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="mt-3 text-xs text-muted-foreground">{candidate.createdAt}</p>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function RecentResearchJobsCard(props: {
  jobs: LearningCenterRecord['recentJobs'];
  loading: boolean;
  onInvalidateMemory: (memoryId: string) => void;
  onSupersedeMemory: (memoryId: string) => void;
  onRestoreMemory: (memoryId: string) => void;
  onRetireMemory: (memoryId: string) => void;
}) {
  const { jobs, loading, onInvalidateMemory, onSupersedeMemory, onRestoreMemory, onRetireMemory } = props;
  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-foreground">Recent Research Jobs</CardTitle>
        <Badge variant="outline">{jobs?.length ?? 0}</Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!jobs?.length ? (
          <DashboardEmptyState message="当前还没有主动研究任务。" />
        ) : (
          jobs.map(job => (
            <article key={job.id} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{job.summary ?? job.goal ?? job.documentUri}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{job.goal ?? job.documentUri}</p>
                </div>
                <Badge variant={job.status === 'completed' ? 'success' : 'warning'}>{job.status}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{job.sourceType}</Badge>
                {job.workflowId ? <Badge variant="secondary">{job.workflowId}</Badge> : null}
                {job.sourceCount ? <Badge variant="secondary">sources {job.sourceCount}</Badge> : null}
                {typeof job.evaluationScore === 'number' ? (
                  <Badge variant="secondary">score {Math.round(job.evaluationScore)}</Badge>
                ) : null}
                {job.evaluationConfidence ? <Badge variant="secondary">{job.evaluationConfidence}</Badge> : null}
                {job.autoPersistEligible ? <Badge variant="success">auto-persisted</Badge> : null}
                {job.conflictDetected ? <Badge variant="destructive">conflict</Badge> : null}
                {(job.expertiseSignals ?? []).map(signal => (
                  <span key={`${job.id}-${signal}`}>
                    <Badge variant="outline">{signal}</Badge>
                  </span>
                ))}
                {Object.entries(job.trustSummary ?? {}).map(([trustClass, count]) => (
                  <span key={`${job.id}-${trustClass}`}>
                    <Badge variant="secondary">
                      {trustClass} {count}
                    </Badge>
                  </span>
                ))}
              </div>
              {job.persistedMemoryIds?.length ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <p className="text-xs text-emerald-600">已自动沉淀 memory：</p>
                  {job.persistedMemoryIds.map(memoryId => (
                    <span key={`${job.id}-${memoryId}`} className="inline-flex items-center gap-2">
                      <Badge variant="outline">{memoryId}</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={() => onInvalidateMemory(memoryId)}
                      >
                        失效
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={() => onSupersedeMemory(memoryId)}
                      >
                        替代
                      </Button>
                      <Button size="sm" variant="outline" disabled={loading} onClick={() => onRestoreMemory(memoryId)}>
                        恢复
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={loading}
                        onClick={() => onRetireMemory(memoryId)}
                      >
                        归档
                      </Button>
                    </span>
                  ))}
                </div>
              ) : null}
              {job.candidateReasons?.length ? (
                <p className="mt-3 text-xs text-emerald-700">{job.candidateReasons.join('；')}</p>
              ) : null}
              {job.skippedReasons?.length ? (
                <p className="mt-2 text-xs text-amber-700">{job.skippedReasons.join('；')}</p>
              ) : null}
              {job.conflictNotes?.length ? (
                <p className="mt-3 text-xs text-red-600">{job.conflictNotes.join('；')}</p>
              ) : null}
              <p className="mt-3 text-xs text-muted-foreground">{job.updatedAt}</p>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}
