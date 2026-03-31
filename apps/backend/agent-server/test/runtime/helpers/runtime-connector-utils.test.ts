import { describe, expect, it } from 'vitest';

import {
  describeCapabilityApprovalReason,
  extractBrowserReplay,
  findCapabilityTraceSummary,
  taskTouchesCapability
} from '../../../src/runtime/helpers/runtime-connector-utils';

describe('runtime-connector-utils', () => {
  it('会从浏览器 trace 数据中提取 replay 视图', () => {
    const replay = extractBrowserReplay({
      toolName: 'browse_page',
      sessionId: 'browser-1',
      url: 'https://example.com',
      snapshotSummary: 'captured page state',
      screenshotRef: 'artifact://shot-1',
      stepTrace: ['open page', 'capture screenshot']
    });

    expect(replay).toEqual(
      expect.objectContaining({
        sessionId: 'browser-1',
        url: 'https://example.com',
        screenshotRef: 'artifact://shot-1',
        stepTrace: ['open page', 'capture screenshot']
      })
    );
  });

  it('会为 capability 审批生成稳定说明', () => {
    expect(describeCapabilityApprovalReason('GitHub MCP', 'github.create_issue_comment', 'high')).toContain(
      '必须人工确认'
    );
  });

  it('会判断任务是否命中某个 capability 并返回摘要', () => {
    const task = {
      trace: [
        {
          node: 'tool_called',
          summary: 'called github.search_repos',
          data: { toolName: 'github.search_repos' }
        }
      ]
    } as any;

    expect(taskTouchesCapability(task, 'github.search_repos')).toBe(true);
    expect(findCapabilityTraceSummary(task, 'github.search_repos')).toBe('called github.search_repos');
  });
});
