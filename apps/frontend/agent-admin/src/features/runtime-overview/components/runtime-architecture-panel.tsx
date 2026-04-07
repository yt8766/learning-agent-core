import { useEffect, useMemo, useRef, useState } from 'react';

import { getRuntimeArchitecture, isAbortedAdminRequestError } from '@/api/admin-api';
import type { ArchitectureDiagramRecord, RuntimeArchitectureRecord } from '@/types/admin';
import { ArchitectureMermaidCard } from './architecture-mermaid-card';

const DIAGRAM_ORDER: Array<{ key: keyof RuntimeArchitectureRecord; label: string }> = [
  { key: 'project', label: '当前项目' },
  { key: 'agent', label: 'Agent' },
  { key: 'agentChat', label: 'agent-chat' },
  { key: 'agentAdmin', label: 'agent-admin' }
];

export function RuntimeArchitecturePanel() {
  const [record, setRecord] = useState<RuntimeArchitectureRecord | null>(null);
  const [activeKey, setActiveKey] = useState<keyof RuntimeArchitectureRecord>('project');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const latestRequestId = useRef(0);

  const load = () => {
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;
    setLoading(true);
    setError('');
    void getRuntimeArchitecture()
      .then(next => {
        if (latestRequestId.current !== requestId) {
          return;
        }
        setRecord(next);
      })
      .catch(loadError => {
        if (latestRequestId.current !== requestId || isAbortedAdminRequestError(loadError)) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : '加载失败');
      })
      .finally(() => {
        if (latestRequestId.current === requestId) {
          setLoading(false);
        }
      });
  };

  useEffect(() => {
    load();
  }, []);

  const activeDiagram = useMemo<ArchitectureDiagramRecord | null>(() => {
    if (!record) {
      return null;
    }
    return record[activeKey];
  }, [record, activeKey]);

  return (
    <section className="rounded-[28px] border border-border/70 bg-card/85 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold tracking-[0.2em] text-muted-foreground uppercase">Architecture View</p>
          <h2 className="text-2xl font-semibold text-foreground">结构化描述驱动的架构可视化</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            后端基于 registry 与 descriptor 生成 Mermaid 文本，前端只负责切换与渲染，代码改动后刷新即可重新拉取。
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
        >
          重新生成
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {DIAGRAM_ORDER.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActiveKey(item.key)}
            className={`rounded-full px-3 py-1.5 text-sm transition ${
              activeKey === item.key
                ? 'bg-foreground text-background'
                : 'border border-border bg-background text-foreground hover:bg-muted'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? <p className="mt-4 text-sm text-muted-foreground">正在生成 Mermaid 架构图…</p> : null}
      {error ? <p className="mt-4 text-sm text-destructive">架构图加载失败：{error}</p> : null}

      {activeDiagram ? (
        <div className="mt-5 grid gap-4">
          <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-foreground">{activeDiagram.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {activeDiagram.descriptor.nodes.length} nodes / {activeDiagram.descriptor.edges.length} routes
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeDiagram.sourceDescriptors.map(source => (
                  <span key={source} className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {source}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <ArchitectureMermaidCard diagram={activeDiagram} />
        </div>
      ) : null}
    </section>
  );
}
