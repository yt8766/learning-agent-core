import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { getBrowserReplay } from '../../api/admin-api';
import type { EvidenceRecord } from '../../types/admin';

interface EvidenceCenterPanelProps {
  evidence: EvidenceRecord[];
}

export function EvidenceCenterPanel({ evidence }: EvidenceCenterPanelProps) {
  const [expandedReplayId, setExpandedReplayId] = useState<string>();
  const [replayPayloads, setReplayPayloads] = useState<Record<string, Record<string, unknown>>>({});
  const [loadingReplayId, setLoadingReplayId] = useState<string>();

  const handleReplayOpen = async (item: EvidenceRecord) => {
    if (!item.replay?.sessionId) {
      return;
    }

    if (expandedReplayId === item.id) {
      setExpandedReplayId(undefined);
      return;
    }

    setExpandedReplayId(item.id);
    if (replayPayloads[item.replay.sessionId]) {
      return;
    }

    try {
      setLoadingReplayId(item.id);
      const payload = await getBrowserReplay(item.replay.sessionId);
      setReplayPayloads(current => ({
        ...current,
        [item.replay!.sessionId!]: payload
      }));
    } finally {
      setLoadingReplayId(undefined);
    }
  };

  return (
    <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-stone-950">Evidence Center</CardTitle>
        <Badge variant="outline">{evidence.length}</Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
        {evidence.length === 0 ? (
          <p className="text-sm text-stone-500">当前没有可展示的证据记录。</p>
        ) : (
          evidence.slice(0, 20).map(item => (
            <article key={item.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-stone-950">{item.summary}</p>
                  <p className="mt-1 text-xs text-stone-500">{item.taskGoal}</p>
                </div>
                <Badge variant="outline">{item.trustClass}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {item.sourceType === 'freshness_meta' ? 'freshness' : item.sourceType}
                </Badge>
                {item.linkedRunId ? <Badge variant="secondary">{item.linkedRunId}</Badge> : null}
                {item.replay?.sessionId ? <Badge variant="secondary">session {item.replay.sessionId}</Badge> : null}
                {item.sourceType === 'freshness_meta' && typeof item.detail?.sourceCount === 'number' ? (
                  <Badge variant="outline">{item.detail.sourceCount} 条来源</Badge>
                ) : null}
              </div>
              {item.sourceType === 'freshness_meta' ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900">
                  <p className="font-medium">Freshness Baseline</p>
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
                <div className="mt-3 rounded-xl border border-stone-200 bg-white px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Browser Replay</p>
                    {item.replay.sessionId ? (
                      <button
                        type="button"
                        onClick={() => void handleReplayOpen(item)}
                        className="rounded-full border border-stone-300 bg-white px-3 py-1 text-[11px] text-stone-700"
                      >
                        {expandedReplayId === item.id ? '收起回放' : '打开回放'}
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-stone-600">
                    {item.replay.url ? <p>URL: {item.replay.url}</p> : null}
                    {item.replay.snapshotSummary ? <p>{item.replay.snapshotSummary}</p> : null}
                    {item.replay.artifactRef ? <p>Artifact: {item.replay.artifactRef}</p> : null}
                    {item.replay.snapshotRef ? <p>Snapshot: {item.replay.snapshotRef}</p> : null}
                    {item.replay.screenshotRef ? <p>Screenshot: {item.replay.screenshotRef}</p> : null}
                    {item.replay.stepTrace?.length ? (
                      <div>
                        <p className="font-medium text-stone-900">Step Trace</p>
                        <ul className="mt-1 list-disc pl-4">
                          {item.replay.stepTrace.map(step => (
                            <li key={`${item.id}-${step}`}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {item.replay.steps?.length ? (
                      <div className="mt-2">
                        <p className="font-medium text-stone-900">Replay Steps</p>
                        <div className="mt-2 grid gap-2">
                          {item.replay.steps.map(step => (
                            <div
                              key={`${item.id}-${step.id}`}
                              className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-stone-900">{step.title}</span>
                                <Badge variant="outline">{step.status}</Badge>
                              </div>
                              {step.summary ? <p className="mt-1">{step.summary}</p> : null}
                              <p className="mt-1 text-[11px] text-stone-500">{step.at}</p>
                              {step.artifactRef ? (
                                <p className="mt-1 text-[11px] text-stone-500">{step.artifactRef}</p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {expandedReplayId === item.id ? (
                      <div className="mt-3 rounded-lg border border-stone-200 bg-stone-950 px-3 py-3 text-[11px] text-stone-100">
                        <p className="font-medium text-stone-200">Replay Payload</p>
                        {loadingReplayId === item.id ? (
                          <p className="mt-2 text-stone-400">加载中…</p>
                        ) : item.replay.sessionId && replayPayloads[item.replay.sessionId] ? (
                          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(replayPayloads[item.replay.sessionId], null, 2)}
                          </pre>
                        ) : (
                          <p className="mt-2 text-stone-400">暂无回放负载。</p>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <p className="mt-3 text-xs text-stone-500">{item.createdAt}</p>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}
