import { describe, expect, it } from 'vitest';

import {
  extractBrowserReplay,
  describeCapabilityApprovalReason,
  taskTouchesCapability,
  findCapabilityTraceSummary
} from '../../../src/runtime/helpers/runtime-connector-utils';

describe('extractBrowserReplay', () => {
  it('returns undefined when detail is undefined', () => {
    expect(extractBrowserReplay(undefined)).toBeUndefined();
  });

  it('returns undefined when no browser evidence and no url', () => {
    expect(extractBrowserReplay({ randomField: 'value' })).toBeUndefined();
  });

  it('extracts from browse_page toolName', () => {
    const result = extractBrowserReplay({ toolName: 'browse_page', url: 'https://example.com' });
    expect(result).toBeDefined();
    expect(result?.url).toBe('https://example.com');
  });

  it('extracts from page_snapshot toolName', () => {
    const result = extractBrowserReplay({ toolName: 'page_snapshot' });
    expect(result).toBeDefined();
  });

  it('extracts from snapshotSummary string', () => {
    const result = extractBrowserReplay({ snapshotSummary: 'page content' });
    expect(result?.snapshotSummary).toBe('page content');
  });

  it('extracts from screenshotRef string', () => {
    const result = extractBrowserReplay({ screenshotRef: 'screenshot.png' });
    expect(result?.screenshotRef).toBe('screenshot.png');
  });

  it('extracts from non-empty stepTrace array', () => {
    const result = extractBrowserReplay({ stepTrace: ['step1', 'step2'] });
    expect(result?.stepTrace).toEqual(['step1', 'step2']);
  });

  it('returns undefined when stepTrace is empty and no other evidence', () => {
    expect(extractBrowserReplay({ stepTrace: [] })).toBeUndefined();
  });

  it('extracts url from sourceUrl when url is not present', () => {
    const result = extractBrowserReplay({ sourceUrl: 'https://source.example.com' });
    expect(result?.url).toBe('https://source.example.com');
  });

  it('prefers url over sourceUrl', () => {
    const result = extractBrowserReplay({ url: 'https://primary.com', sourceUrl: 'https://secondary.com' });
    expect(result?.url).toBe('https://primary.com');
  });

  it('extracts sessionId when it is a string', () => {
    const result = extractBrowserReplay({ toolName: 'browse_page', sessionId: 'sess-1' });
    expect(result?.sessionId).toBe('sess-1');
  });

  it('sets sessionId to undefined when not a string', () => {
    const result = extractBrowserReplay({ toolName: 'browse_page', sessionId: 123 });
    expect(result?.sessionId).toBeUndefined();
  });

  it('falls back snapshotSummary through outputSummary and summary', () => {
    const result1 = extractBrowserReplay({ toolName: 'browse_page', outputSummary: 'output text' });
    expect(result1?.snapshotSummary).toBe('output text');

    const result2 = extractBrowserReplay({ toolName: 'browse_page', summary: 'summary text' });
    expect(result2?.snapshotSummary).toBe('summary text');
  });

  it('filters non-string stepTrace items', () => {
    const result = extractBrowserReplay({ stepTrace: ['valid', 123, null, 'also-valid'] });
    expect(result?.stepTrace).toEqual(['valid', 'also-valid']);
  });

  it('sets stepTrace to undefined when all items are filtered', () => {
    const result = extractBrowserReplay({ stepTrace: [123, null] });
    expect(result?.stepTrace).toBeUndefined();
  });

  it('extracts steps from detail', () => {
    const result = extractBrowserReplay({
      toolName: 'browse_page',
      steps: [
        {
          id: 's1',
          title: 'Step 1',
          status: 'completed',
          at: '2026-05-11T00:00:00.000Z',
          summary: 'done',
          artifactRef: 'art-1'
        },
        { id: 's2', title: 'Step 2', status: 'failed', at: '2026-05-11T00:01:00.000Z' },
        { id: 's3', title: 'Step 3', status: 'running', at: '2026-05-11T00:02:00.000Z' }
      ]
    });
    expect(result?.steps).toHaveLength(3);
    expect(result?.steps?.[0].status).toBe('completed');
    expect(result?.steps?.[1].status).toBe('failed');
    expect(result?.steps?.[2].status).toBe('running');
  });

  it('handles steps with missing fields', () => {
    const result = extractBrowserReplay({
      toolName: 'browse_page',
      steps: [{ invalid: true }]
    });
    expect(result?.steps).toHaveLength(1);
    expect(result?.steps?.[0].id).toBe('step');
    expect(result?.steps?.[0].title).toBe('Step');
    expect(result?.steps?.[0].status).toBe('completed');
  });

  it('filters out non-object step items', () => {
    const result = extractBrowserReplay({
      toolName: 'browse_page',
      steps: [null, 'string', 123, { id: 'valid', title: 'Valid', status: 'completed', at: '2026-05-11' }]
    });
    expect(result?.steps).toHaveLength(1);
  });

  it('sets steps to undefined when detail.steps is not an array', () => {
    const result = extractBrowserReplay({ toolName: 'browse_page', steps: 'not-array' });
    expect(result?.steps).toBeUndefined();
  });

  it('extracts artifactRef, snapshotRef, and screenshotRef', () => {
    const result = extractBrowserReplay({
      toolName: 'browse_page',
      artifactRef: 'art-1',
      snapshotRef: 'snap-1',
      screenshotRef: 'screen-1'
    });
    expect(result?.artifactRef).toBe('art-1');
    expect(result?.snapshotRef).toBe('snap-1');
    expect(result?.screenshotRef).toBe('screen-1');
  });

  it('sets refs to undefined when not strings', () => {
    const result = extractBrowserReplay({
      toolName: 'browse_page',
      artifactRef: 123,
      snapshotRef: null,
      screenshotRef: undefined
    });
    expect(result?.artifactRef).toBeUndefined();
    expect(result?.snapshotRef).toBeUndefined();
    expect(result?.screenshotRef).toBeUndefined();
  });
});

