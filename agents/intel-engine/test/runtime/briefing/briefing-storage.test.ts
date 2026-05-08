import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';
import { pathExists } from 'fs-extra';

import {
  appendBriefingFeedback,
  appendBriefingRawEvidence,
  appendDailyTechBriefingRun,
  createMemoryBriefingStorageRepository,
  ensureDailyTechBriefingSchedule,
  readBriefingFeedback,
  readBriefingHistory,
  readBriefingRawEvidence,
  readBriefingScheduleState,
  readDailyTechBriefingRuns,
  saveBriefingScheduleState,
  saveBriefingHistory
} from '../../../src/runtime/briefing/briefing-storage';
import { readDailyTechBriefingStatus } from '../../../src/runtime/briefing/briefing-status';
import { getStorageRoot } from '../../../src/runtime/briefing/briefing-paths';

describe('runtime-tech-briefing-storage', () => {
  let workspaceRoot = '';

  afterEach(async () => {
    if (workspaceRoot) {
      await rm(workspaceRoot, { recursive: true, force: true });
      workspaceRoot = '';
    }
  });

  it('默认 briefing storage 不再写入 root data/runtime 目录', async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'runtime-tech-briefing-owned-storage-'));

    await ensureDailyTechBriefingSchedule(workspaceRoot, 'frontend-security', 'daily 11:00');
    await saveBriefingScheduleState(workspaceRoot, {
      'frontend-security': {
        enabled: true,
        baseIntervalHours: 24,
        currentIntervalHours: 24,
        allowedIntervalHours: [24],
        lookbackDays: 7,
        lastRunAt: '2026-04-03T02:00:00.000Z',
        nextRunAt: '2026-04-04T02:00:00.000Z',
        consecutiveHotRuns: 0,
        consecutiveEmptyRuns: 0,
        recentRunStats: []
      }
    });
    await appendDailyTechBriefingRun(workspaceRoot, {
      id: 'run-owned-storage',
      runAt: '2026-04-03T02:00:00.000Z',
      status: 'sent',
      categories: []
    });
    await saveBriefingHistory(
      workspaceRoot,
      [
        {
          messageKey: 'frontend-security:axios',
          category: 'frontend-security',
          firstSeenAt: '2026-04-03T02:00:00.000Z',
          lastTitle: 'axios advisory',
          lastUrl: 'https://example.com/axios',
          lastSourceName: 'axios',
          lastPublishedAt: '2026-04-03T02:00:00.000Z',
          lastContentFingerprint: 'axios-advisory-fingerprint',
          lastDecision: 'send_new'
        }
      ],
      new Date('2026-04-03T02:00:00.000Z')
    );
    await appendBriefingFeedback(workspaceRoot, {
      id: 'feedback-owned-storage',
      messageKey: 'frontend-security:axios',
      category: 'frontend-security',
      feedbackType: 'helpful',
      createdAt: '2026-04-03T02:05:00.000Z'
    });
    await appendBriefingRawEvidence(workspaceRoot, 'frontend-security', new Date('2026-04-03T02:00:00.000Z'), [
      {
        provider: 'mcp-web-search',
        query: 'axios advisory',
        capturedAt: '2026-04-03T02:00:00.000Z',
        payload: { title: 'axios advisory' }
      }
    ]);

    await expect(pathExists(join(workspaceRoot, 'data', 'runtime'))).resolves.toBe(false);
  });

  it('支持注入 memory briefing repository 以绕过文件系统落盘', async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'runtime-tech-briefing-memory-storage-'));
    const repository = createMemoryBriefingStorageRepository();

    await appendDailyTechBriefingRun(
      workspaceRoot,
      {
        id: 'run-memory-storage',
        runAt: '2026-04-03T02:00:00.000Z',
        status: 'sent',
        categories: []
      },
      repository
    );
    await appendBriefingFeedback(
      workspaceRoot,
      {
        id: 'feedback-memory-storage',
        messageKey: 'frontend-security:axios',
        category: 'frontend-security',
        feedbackType: 'helpful',
        createdAt: '2026-04-03T02:05:00.000Z'
      },
      repository
    );

    await expect(readDailyTechBriefingRuns(workspaceRoot, repository)).resolves.toEqual([
      expect.objectContaining({ id: 'run-memory-storage' })
    ]);
    await expect(readBriefingFeedback(workspaceRoot, repository)).resolves.toEqual([
      expect.objectContaining({ id: 'feedback-memory-storage' })
    ]);
    await expect(pathExists(join(workspaceRoot, 'data'))).resolves.toBe(false);
  });

  it('对空 briefing 文件回退为默认值', async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'runtime-tech-briefing-storage-'));
    const briefingDir = getStorageRoot(workspaceRoot);
    await mkdir(briefingDir, { recursive: true });
    await writeFile(join(briefingDir, 'daily-tech-briefing-runs.json'), '', 'utf8');
    await writeFile(join(briefingDir, 'daily-tech-briefing-history.json'), '', 'utf8');
    await writeFile(join(briefingDir, 'daily-tech-briefing-feedback.json'), '', 'utf8');
    await writeFile(join(briefingDir, 'daily-tech-briefing-schedule-state.json'), '', 'utf8');

    await expect(readDailyTechBriefingRuns(workspaceRoot)).resolves.toEqual([]);
    await expect(readBriefingHistory(workspaceRoot)).resolves.toEqual([]);
    await expect(readBriefingFeedback(workspaceRoot)).resolves.toEqual([]);
    await expect(readBriefingScheduleState(workspaceRoot)).resolves.toEqual({});
  });

  it('自动清理过期和超量的 run 记录', async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'runtime-tech-briefing-runs-prune-'));

    await appendDailyTechBriefingRun(workspaceRoot, {
      id: 'old-run',
      runAt: '2026-02-01T00:00:00.000Z',
      status: 'sent',
      categories: []
    });

    for (let index = 0; index < 205; index += 1) {
      await appendDailyTechBriefingRun(workspaceRoot, {
        id: `run-${index}`,
        runAt: new Date(Date.UTC(2026, 3, 3, 0, index, 0)).toISOString(),
        status: 'sent',
        categories: []
      });
    }

    const runs = await readDailyTechBriefingRuns(workspaceRoot);
    expect(runs).toHaveLength(200);
    expect(runs.some(run => run.id === 'old-run')).toBe(false);
    expect(runs[0]?.id).toBe('run-204');
  });

  it('自动清理超量的 history 记录并保留最近项', async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'runtime-tech-briefing-history-prune-'));

    await saveBriefingHistory(
      workspaceRoot,
      Array.from({ length: 5005 }, (_, index) => ({
        messageKey: `message-${index}`,
        category: 'backend-tech' as const,
        firstSeenAt: new Date(Date.UTC(2026, 3, 1, 0, index, 0)).toISOString(),
        firstSentAt: new Date(Date.UTC(2026, 3, 1, 0, index, 0)).toISOString(),
        lastSentAt: new Date(Date.UTC(2026, 3, 1, 0, index, 0)).toISOString(),
        lastPublishedAt: new Date(Date.UTC(2026, 3, 1, 0, index, 0)).toISOString(),
        lastContentFingerprint: `fingerprint-${index}`,
        lastContentChangeAt: new Date(Date.UTC(2026, 3, 1, 0, index, 0)).toISOString(),
        lastTitle: `title-${index}`,
        lastUrl: `https://example.com/${index}`,
        lastSourceName: 'Node.js Blog',
        lastDecision: 'send_new' as const
      })),
      new Date('2026-04-03T00:00:00.000Z'),
      30
    );

    const history = await readBriefingHistory(workspaceRoot);
    expect(history).toHaveLength(5000);
    expect(history[0]?.messageKey).toBe('message-5004');
    expect(history.at(-1)?.messageKey).toBe('message-5');
  });

  it('聚合分类抑制摘要、关注面与连续变化信息', async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'runtime-tech-briefing-status-'));

    await appendDailyTechBriefingRun(workspaceRoot, {
      id: 'run-latest',
      runAt: '2026-04-03T02:00:00.000Z',
      status: 'sent',
      categories: [
        {
          category: 'backend-tech',
          title: '后端/全栈新技术',
          status: 'sent',
          itemCount: 1,
          sent: true,
          emptyDigest: false,
          sourcesChecked: ['Node.js Blog'],
          newCount: 1,
          updateCount: 0,
          crossRunSuppressedCount: 2,
          sameRunMergedCount: 1,
          overflowCollapsedCount: 0,
          displayedItemCount: 1,
          auditRecords: [
            {
              messageKey: 'backend-tech:node-24',
              title: 'Node.js 24 release candidate ships improved permission model',
              category: 'backend-tech',
              decisionReason: 'send_new',
              sourceName: 'Node.js Blog',
              sourceGroup: 'official',
              publishedAt: '2026-04-03T00:00:00.000Z',
              sent: true,
              crossVerified: false,
              displayScope: 'node.js / runtime (高度相关)',
              url: 'https://nodejs.org/en/blog/release',
              whyItMatters: '会影响运行时选型与服务端权限模型。',
              impactScenarioTags: ['运行时', '服务框架'],
              recommendedNextStep: '安排 Node 24 兼容性 PoC。'
            }
          ]
        }
      ]
    });

    await appendDailyTechBriefingRun(workspaceRoot, {
      id: 'run-previous',
      runAt: '2026-04-02T02:00:00.000Z',
      status: 'sent',
      categories: [
        {
          category: 'backend-tech',
          title: '后端/全栈新技术',
          status: 'sent',
          itemCount: 1,
          sent: true,
          emptyDigest: false,
          sourcesChecked: ['Node.js Blog'],
          newCount: 1,
          updateCount: 0,
          crossRunSuppressedCount: 0,
          sameRunMergedCount: 0,
          overflowCollapsedCount: 0,
          displayedItemCount: 1,
          auditRecords: [
            {
              messageKey: 'backend-tech:node-24',
              title: 'Node.js 24 release candidate ships improved permission model',
              category: 'backend-tech',
              decisionReason: 'send_new',
              sourceName: 'Node.js Blog',
              sourceGroup: 'official',
              publishedAt: '2026-04-02T00:00:00.000Z',
              sent: true,
              crossVerified: false,
              displayScope: 'node.js / runtime (高度相关)',
              url: 'https://nodejs.org/en/blog/release'
            }
          ]
        }
      ]
    });

    await appendBriefingFeedback(workspaceRoot, {
      id: 'feedback-1',
      messageKey: 'backend-tech:node-24',
      category: 'backend-tech',
      feedbackType: 'helpful',
      reasonTag: 'useful-actionable',
      createdAt: '2026-04-03T02:05:00.000Z'
    });

    const status = await readDailyTechBriefingStatus(workspaceRoot, {
      enabled: true,
      schedule: 'daily 11:00'
    });
    const category = status.categories.find(item => item.category === 'backend-tech');

    expect(category?.savedAttentionCount).toBe(3);
    expect(category?.suppressedSummary).toContain('本轮共节省 3 条低价值噪音');
    expect(category?.preferredSourceNames).toContain('Node.js Blog');
    expect(category?.preferredTopicLabels).toContain('node.js');
    expect(category?.focusAreas).toContain('运行时');
    expect(category?.trendHighlights?.[0]).toContain('连续 2 轮');
  });

  it('保存 MCP 搜索 raw evidence 以支持后续误报追溯', async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'runtime-tech-briefing-raw-evidence-'));

    await appendBriefingRawEvidence(workspaceRoot, 'devtool-security', new Date('2026-04-03T02:00:00.000Z'), [
      {
        provider: 'mcp-web-search',
        query: 'Claude Code security incident source code leak latest',
        capturedAt: '2026-04-03T02:00:00.000Z',
        payload: {
          url: 'https://www.anthropic.com/news/claude-code-security-update',
          title: 'Claude Code security update'
        }
      }
    ]);

    const records = await readBriefingRawEvidence(
      workspaceRoot,
      'devtool-security',
      new Date('2026-04-03T02:00:00.000Z')
    );
    expect(records).toHaveLength(1);
    expect(records[0]?.query).toContain('Claude Code');
    expect(records[0]?.payload).toEqual(
      expect.objectContaining({
        url: 'https://www.anthropic.com/news/claude-code-security-update'
      })
    );
  });
});
