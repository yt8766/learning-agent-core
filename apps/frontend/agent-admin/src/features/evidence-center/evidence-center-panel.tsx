import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DashboardCenterShell, DashboardEmptyState } from '@/components/dashboard-center-shell';

import { getBrowserReplay, recoverToCheckpoint } from '@/api/admin-api';
import type { EvidenceRecord } from '@/types/admin';
import {
  clearHighlightedEvidence,
  openEvidenceReplay,
  prioritizeEvidenceRecords,
  readHighlightedEvidenceIds,
  recoverEvidenceCheckpoint
} from './evidence-center-panel.helpers';

interface EvidenceCenterPanelProps {
  evidence: EvidenceRecord[];
}

export function EvidenceCenterPanel({ evidence }: EvidenceCenterPanelProps) {
  const [highlightedEvidenceIds, setHighlightedEvidenceIds] = useState<string[]>(readHighlightedEvidenceIds());
  const [expandedReplayId, setExpandedReplayId] = useState<string>();
  const [replayPayloads, setReplayPayloads] = useState<Record<string, Record<string, unknown>>>({});
  const [loadingReplayId, setLoadingReplayId] = useState<string>();
  const [recoveringEvidenceId, setRecoveringEvidenceId] = useState<string>();
  const highlightedEvidenceList = highlightedEvidenceIds ?? [];
  const replayPayloadMap = replayPayloads ?? {};
  const diagnosisEvidence = evidence.filter(item => item.sourceType === 'diagnosis_result');
  const highlightedEvidenceIdSet = useMemo(() => new Set(highlightedEvidenceList), [highlightedEvidenceList]);
  const prioritizedEvidence = useMemo(
    () => prioritizeEvidenceRecords(evidence, highlightedEvidenceList),
    [evidence, highlightedEvidenceList]
  );

  const handleReplayOpen = async (item: EvidenceRecord) =>
    openEvidenceReplay({
      item,
      expandedReplayId,
      replayPayloads: replayPayloadMap,
      loadReplay: getBrowserReplay,
      setExpandedReplayId,
      setReplayPayloads,
      setLoadingReplayId
    });

  const handleRecover = async (item: EvidenceRecord) =>
    recoverEvidenceCheckpoint({
      item,
      recover: recoverToCheckpoint,
      setRecoveringEvidenceId
    });

  const clearHighlight = () => {
    clearHighlightedEvidence({
      storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
      setHighlightedEvidenceIds
    });
  };

  return (
    <DashboardCenterShell
      title="证据中心"
      description="统一查看 diagnosis、freshness、browser replay 与 recoverable checkpoint。"
      count={evidence.length}
      actions={<Badge variant="secondary">诊断与回放</Badge>}
    >
      <div className="grid gap-4">
        {highlightedEvidenceList.length > 0 ? (
          <div className="rounded-2xl border border-sky-200/70 bg-sky-50/80 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-sky-950">记忆关联高亮</p>
                <p className="mt-1 text-xs text-sky-900">
                  命中 {highlightedEvidenceList.length} 条来自 Memory Insight 的证据高亮。
                </p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={clearHighlight}>
                清除高亮
              </Button>
            </div>
          </div>
        ) : null}
        {diagnosisEvidence.length > 0 ? (
          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/80 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-emerald-950">诊断证据</p>
                <p className="mt-1 text-xs text-emerald-900">
                  已沉淀 {diagnosisEvidence.length} 条 agent 故障诊断结论，可直接复用根因与恢复步骤。
                </p>
              </div>
              <Badge variant="success">{diagnosisEvidence.length}</Badge>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {diagnosisEvidence.slice(0, 4).map(item => (
                <div
                  key={`diagnosis-${item.id}`}
                  className="rounded-xl border border-emerald-200/70 bg-background px-3 py-3"
                >
                  <p className="text-sm font-medium text-foreground">{item.taskGoal}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.summary}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {evidence.length === 0 ? (
          <DashboardEmptyState message="当前没有可展示的证据记录。" />
        ) : (
          prioritizedEvidence.slice(0, 20).map(item => (
            <article
              key={item.id}
              className={`rounded-2xl border px-4 py-4 ${
                highlightedEvidenceIdSet.has(item.id)
                  ? 'border-sky-300 bg-sky-50/70'
                  : item.sourceType === 'diagnosis_result'
                    ? 'border-emerald-200/70 bg-emerald-50/70'
                    : 'border-border/70 bg-card/90'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.summary}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.taskGoal}</p>
                </div>
                <Badge variant="outline">{item.trustClass}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {highlightedEvidenceIdSet.has(item.id) ? <Badge variant="success">memory linked</Badge> : null}
                <Badge variant="secondary">
                  {item.sourceType === 'freshness_meta'
                    ? 'freshness'
                    : item.sourceType === 'diagnosis_result'
                      ? 'diagnosis'
                      : item.sourceType}
                </Badge>
                {item.sourceStore ? <Badge variant="outline">{item.sourceStore}</Badge> : null}
                {item.linkedRunId ? <Badge variant="secondary">{item.linkedRunId}</Badge> : null}
                {item.replay?.sessionId ? <Badge variant="secondary">session {item.replay.sessionId}</Badge> : null}
                {item.recoverable ? (
                  <Badge variant={item.checkpointRef?.recoverability === 'safe' ? 'success' : 'warning'}>
                    {item.checkpointRef?.recoverability === 'safe' ? 'recoverable' : 'partial recover'}
                  </Badge>
                ) : null}
                {item.sourceType === 'freshness_meta' && typeof item.detail?.sourceCount === 'number' ? (
                  <Badge variant="outline">{item.detail.sourceCount} 条来源</Badge>
                ) : null}
                {item.sourceType === 'diagnosis_result' && typeof item.detail?.reviewDecision === 'string' ? (
                  <Badge variant="outline">决策 {item.detail.reviewDecision}</Badge>
                ) : null}
              </div>
              {item.sourceType === 'diagnosis_result' ? (
                <div className="mt-3 rounded-xl border border-emerald-200/70 bg-background px-3 py-3 text-xs text-emerald-950">
                  <p className="font-medium">诊断摘要</p>
                  <div className="mt-2 grid gap-1">
                    {Array.isArray(item.detail?.reviewNotes) && item.detail.reviewNotes.length ? (
                      <p>审查说明：{item.detail.reviewNotes.join('；')}</p>
                    ) : null}
                    {typeof item.detail?.executionSummary === 'string' ? (
                      <p>执行摘要：{item.detail.executionSummary}</p>
                    ) : null}
                    {typeof item.detail?.finalAnswer === 'string' ? <p>最终结论：{item.detail.finalAnswer}</p> : null}
                  </div>
                </div>
              ) : null}
              {item.sourceStore === 'wenyuan' ? (
                <div className="mt-3 rounded-xl border border-sky-200/70 bg-sky-50/80 px-3 py-3 text-xs text-sky-950">
                  <p className="font-medium">文渊概览</p>
                  <div className="mt-2 grid gap-1">
                    {typeof item.detail?.traceCount === 'number' ? <p>trace: {item.detail.traceCount}</p> : null}
                    {typeof item.detail?.governanceHistoryCount === 'number' ? (
                      <p>governance history: {item.detail.governanceHistoryCount}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {item.sourceStore === 'cangjing' ? (
                <div className="mt-3 rounded-xl border border-indigo-200/70 bg-indigo-50/80 px-3 py-3 text-xs text-indigo-950">
                  <p className="font-medium">知识索引</p>
                  <div className="mt-2 grid gap-1">
                    {typeof item.detail?.sourceCount === 'number' ? <p>source: {item.detail.sourceCount}</p> : null}
                    {typeof item.detail?.searchableDocumentCount === 'number' ? (
                      <p>searchable: {item.detail.searchableDocumentCount}</p>
                    ) : null}
                    {typeof item.detail?.blockedDocumentCount === 'number' ? (
                      <p>blocked: {item.detail.blockedDocumentCount}</p>
                    ) : null}
                    {Array.isArray(item.detail?.latestReceipts) && item.detail.latestReceipts.length ? (
                      <p>latest receipts: {item.detail.latestReceipts.map(receipt => receipt.id).join(', ')}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {item.sourceType === 'freshness_meta' ? (
                <div className="mt-3 rounded-xl border border-amber-200/70 bg-amber-50/80 px-3 py-3 text-xs text-amber-900">
                  <p className="font-medium">时效基线</p>
                  <div className="mt-2 grid gap-1">
                    {typeof item.detail?.referenceDate === 'string' ? (
                      <p>信息基准日期：{item.detail.referenceDate}</p>
                    ) : null}
                    {typeof item.detail?.referenceTime === 'string' ? (
                      <p>信息检索基准时间：{item.detail.referenceTime}</p>
                    ) : null}
                    {typeof item.detail?.officialCount === 'number' ? (
                      <p>官方来源：{item.detail.officialCount} 条</p>
                    ) : null}
                    {Array.isArray(item.detail?.sourceTypes) && item.detail.sourceTypes.length ? (
                      <p>来源类型：{item.detail.sourceTypes.join('、')}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {item.replay ? (
                <div className="mt-3 rounded-xl border border-border/70 bg-background px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">浏览器回放</p>
                    {item.replay.sessionId ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => void handleReplayOpen(item)}>
                        {expandedReplayId === item.id ? '收起回放' : '打开回放'}
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                    {item.replay.url ? <p>URL: {item.replay.url}</p> : null}
                    {item.replay.snapshotSummary ? <p>{item.replay.snapshotSummary}</p> : null}
                    {item.replay.artifactRef ? <p>Artifact: {item.replay.artifactRef}</p> : null}
                    {item.replay.snapshotRef ? <p>Snapshot: {item.replay.snapshotRef}</p> : null}
                    {item.replay.screenshotRef ? <p>Screenshot: {item.replay.screenshotRef}</p> : null}
                    {item.replay.stepTrace?.length ? (
                      <div>
                        <p className="font-medium text-foreground">Step Trace</p>
                        <ul className="mt-1 list-disc pl-4">
                          {item.replay.stepTrace.map(step => (
                            <li key={`${item.id}-${step}`}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {item.replay.steps?.length ? (
                      <div className="mt-2">
                        <p className="font-medium text-foreground">回放步骤</p>
                        <div className="mt-2 grid gap-2">
                          {item.replay.steps.map(step => (
                            <div
                              key={`${item.id}-${step.id}`}
                              className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-foreground">{step.title}</span>
                                <Badge variant="outline">{step.status}</Badge>
                              </div>
                              {step.summary ? <p className="mt-1">{step.summary}</p> : null}
                              <p className="mt-1 text-[11px] text-muted-foreground">{step.at}</p>
                              {step.artifactRef ? (
                                <p className="mt-1 text-[11px] text-muted-foreground">{step.artifactRef}</p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {expandedReplayId === item.id ? (
                      // Intentionally keep the replay payload viewer dark for raw JSON readability.
                      <div className="mt-3 rounded-lg border border-stone-200 bg-stone-950 px-3 py-3 text-[11px] text-stone-100">
                        <p className="font-medium text-stone-200">回放载荷</p>
                        {loadingReplayId === item.id ? (
                          <p className="mt-2 text-stone-400">加载中…</p>
                        ) : item.replay.sessionId && replayPayloadMap[item.replay.sessionId] ? (
                          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(replayPayloadMap[item.replay.sessionId], null, 2)}
                          </pre>
                        ) : (
                          <p className="mt-2 text-stone-400">暂无回放负载。</p>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {item.recoverable && item.checkpointRef ? (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-sky-200/70 bg-sky-50/80 px-3 py-3">
                  <div className="text-xs text-sky-950">
                    <p className="font-medium">检查点回放</p>
                    <p className="mt-1">
                      逻辑回溯到 {item.checkpointRef.checkpointId} / cursor {item.checkpointRef.checkpointCursor}
                    </p>
                    <p className="mt-1 text-sky-800">不会回滚终端、浏览器或外部 connector 的已发生副作用。</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => void handleRecover(item)}>
                    {recoveringEvidenceId === item.id ? '回溯中…' : '回到此刻'}
                  </Button>
                </div>
              ) : null}
              <p className="mt-3 text-xs text-muted-foreground">{item.createdAt}</p>
            </article>
          ))
        )}
      </div>
    </DashboardCenterShell>
  );
}
