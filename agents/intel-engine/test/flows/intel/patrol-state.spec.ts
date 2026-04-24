import { describe, expect, it } from 'vitest';

import { buildSearchTasksNode } from '../../../src/flows/intel/nodes/build-search-tasks';
import { loadSourceConfigNode } from '../../../src/flows/intel/nodes/load-source-config';
import { PatrolGraphStateSchema } from '../../../src/flows/intel/schemas/patrol-graph-state.schema';

describe('patrol graph state', () => {
  it('parses a minimal patrol state and expands enabled patrol queries into search tasks', () => {
    const state = PatrolGraphStateSchema.parse({
      mode: 'patrol',
      jobId: 'job_001',
      startedAt: '2026-04-23T10:00:00.000Z'
    });

    expect(state.topics).toEqual([]);
    expect(state.searchTasks).toEqual([]);
    expect(state.rawResults).toEqual([]);
    expect(state.errors).toEqual([]);

    const loadedState = loadSourceConfigNode({
      ...state,
      sources: {
        defaults: {
          recencyHours: 72
        },
        topics: [
          {
            key: 'frontend_security',
            enabled: true,
            mode: 'patrol',
            priorityDefault: 'P1',
            queries: ['axios vulnerability', 'react xss']
          },
          {
            key: 'ai_release',
            enabled: false,
            mode: 'patrol',
            priorityDefault: 'P2',
            queries: ['model release']
          },
          {
            key: 'policy_external',
            enabled: true,
            mode: 'ingest',
            priorityDefault: 'P2',
            queries: ['policy update']
          }
        ]
      }
    });

    const searchTaskState = buildSearchTasksNode(loadedState);

    expect(searchTaskState.topics).toEqual([
      {
        key: 'frontend_security',
        priorityDefault: 'P1',
        queries: ['axios vulnerability', 'react xss'],
        recencyHours: 72
      }
    ]);
    expect(searchTaskState.searchTasks).toEqual([
      {
        taskId: 'job_001:frontend_security:0',
        topicKey: 'frontend_security',
        query: 'axios vulnerability',
        priorityDefault: 'P1',
        recencyHours: 72,
        mode: 'patrol'
      },
      {
        taskId: 'job_001:frontend_security:1',
        topicKey: 'frontend_security',
        query: 'react xss',
        priorityDefault: 'P1',
        recencyHours: 72,
        mode: 'patrol'
      }
    ]);
  });
});
