import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { LearningCenterRecord } from '../../types/admin';

interface LearningCenterPanelProps {
  learning: LearningCenterRecord;
  loading: boolean;
  onInvalidateMemory: (memoryId: string) => void;
  onSupersedeMemory: (memoryId: string) => void;
  onRestoreMemory: (memoryId: string) => void;
  onRetireMemory: (memoryId: string) => void;
}

export function LearningCenterPanel({
  learning,
  loading,
  onInvalidateMemory,
  onSupersedeMemory,
  onRestoreMemory,
  onRetireMemory
}: LearningCenterPanelProps) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: '总候选', value: learning.totalCandidates },
          { label: '待确认', value: learning.pendingCandidates },
          { label: '已确认', value: learning.confirmedCandidates },
          { label: '研究任务', value: learning.researchJobs ?? 0 },
          { label: '可自动沉淀', value: learning.autoConfirmableCandidates ?? 0 },
          { label: '已自动沉淀研究', value: learning.autoPersistedResearchJobs ?? 0 },
          { label: '研究冲突', value: learning.conflictingResearchJobs ?? 0 },
          { label: '失效记忆', value: learning.invalidatedMemories ?? 0 },
          { label: '失效规则', value: learning.invalidatedRules ?? 0 },
          { label: '平均评估分', value: Math.round(learning.averageEvaluationScore ?? 0) }
        ].map(item => (
          <Card key={item.label} className="rounded-3xl border-stone-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm text-stone-500">{item.label}</p>
              <p className="mt-4 text-4xl font-semibold text-stone-950">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-stone-950">Learning Candidates</CardTitle>
          <Badge variant="outline">{learning.candidates.length}</Badge>
        </CardHeader>
        <CardContent className="grid gap-4">
          {learning.candidates.length === 0 ? (
            <p className="text-sm text-stone-500">当前没有学习候选。</p>
          ) : (
            learning.candidates.map(candidate => (
              <article key={candidate.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-stone-950">{candidate.summary}</p>
                    <p className="mt-1 text-xs text-stone-500">{candidate.taskGoal}</p>
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
                </div>
                <p className="mt-3 text-xs text-stone-500">{candidate.createdAt}</p>
              </article>
            ))
          )}
        </CardContent>
      </Card>
      <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-stone-950">Recent Research Jobs</CardTitle>
          <Badge variant="outline">{learning.recentJobs?.length ?? 0}</Badge>
        </CardHeader>
        <CardContent className="grid gap-4">
          {!learning.recentJobs?.length ? (
            <p className="text-sm text-stone-500">当前还没有主动研究任务。</p>
          ) : (
            learning.recentJobs.map(job => (
              <article key={job.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-stone-950">{job.summary ?? job.goal ?? job.documentUri}</p>
                    <p className="mt-1 text-xs text-stone-500">{job.goal ?? job.documentUri}</p>
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
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loading}
                          onClick={() => onRestoreMemory(memoryId)}
                        >
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
                {job.conflictNotes?.length ? (
                  <p className="mt-3 text-xs text-red-600">{job.conflictNotes.join('；')}</p>
                ) : null}
                <p className="mt-3 text-xs text-stone-500">{job.updatedAt}</p>
              </article>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
