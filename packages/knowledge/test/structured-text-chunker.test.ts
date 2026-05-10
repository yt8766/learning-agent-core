import { describe, expect, it } from 'vitest';

import type { Document } from '@agent/knowledge';

import { StructuredTextChunker } from '../src';

describe('StructuredTextChunker', () => {
  it('chunks markdown by structure and emits parent section metadata', async () => {
    const document: Document = {
      id: 'handbook',
      content: [
        '# Runtime Handbook',
        '',
        'Intro paragraph for the runtime center.',
        '',
        '## Approvals',
        '',
        '- Approve high risk actions.',
        '- Reject unsafe actions.',
        '',
        '```ts',
        'const approval = "required";',
        '```',
        '',
        '## Evidence',
        '',
        'Evidence cards explain retrieval decisions.'
      ].join('\n'),
      metadata: { title: 'Runtime Handbook', docType: 'runbook' }
    };

    const chunks = await new StructuredTextChunker({ chunkSize: 240, chunkOverlap: 0 }).chunk(document);

    expect(chunks.map(chunk => chunk.content)).toEqual([
      'Intro paragraph for the runtime center.',
      '- Approve high risk actions.\n- Reject unsafe actions.',
      '```ts\nconst approval = "required";\n```',
      'Evidence cards explain retrieval decisions.'
    ]);
    expect(chunks.map(chunk => chunk.id)).toEqual([
      'handbook#chunk-0',
      'handbook#chunk-1',
      'handbook#chunk-2',
      'handbook#chunk-3'
    ]);
    expect(chunks[0]?.metadata).toEqual(
      expect.objectContaining({
        title: 'Runtime Handbook',
        docType: 'runbook',
        parentId: 'handbook#section-runtime-handbook',
        sectionId: 'handbook#section-runtime-handbook',
        sectionTitle: 'Runtime Handbook',
        heading: 'Runtime Handbook',
        sectionPath: ['Runtime Handbook'],
        contentType: 'paragraph',
        ordinal: 0,
        chunkHash: expect.any(String),
        nextChunkId: 'handbook#chunk-1'
      })
    );
    expect(chunks[1]?.metadata).toEqual(
      expect.objectContaining({
        parentId: 'handbook#section-approvals',
        sectionId: 'handbook#section-approvals',
        sectionTitle: 'Approvals',
        heading: 'Approvals',
        sectionPath: ['Runtime Handbook', 'Approvals'],
        contentType: 'list',
        ordinal: 1,
        prevChunkId: 'handbook#chunk-0',
        nextChunkId: 'handbook#chunk-2'
      })
    );
    expect(chunks[2]?.metadata).toEqual(expect.objectContaining({ contentType: 'code' }));
  });

  it('falls back to fixed windows for oversized structural blocks', async () => {
    const document: Document = {
      id: 'large-policy',
      content: ['# Policy', '', 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda'].join('\n'),
      metadata: {}
    };

    const chunks = await new StructuredTextChunker({ chunkSize: 24, chunkOverlap: 4 }).chunk(document);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(chunk => chunk.content.length <= 24)).toBe(true);
    expect(chunks.every(chunk => chunk.metadata.parentId === 'large-policy#section-policy')).toBe(true);
    expect(chunks.every(chunk => chunk.metadata.sectionTitle === 'Policy')).toBe(true);
    expect(chunks.map(chunk => chunk.metadata.ordinal)).toEqual(chunks.map((_, index) => index));
  });

  it('emits stable path-sensitive section metadata for Chinese headings', async () => {
    const document: Document = {
      id: 'zh-handbook',
      content: [
        '# 产品',
        '',
        '产品总览说明。',
        '',
        '## 概览',
        '',
        '产品概览内容。',
        '',
        '# 技术',
        '',
        '技术总览说明。',
        '',
        '## 概览',
        '',
        '技术概览内容。'
      ].join('\n'),
      metadata: { title: '中文手册' }
    };

    const chunker = new StructuredTextChunker({ chunkSize: 120, chunkOverlap: 0 });
    const firstRun = await chunker.chunk(document);
    const secondRun = await chunker.chunk(document);

    const sectionIds = firstRun.map(chunk => chunk.metadata.sectionId);

    expect(sectionIds).toHaveLength(4);
    expect(new Set(sectionIds).size).toBe(sectionIds.length);
    expect(sectionIds.every(sectionId => typeof sectionId === 'string' && !sectionId.includes('untitled'))).toBe(true);
    expect(firstRun.map(chunk => chunk.metadata.sectionPath)).toEqual([
      ['产品'],
      ['产品', '概览'],
      ['技术'],
      ['技术', '概览']
    ]);
    expect(firstRun[1]?.metadata.sectionId).not.toBe(firstRun[3]?.metadata.sectionId);
    expect(firstRun.map(chunk => chunk.metadata)).toEqual(secondRun.map(chunk => chunk.metadata));
  });
});
