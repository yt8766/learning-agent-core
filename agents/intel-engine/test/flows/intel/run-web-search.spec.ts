import { describe, expect, it, vi } from 'vitest';

import { runWebSearchNode } from '../../../src/flows/intel/nodes/run-web-search';

describe('runWebSearchNode', () => {
  it('invokes webSearchPrime for patrol search tasks and maps raw results into normalized search output', async () => {
    const invokeTool = vi.fn(async () => ({
      ok: true,
      rawOutput: {
        results: [
          {
            title: 'Axios security advisory',
            url: 'https://github.com/axios/axios/security/advisories/1',
            summary: 'Axios 发布了安全公告',
            publishedAt: '2026-04-24T08:00:00.000Z',
            sourceName: 'github',
            sourceType: 'official'
          }
        ]
      }
    }));

    const state = await runWebSearchNode(
      {
        mode: 'patrol',
        jobId: 'job_001',
        startedAt: '2026-04-24T08:01:00.000Z',
        searchTasks: [
          {
            taskId: 'job_001:frontend_security:0',
            topicKey: 'frontend_security',
            query: 'axios vulnerability',
            priorityDefault: 'P1',
            recencyHours: 48,
            mode: 'patrol'
          }
        ]
      },
      {
        mcpClientManager: {
          hasCapability: () => true,
          invokeTool
        }
      }
    );

    expect(invokeTool).toHaveBeenCalledWith('webSearchPrime', expect.objectContaining({ toolName: 'webSearchPrime' }));
    expect(state.rawResults).toEqual([
      expect.objectContaining({
        taskId: 'job_001:frontend_security:0',
        topicKey: 'frontend_security',
        sourceName: 'github',
        sourceType: 'official',
        title: 'Axios security advisory'
      })
    ]);
  });

  it('skips malformed result urls without dropping valid results from the same payload', async () => {
    const state = await runWebSearchNode(
      {
        mode: 'patrol',
        jobId: 'job_002',
        startedAt: '2026-04-24T08:01:00.000Z',
        searchTasks: [
          {
            taskId: 'job_002:frontend_security:0',
            topicKey: 'frontend_security',
            query: 'axios vulnerability',
            priorityDefault: 'P1',
            recencyHours: 48,
            mode: 'patrol'
          }
        ]
      },
      {
        mcpClientManager: {
          hasCapability: () => true,
          invokeTool: vi.fn(async () => ({
            ok: true,
            rawOutput: {
              results: [
                {
                  title: 'Broken result',
                  url: 'not a url',
                  summary: 'This malformed result should be skipped',
                  publishedAt: '2026-04-24T08:00:00.000Z',
                  sourceName: 'bad-source'
                },
                {
                  title: 'Axios security advisory',
                  url: 'https://github.com/axios/axios/security/advisories/1',
                  summary: 'Axios 发布了安全公告',
                  publishedAt: '2026-04-24T08:00:00.000Z'
                }
              ]
            }
          }))
        }
      }
    );

    expect(state.rawResults).toHaveLength(1);
    expect(state.rawResults[0]).toEqual(
      expect.objectContaining({
        title: 'Axios security advisory',
        sourceName: 'github.com'
      })
    );
  });

  it('falls back to MiniMax Token Plan web_search when webSearchPrime is unavailable', async () => {
    const invokeTool = vi.fn(async () => ({
      ok: true,
      rawOutput: {
        results: [
          {
            title: 'React compiler release note',
            url: 'https://react.dev/blog/compiler',
            snippet: 'React compiler 发布了新版本',
            sourceName: 'react.dev',
            sourceType: 'official'
          }
        ],
        suggestions: ['react compiler changelog']
      }
    }));

    const state = await runWebSearchNode(
      {
        mode: 'patrol',
        jobId: 'job_003',
        startedAt: '2026-04-24T08:01:00.000Z',
        searchTasks: [
          {
            taskId: 'job_003:frontend_frameworks:0',
            topicKey: 'frontend_frameworks',
            query: 'React compiler release',
            priorityDefault: 'P0',
            recencyHours: 24,
            mode: 'patrol'
          }
        ]
      },
      {
        mcpClientManager: {
          hasCapability: capabilityId => capabilityId === 'minimax:web_search',
          invokeTool
        }
      }
    );

    expect(invokeTool).toHaveBeenCalledWith(
      'web_search',
      expect.objectContaining({
        toolName: 'web_search',
        input: { query: 'React compiler release' }
      })
    );
    expect(state.rawResults).toEqual([
      expect.objectContaining({
        query: 'React compiler release',
        sourceName: 'react.dev',
        title: 'React compiler release note'
      })
    ]);
  });
});
