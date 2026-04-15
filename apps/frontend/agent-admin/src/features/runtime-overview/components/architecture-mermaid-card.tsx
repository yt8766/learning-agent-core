import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Copy, Download, Maximize2, MinusCircle, PlusCircle, RotateCcw } from 'lucide-react';
import mermaid from 'mermaid';

import type { ArchitectureDiagramRecord } from '@/types/admin';
import {
  ARCHITECTURE_MERMAID_CONFIG,
  computeArchitectureFitScale,
  formatArchitectureGeneratedAt,
  formatArchitectureZoomLabel,
  getArchitectureDownloadPayload,
  normalizeArchitectureScale
} from './architecture-mermaid-helpers';

export function sanitizeMermaidSource(source: string) {
  const nodeIdMap = new Map<string, string>();
  const subgraphIdMap = new Map<string, string>();
  const lines = source.split('\n');

  const getNodeId = (value: string) => {
    if (!nodeIdMap.has(value)) {
      nodeIdMap.set(value, `node_${toMermaidToken(value)}`);
    }
    return nodeIdMap.get(value)!;
  };

  const getSubgraphId = (value: string) => {
    if (!subgraphIdMap.has(value)) {
      subgraphIdMap.set(value, `group_${toMermaidToken(value)}`);
    }
    return subgraphIdMap.get(value)!;
  };

  return lines
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'end' || trimmed.startsWith('flowchart ')) {
        return line;
      }

      const subgraphMatch = line.match(/^(\s*)subgraph\s+([^\s[]+)(.*)$/);
      if (subgraphMatch) {
        const [, indent, rawId, suffix] = subgraphMatch;
        return `${indent}subgraph ${getSubgraphId(rawId)}${suffix}`;
      }

      const nodeMatch = line.match(/^(\s*)([A-Za-z0-9_-]+)(\s*\[.*)$/);
      if (nodeMatch) {
        const [, indent, rawId, suffix] = nodeMatch;
        return `${indent}${getNodeId(rawId)}${suffix}`;
      }

      const edgeMatch = line.match(/^(\s*)([A-Za-z0-9_-]+)(\s+-.?->(?:\|.*?\|)?\s+)([A-Za-z0-9_-]+)(\s*)$/);
      if (edgeMatch) {
        const [, indent, from, connector, to, suffix] = edgeMatch;
        return `${indent}${getNodeId(from)}${connector}${getNodeId(to)}${suffix}`;
      }

      return line;
    })
    .join('\n');
}

