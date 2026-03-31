import { useEffect, useId, useRef, useState } from 'react';
import mermaid from 'mermaid';

import type { ArchitectureDiagramRecord } from '@/types/admin';

export function ArchitectureMermaidCard({ diagram }: { diagram: ArchitectureDiagramRecord }) {
  const elementId = useId().replace(/:/g, '-');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [svg, setSvg] = useState('');
  const [renderError, setRenderError] = useState('');

  useEffect(() => {
    let cancelled = false;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'neutral'
    });

    void mermaid
      .render(`runtime-architecture-${elementId}`, diagram.mermaid)
      .then(rendered => {
        if (cancelled) {
          return;
        }
        setSvg(rendered.svg);
        setRenderError('');
        if (rendered.bindFunctions && containerRef.current) {
          rendered.bindFunctions(containerRef.current);
        }
      })
      .catch(error => {
        if (cancelled) {
          return;
        }
        setSvg('');
        setRenderError(error instanceof Error ? error.message : 'Mermaid render failed');
      });

    return () => {
      cancelled = true;
    };
  }, [diagram.mermaid, elementId]);

  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-2 py-1 font-medium">v{diagram.version}</span>
        <span>{new Date(diagram.generatedAt).toLocaleString()}</span>
      </div>
      {svg ? (
        <div
          ref={containerRef}
          className="overflow-x-auto rounded-xl bg-background/80 p-3"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <pre className="overflow-x-auto rounded-xl bg-background/80 p-3 text-xs leading-5 text-foreground/80">
          {diagram.mermaid}
        </pre>
      )}
      {renderError ? <p className="mt-3 text-xs text-amber-700">Mermaid 渲染降级：{renderError}</p> : null}
    </div>
  );
}
