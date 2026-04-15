import { describe, expect, it } from 'vitest';

import {
  ARCHITECTURE_MERMAID_CONFIG,
  computeArchitectureFitScale,
  formatArchitectureGeneratedAt,
  formatArchitectureZoomLabel,
  getArchitectureDownloadPayload,
  normalizeArchitectureScale
} from '@/features/runtime-overview/components/architecture-mermaid-helpers';

describe('architecture-mermaid-helpers', () => {
  it('exposes stable mermaid config and zoom helpers', () => {
    expect(ARCHITECTURE_MERMAID_CONFIG.theme).toBe('base');
    expect(ARCHITECTURE_MERMAID_CONFIG.flowchart.curve).toBe('basis');

    expect(normalizeArchitectureScale(2.4, 0.5, 2)).toBe(2);
    expect(normalizeArchitectureScale(0.1, 0.5, 2)).toBe(0.5);
    expect(normalizeArchitectureScale(1.234, 0.5, 2)).toBe(1.23);

    expect(computeArchitectureFitScale(0, 200)).toBe(1);
    expect(computeArchitectureFitScale(600, 200)).toBe(1.1);
    expect(computeArchitectureFitScale(200, 600)).toBe(0.55);

    expect(formatArchitectureZoomLabel(1.23)).toBe('123%');
    expect(formatArchitectureGeneratedAt('2026-04-01T00:00:00.000Z')).toBeTruthy();
  });

  it('builds download payloads for code and svg views', () => {
    expect(
      getArchitectureDownloadPayload({
        view: 'code',
        svg: '<svg />',
        safeMermaid: 'flowchart LR',
        diagram: { id: 'project' }
      })
    ).toEqual({
      content: 'flowchart LR',
      filename: 'project-diagram.mmd',
      mimeType: 'text/plain;charset=utf-8'
    });

    expect(
      getArchitectureDownloadPayload({
        view: 'diagram',
        svg: '<svg />',
        safeMermaid: 'flowchart LR',
        diagram: { id: 'project' }
      })
    ).toEqual({
      content: '<svg />',
      filename: 'project-diagram.svg',
      mimeType: 'image/svg+xml;charset=utf-8'
    });
  });
});