export function ArchitectureMermaidCard({ diagram }: { diagram: ArchitectureDiagramRecord }) {
  const elementId = useId().replace(/:/g, '-');
  const svgHostRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panSessionRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [svg, setSvg] = useState('');
  const [renderError, setRenderError] = useState('');
  const [view, setView] = useState<'diagram' | 'code'>('diagram');
  const [scale, setScale] = useState(1);
  const [fitScale, setFitScale] = useState(1);
  const [copied, setCopied] = useState(false);
  const safeMermaid = sanitizeMermaidSource(diagram.mermaid);
  const canRenderDiagram = Boolean(svg) && view === 'diagram';
  const effectiveScale = useMemo(() => Number((scale * fitScale).toFixed(3)), [fitScale, scale]);
  const zoomLabel = useMemo(() => formatArchitectureZoomLabel(effectiveScale), [effectiveScale]);

  useEffect(() => {
    let cancelled = false;
    mermaid.initialize(ARCHITECTURE_MERMAID_CONFIG);

    void mermaid
      .render(`runtime-architecture-${elementId}`, safeMermaid)
      .then(rendered => {
        if (cancelled) {
          return;
        }
        setSvg(rendered.svg);
        setRenderError('');
        if (rendered.bindFunctions && svgHostRef.current) {
          rendered.bindFunctions(svgHostRef.current);
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
  }, [elementId, safeMermaid]);

  useEffect(() => {
    if (!svg) {
      setView('code');
    }
  }, [svg]);

  useEffect(() => {
    if (!canRenderDiagram || !viewportRef.current || !svgHostRef.current) {
      return;
    }

    const viewport = viewportRef.current;
    const svgElement = svgHostRef.current.querySelector('svg');
    if (!svgElement) {
      return;
    }

    const applyFit = () => {
      const viewBoxWidth = svgElement.viewBox?.baseVal?.width;
      const width =
        viewBoxWidth && Number.isFinite(viewBoxWidth) && viewBoxWidth > 0 ? viewBoxWidth : svgElement.getBBox().width;
      if (!width) {
        return;
      }
      setFitScale(computeArchitectureFitScale(viewport.clientWidth, width));
    };

    applyFit();
    const resizeObserver = new ResizeObserver(() => applyFit());
    resizeObserver.observe(viewport);
    return () => resizeObserver.disconnect();
  }, [canRenderDiagram, svg]);

  const handleZoomIn = () => setScale(current => normalizeArchitectureScale(current + 0.1, 0.5, 2));
  const handleZoomOut = () => setScale(current => normalizeArchitectureScale(current - 0.1, 0.5, 2));
  const handleResetView = () => {
    setScale(1);
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    }
  };

  const handleDownload = async () => {
    const { content, filename, mimeType } = getArchitectureDownloadPayload({ view, svg, safeMermaid, diagram });
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(safeMermaid);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const handleFullscreen = async () => {
    const element = shellRef.current;
    if (!element) {
      return;
    }
    if (document.fullscreenElement === element) {
      await document.exitFullscreen();
      return;
    }
    await element.requestFullscreen();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (view !== 'diagram' || !canRenderDiagram || !viewportRef.current) {
      return;
    }
    const viewport = viewportRef.current;
    panSessionRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: viewport.scrollLeft,
      top: viewport.scrollTop
    };
    viewport.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    const panSession = panSessionRef.current;
    if (!viewport || !panSession) {
      return;
    }
    viewport.scrollLeft = panSession.left - (event.clientX - panSession.x);
    viewport.scrollTop = panSession.top - (event.clientY - panSession.y);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (viewportRef.current?.hasPointerCapture(event.pointerId)) {
      viewportRef.current.releasePointerCapture(event.pointerId);
    }
    panSessionRef.current = null;
  };

  return (
    <div ref={shellRef} className="rounded-[28px] border border-border/70 bg-card/85 p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-2xl bg-muted/80 p-1">
          <button
            type="button"
            onClick={() => setView('diagram')}
            className={`rounded-xl px-6 py-2 text-sm font-semibold transition ${
              view === 'diagram' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            图表
          </button>
          <button
            type="button"
            onClick={() => setView('code')}
            className={`rounded-xl px-6 py-2 text-sm font-semibold transition ${
              view === 'code' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            代码
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <button
            type="button"
            aria-label="缩小架构图"
            onClick={handleZoomOut}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background transition hover:bg-muted"
          >
            <MinusCircle className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="放大架构图"
            onClick={handleZoomIn}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background transition hover:bg-muted"
          >
            <PlusCircle className="h-5 w-5" />
          </button>
          <span className="mx-1 min-w-12 text-center text-sm font-medium text-foreground">{zoomLabel}</span>
          <span className="h-8 w-px bg-border/80" />
          <button
            type="button"
            onClick={handleResetView}
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            <RotateCcw className="h-5 w-5" />
            重置
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            <Copy className="h-5 w-5" />
            {copied ? '已复制' : '复制代码'}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            <Download className="h-5 w-5" />
            下载
          </button>
          <button
            type="button"
            onClick={handleFullscreen}
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            <Maximize2 className="h-5 w-5" />
            全屏
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-2 py-1 font-medium">v{diagram.version}</span>
        <span>{formatArchitectureGeneratedAt(diagram.generatedAt)}</span>
      </div>

      {canRenderDiagram ? (
        <div className="overflow-hidden rounded-[24px] bg-background/90 p-6">
          <div
            ref={viewportRef}
            className="max-h-[70vh] overflow-auto rounded-[20px] bg-[#fcfcfa] p-6 cursor-grab active:cursor-grabbing"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <div
              ref={svgHostRef}
              className="flex min-w-fit justify-center origin-top-left transition-transform duration-200"
              style={{ transform: `scale(${effectiveScale})`, width: `${100 / effectiveScale}%` }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        </div>
      ) : (
        <pre className="max-h-[70vh] overflow-auto rounded-[24px] bg-background/90 p-6 text-xs leading-6 text-foreground/80">
          {safeMermaid}
        </pre>
      )}
      {renderError ? <p className="mt-3 text-xs text-amber-700">Mermaid 渲染降级：{renderError}</p> : null}
    </div>
  );
}
function toMermaidToken(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '_');
}
