import type { ArchitectureDiagramRecord } from '@/types/admin';

export const ARCHITECTURE_MERMAID_CONFIG = {
  startOnLoad: false,
  securityLevel: 'loose',
  theme: 'base',
  themeVariables: {
    primaryColor: '#ece9ff',
    primaryBorderColor: '#cdc6ff',
    primaryTextColor: '#514a77',
    lineColor: '#a9abc3',
    secondaryColor: '#fff8bf',
    secondaryBorderColor: '#efe394',
    tertiaryColor: '#f7f7fb',
    clusterBkg: '#fff9c9',
    clusterBorder: '#efe394',
    fontFamily: 'Geist Variable, Figtree Variable, sans-serif',
    fontSize: '14px'
  },
  flowchart: {
    curve: 'basis'
  }
} as const;

export function normalizeArchitectureScale(value: number, min: number, max: number, precision = 2) {
  return Number(Math.min(max, Math.max(min, value)).toFixed(precision));
}

export function computeArchitectureFitScale(viewportWidth: number, diagramWidth: number) {
  if (!viewportWidth || !diagramWidth) {
    return 1;
  }
  return normalizeArchitectureScale((viewportWidth - 48) / diagramWidth, 0.55, 1.1, 3);
}

export function formatArchitectureZoomLabel(scale: number) {
  return `${Math.round(scale * 100)}%`;
}

export function getArchitectureDownloadPayload(params: {
  view: 'diagram' | 'code';
  svg: string;
  safeMermaid: string;
  diagram: Pick<ArchitectureDiagramRecord, 'id'>;
}) {
  const useCode = params.view === 'code' || !params.svg;
  return {
    content: useCode ? params.safeMermaid : params.svg,
    filename: `${params.diagram.id}-${useCode ? 'diagram.mmd' : 'diagram.svg'}`,
    mimeType: useCode ? 'text/plain;charset=utf-8' : 'image/svg+xml;charset=utf-8'
  };
}

export function formatArchitectureGeneratedAt(value: string) {
  return new Date(value).toLocaleString();
}