describe('describeCapabilityApprovalReason', () => {
  it('returns critical message', () => {
    const result = describeCapabilityApprovalReason('GitHub', 'push', 'critical');
    expect(result).toContain('critical');
    expect(result).toContain('GitHub');
    expect(result).toContain('push');
  });

  it('returns high message', () => {
    const result = describeCapabilityApprovalReason('Browser', 'navigate', 'high');
    expect(result).toContain('high');
    expect(result).toContain('Browser');
  });

  it('returns default message for other risk levels', () => {
    const result = describeCapabilityApprovalReason('Lark', 'send', 'medium');
    expect(result).toContain('需审批');
    expect(result).toContain('Lark');
  });
});

describe('taskTouchesCapability', () => {
  it('returns true when summary contains tool name', () => {
    const task = { trace: [{ summary: 'Used GitHub push tool' }] };
    expect(taskTouchesCapability(task, 'github push')).toBe(true);
  });

  it('returns true when node contains tool name', () => {
    const task = { trace: [{ node: 'github_push_node' }] };
    expect(taskTouchesCapability(task, 'github_push')).toBe(true);
  });

  it('returns true when data contains tool name', () => {
    const task = { trace: [{ data: { tool: 'github_push' } }] };
    expect(taskTouchesCapability(task, 'github_push')).toBe(true);
  });

  it('returns false when no match', () => {
    const task = { trace: [{ summary: 'Something else' }] };
    expect(taskTouchesCapability(task, 'github_push')).toBe(false);
  });

  it('returns false when trace is empty', () => {
    expect(taskTouchesCapability({ trace: [] }, 'tool')).toBe(false);
  });

  it('returns false when trace is undefined', () => {
    expect(taskTouchesCapability({}, 'tool')).toBe(false);
  });

  it('performs case-insensitive matching', () => {
    const task = { trace: [{ summary: 'Used GITHUB PUSH' }] };
    expect(taskTouchesCapability(task, 'github push')).toBe(true);
  });
});

describe('findCapabilityTraceSummary', () => {
  it('returns summary when found', () => {
    const task = { trace: [{ summary: 'GitHub push executed', node: 'push_node' }] };
    expect(findCapabilityTraceSummary(task, 'github push')).toBe('GitHub push executed');
  });

  it('returns node when summary does not match but node does', () => {
    const task = { trace: [{ node: 'github_push_node' }] };
    expect(findCapabilityTraceSummary(task, 'github_push')).toBe('github_push_node');
  });

  it('returns undefined when no match', () => {
    const task = { trace: [{ summary: 'Something else' }] };
    expect(findCapabilityTraceSummary(task, 'nonexistent')).toBeUndefined();
  });

  it('returns undefined when trace is empty', () => {
    expect(findCapabilityTraceSummary({ trace: [] }, 'tool')).toBeUndefined();
  });

  it('returns undefined when trace is undefined', () => {
    expect(findCapabilityTraceSummary({}, 'tool')).toBeUndefined();
  });
});
