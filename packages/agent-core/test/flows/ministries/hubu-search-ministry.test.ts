import { describe, expect, it, vi } from 'vitest';

import { HubuSearchMinistry } from '../../../src/flows/ministries/hubu-search-ministry';

describe('HubuSearchMinistry', () => {
  it('retrieves from wenyuan memory and cangjing knowledge in the same research pass', async () => {
    const ministry = new HubuSearchMinistry({
      taskId: 'task-hubu-1',
      goal: '梳理 runtime architecture knowledge flow',
      flow: 'chat',
      memoryRepository: {
        search: vi.fn()
      },
      memorySearchService: {
        search: vi.fn().mockResolvedValue({
          memories: [
            {
              id: 'mem-1',
              summary: '此前做过 runtime architecture 梳理',
              tags: ['research-job', 'auto-persist']
            }
          ],
          rules: []
        })
      },
      knowledgeSearchService: {
        search: vi.fn().mockResolvedValue([
          {
            chunkId: 'chunk-1',
            documentId: 'doc-1',
            sourceId: 'source-1',
            uri: 'docs/ARCHITECTURE.md',
            title: 'docs/ARCHITECTURE.md',
            sourceType: 'repo-docs',
            content: 'runtime architecture knowledge flow',
            score: 6
          }
        ])
      },
      skillRegistry: {
        list: vi.fn().mockResolvedValue([])
      },
      approvalService: {} as any,
      toolRegistry: {} as any,
      sandbox: {} as any,
      llm: {
        isConfigured: () => false
      } as any,
      thinking: {
        manager: false,
        research: false,
        executor: false,
        reviewer: false
      }
    } as any);

    const result = await ministry.research('整理受控来源研究结论');

    expect(result.memories).toHaveLength(1);
    expect(result.knowledgeEvidence).toEqual([
      expect.objectContaining({
        sourceType: 'document',
        sourceUrl: 'docs/ARCHITECTURE.md',
        detail: expect.objectContaining({
          knowledgeStore: 'cangjing',
          documentId: 'doc-1'
        })
      })
    ]);
    expect(result.summary).toContain('文渊阁记忆');
    expect(result.summary).toContain('藏经阁文档切片');
  });

  it('prioritizes web search for freshness-sensitive research when webSearchPrime is available', async () => {
    const invokeCapability = vi.fn().mockResolvedValue({
      ok: true,
      outputSummary: '已检索到最新网页结果',
      rawOutput: {
        results: [
          {
            url: 'https://example.com/latest-ai',
            title: 'Latest AI update',
            summary: 'Latest model release notes.'
          }
        ]
      },
      durationMs: 5
    });
    const ministry = new HubuSearchMinistry({
      taskId: 'task-hubu-2',
      goal: '最近 AI 有什么更新',
      flow: 'chat',
      memoryRepository: {
        search: vi.fn()
      },
      memorySearchService: {
        search: vi.fn().mockResolvedValue({
          memories: [],
          rules: []
        })
      },
      knowledgeSearchService: {
        search: vi.fn().mockResolvedValue([])
      },
      skillRegistry: {
        list: vi.fn().mockResolvedValue([])
      },
      approvalService: {} as any,
      toolRegistry: {
        get: vi.fn((toolName: string) => (toolName === 'webSearchPrime' ? { name: 'webSearchPrime' } : undefined))
      } as any,
      mcpClientManager: {
        hasCapability: vi.fn((toolName: string) => toolName === 'webSearchPrime'),
        invokeCapability
      } as any,
      sandbox: {
        execute: vi.fn()
      } as any,
      llm: {
        isConfigured: () => false
      } as any,
      thinking: {
        manager: false,
        research: false,
        executor: false,
        reviewer: false
      }
    } as any);

    const result = await ministry.research('先研究最新变化');

    expect(invokeCapability).toHaveBeenCalledWith(
      'webSearchPrime',
      expect.objectContaining({
        toolName: 'webSearchPrime',
        input: expect.objectContaining({
          query: '最近 AI 有什么更新',
          freshnessHint: 'latest'
        })
      })
    );
    expect(result.knowledgeEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: 'web',
          sourceUrl: 'https://example.com/latest-ai'
        })
      ])
    );
  });
});
