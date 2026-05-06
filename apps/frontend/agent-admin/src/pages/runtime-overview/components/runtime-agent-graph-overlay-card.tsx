import { useEffect, useMemo, useState } from 'react';

import type { RunBundleRecord } from '@agent/core';

import { getRuntimeArchitecture, isAbortedAdminRequestError } from '@/api/admin-api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ArchitectureDiagramRecord } from '@/types/admin';
import type { RunObservatoryFocusTarget } from '@/pages/run-observatory/run-observatory-panel-support';
import { buildAgentGraphOverlay, type AgentGraphOverlayFilter } from './runtime-agent-graph-overlay-support';
import type { RuntimeRunWorkbenchReplayDraftSeed } from './runtime-run-workbench-support';

function getStatusVariant(status: 'idle' | 'active' | 'current') {
  if (status === 'current') {
    return 'success';
  }
  if (status === 'active') {
    return 'secondary';
  }
  return 'outline';
}

export function RuntimeAgentGraphOverlayCard(props: {
  detail?: RunBundleRecord | null;
  diagram?: ArchitectureDiagramRecord;
  onFocusTargetChange?: (target: RunObservatoryFocusTarget) => void;
  onFilterChange?: (filter?: AgentGraphOverlayFilter) => void;
  activeFilterNodeId?: string;
  onRequestReplayDraft?: (seed: RuntimeRunWorkbenchReplayDraftSeed) => void;
}) {
  const [diagram, setDiagram] = useState<ArchitectureDiagramRecord | null>(props.diagram ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (props.diagram || !props.detail) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    void getRuntimeArchitecture()
      .then(record => {
        if (!cancelled) {
          setDiagram(record.agent);
        }
      })
      .catch(loadError => {
        if (!cancelled && !isAbortedAdminRequestError(loadError)) {
          setError(loadError instanceof Error ? loadError.message : '加载 graph overlay 失败。');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [props.diagram, props.detail]);

  const overlayNodes = useMemo(() => {
    if (!diagram || !props.detail) {
      return [];
    }
    return buildAgentGraphOverlay({
      diagram,
      detail: props.detail
    });
  }, [diagram, props.detail]);

  if (!props.detail) {
    return null;
  }

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-semibold text-foreground">Agent Graph Overlay</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            复用现有 agent 架构图，把当前 run 的 workflow、阶段、六部执行态叠到 graph 节点上。
          </p>
        </div>
        <Badge variant="outline">{overlayNodes.length}</Badge>
      </CardHeader>
      <CardContent className="grid gap-3">
        {loading ? <p className="text-sm text-muted-foreground">正在加载 agent graph descriptor...</p> : null}
        {error ? <p className="text-sm text-destructive">graph overlay 加载失败：{error}</p> : null}
        {overlayNodes.map(node =>
          (() => {
            const replayDraftSeed = node.replayDraftSeed;

            return (
              <article
                key={node.id}
                className={`rounded-2xl border px-4 py-4 ${
                  props.activeFilterNodeId === node.id
                    ? 'border-emerald-500 bg-emerald-50/80'
                    : 'border-border/70 bg-muted/30'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{node.label}</p>
                      <Badge variant={getStatusVariant(node.status)}>{node.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{node.id}</p>
                  </div>
                  <Badge variant="outline">{node.subgraphTitle}</Badge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{node.summary}</p>
                {node.focusTarget ||
                node.filter.spanIds.length ||
                node.filter.checkpointIds.length ||
                node.filter.evidenceIds.length ? (
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        props.onFilterChange?.(props.activeFilterNodeId === node.id ? undefined : node.filter)
                      }
                      className="text-xs font-medium text-foreground underline underline-offset-4"
                    >
                      {props.activeFilterNodeId === node.id ? '清除节点过滤' : '只看这个节点'}
                    </button>
                    {replayDraftSeed ? (
                      <button
                        type="button"
                        onClick={() => props.onRequestReplayDraft?.(replayDraftSeed)}
                        className="text-xs font-medium text-foreground underline underline-offset-4"
                      >
                        送到 Replay Draft
                      </button>
                    ) : null}
                    {node.focusTarget ? (
                      <button
                        type="button"
                        onClick={() => props.onFocusTargetChange?.(node.focusTarget)}
                        className="text-xs font-medium text-foreground underline underline-offset-4"
                      >
                        聚焦相关 observability
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })()
        )}
      </CardContent>
    </Card>
  );
}
