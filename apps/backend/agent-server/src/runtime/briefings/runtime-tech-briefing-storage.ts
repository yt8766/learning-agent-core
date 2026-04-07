import { join } from 'node:path';

import { ensureDir, pathExists, readJson, readdir, writeJson } from 'fs-extra';

import { computeNextRunAt, resolveRuntimeSchedule } from '../schedules/runtime-schedule.helpers';
import type {
  BriefingFeedbackRecord,
  BriefingHistoryRecord,
  DailyTechBriefingScheduleRecord,
  DailyTechBriefingStatusRecord,
  TechBriefingCategory,
  TechBriefingCategoryScheduleState,
  TechBriefingRunRecord
} from './runtime-tech-briefing.types';

const BRIEFING_CATEGORIES: TechBriefingCategory[] = [
  'frontend-security',
  'general-security',
  'devtool-security',
  'ai-tech',
  'frontend-tech',
  'backend-tech',
  'cloud-infra-tech'
];

const MAX_BRIEFING_RUN_RECORDS = 200;
const BRIEFING_RUN_RETENTION_DAYS = 30;
const MAX_BRIEFING_HISTORY_RECORDS = 5000;

export async function ensureDailyTechBriefingSchedules(
  workspaceRoot: string,
  categories: Partial<Record<TechBriefingCategory, { schedule: string }>>
): Promise<DailyTechBriefingScheduleRecord[]> {
  const records: DailyTechBriefingScheduleRecord[] = [];
  for (const category of BRIEFING_CATEGORIES) {
    records.push(
      await ensureDailyTechBriefingSchedule(workspaceRoot, category, categories[category]?.schedule ?? 'manual')
    );
  }
  return records;
}

export async function ensureDailyTechBriefingSchedule(
  workspaceRoot: string,
  category: TechBriefingCategory,
  schedule: string
): Promise<DailyTechBriefingScheduleRecord> {
  const filePath = getSchedulePath(workspaceRoot, category);
  if (await pathExists(filePath)) {
    const existing = await readJsonFileOrDefault<DailyTechBriefingScheduleRecord | null>(filePath, null);
    if (existing) {
      return existing;
    }
  }
  const record = createDailyTechBriefingScheduleRecord(category, schedule, new Date());
  await ensureDir(join(workspaceRoot, 'data', 'runtime', 'schedules'));
  await writeJson(filePath, record, { spaces: 2 });
  return record;
}

export async function readDailyTechBriefingSchedules(
  workspaceRoot: string
): Promise<Partial<Record<TechBriefingCategory, DailyTechBriefingScheduleRecord>>> {
  const result: Partial<Record<TechBriefingCategory, DailyTechBriefingScheduleRecord>> = {};
  for (const category of BRIEFING_CATEGORIES) {
    const filePath = getSchedulePath(workspaceRoot, category);
    if (await pathExists(filePath)) {
      const record = await readJsonFileOrDefault<DailyTechBriefingScheduleRecord | null>(filePath, null);
      if (record) {
        result[category] = record;
      }
    }
  }
  return result;
}

export async function saveDailyTechBriefingSchedule(
  workspaceRoot: string,
  schedule: DailyTechBriefingScheduleRecord
): Promise<void> {
  await ensureDir(join(workspaceRoot, 'data', 'runtime', 'schedules'));
  await writeJson(getSchedulePath(workspaceRoot, schedule.category), schedule, { spaces: 2 });
}

export async function readBriefingScheduleState(
  workspaceRoot: string
): Promise<Partial<Record<TechBriefingCategory, TechBriefingCategoryScheduleState>>> {
  const filePath = getScheduleStatePath(workspaceRoot);
  if (!(await pathExists(filePath))) {
    return {};
  }
  return readJsonFileOrDefault(filePath, {});
}

export async function saveBriefingScheduleState(
  workspaceRoot: string,
  state: Partial<Record<TechBriefingCategory, TechBriefingCategoryScheduleState>>
): Promise<void> {
  await ensureDir(join(workspaceRoot, 'data', 'runtime', 'briefings'));
  await writeJson(getScheduleStatePath(workspaceRoot), state, { spaces: 2 });
}

export async function appendDailyTechBriefingRun(workspaceRoot: string, run: TechBriefingRunRecord): Promise<void> {
  const records = await readDailyTechBriefingRuns(workspaceRoot);
  records.unshift(run);
  await ensureDir(join(workspaceRoot, 'data', 'runtime', 'briefings'));
  await writeJson(getRunsPath(workspaceRoot), pruneRunRecords(records, new Date(run.runAt)), { spaces: 2 });
}

export async function readBriefingHistory(workspaceRoot: string): Promise<BriefingHistoryRecord[]> {
  const filePath = getHistoryPath(workspaceRoot);
  if (!(await pathExists(filePath))) {
    return [];
  }
  return readJsonFileOrDefault(filePath, []);
}

export async function saveBriefingHistory(
  workspaceRoot: string,
  records: BriefingHistoryRecord[],
  now = new Date(),
  duplicateWindowDays = 7
): Promise<void> {
  const cutoff = now.getTime() - duplicateWindowDays * 24 * 60 * 60 * 1000;
  const pruned = records.filter(record => {
    const sentAt = record.lastSentAt ? new Date(record.lastSentAt).getTime() : NaN;
    const seenAt = new Date(record.firstSeenAt).getTime();
    if (Number.isFinite(sentAt)) {
      return sentAt >= cutoff;
    }
    return seenAt >= cutoff;
  });
  await ensureDir(join(workspaceRoot, 'data', 'runtime', 'briefings'));
  await writeJson(getHistoryPath(workspaceRoot), pruneHistoryRecords(pruned), { spaces: 2 });
}

export async function readDailyTechBriefingRuns(workspaceRoot: string): Promise<TechBriefingRunRecord[]> {
  const filePath = getRunsPath(workspaceRoot);
  if (!(await pathExists(filePath))) {
    return [];
  }
  return readJsonFileOrDefault(filePath, []);
}

export async function readDailyTechBriefingStatus(
  workspaceRoot: string,
  defaults: Pick<DailyTechBriefingStatusRecord, 'enabled' | 'schedule'>
): Promise<DailyTechBriefingStatusRecord> {
  const [schedules, runs, scheduleStates] = await Promise.all([
    readDailyTechBriefingSchedules(workspaceRoot),
    readDailyTechBriefingRuns(workspaceRoot),
    readBriefingScheduleState(workspaceRoot)
  ]);
  const feedback = await readBriefingFeedback(workspaceRoot);
  const feedbackMap = new Map<string, { helpful: number; notHelpful: number }>();
  for (const record of feedback) {
    const current = feedbackMap.get(record.messageKey) ?? { helpful: 0, notHelpful: 0 };
    if (record.feedbackType === 'helpful') {
      current.helpful += 1;
    } else {
      current.notHelpful += 1;
    }
    feedbackMap.set(record.messageKey, current);
  }
  const latestSuccessfulRun = runs.find(run => run.status === 'sent');
  const categories = BRIEFING_CATEGORIES.map(category => {
    const latestCategory = runs.flatMap(run => run.categories).find(item => item.category === category);
    const categoryRuns = runs.map(run => run.categories.find(item => item.category === category)).filter(Boolean);
    const trendHighlights = summarizeTrendHighlights(categoryRuns);
    return latestCategory
      ? {
          category: latestCategory.category,
          title: latestCategory.title,
          status: latestCategory.status,
          itemCount: latestCategory.itemCount,
          emptyDigest: latestCategory.emptyDigest,
          scheduleState: scheduleStates[category],
          newCount: latestCategory.newCount,
          updateCount: latestCategory.updateCount,
          crossRunSuppressedCount: latestCategory.crossRunSuppressedCount,
          sameRunMergedCount: latestCategory.sameRunMergedCount,
          overflowCollapsedCount: latestCategory.overflowCollapsedCount,
          suppressedSummary:
            latestCategory.suppressedSummary ??
            summarizeSuppression(
              latestCategory.crossRunSuppressedCount,
              latestCategory.sameRunMergedCount,
              latestCategory.overflowCollapsedCount
            ),
          savedAttentionCount:
            latestCategory.savedAttentionCount ??
            (latestCategory.crossRunSuppressedCount ?? 0) +
              (latestCategory.sameRunMergedCount ?? 0) +
              (latestCategory.overflowCollapsedCount ?? 0),
          displayedItemCount: latestCategory.displayedItemCount,
          overflowTitles: latestCategory.overflowTitles,
          auditRecords: latestCategory.auditRecords?.map(record => ({
            ...record,
            helpful: feedbackMap.get(record.messageKey)?.helpful ?? 0,
            notHelpful: feedbackMap.get(record.messageKey)?.notHelpful ?? 0
          })),
          preferredSourceNames: summarizePreferredSourceNames(latestCategory.auditRecords ?? [], feedbackMap),
          preferredTopicLabels: summarizePreferredTopicLabels(latestCategory.auditRecords ?? [], feedbackMap),
          focusAreas: summarizeFocusAreas(latestCategory.auditRecords ?? [], feedbackMap),
          trendHighlights,
          helpful: (latestCategory.auditRecords ?? []).reduce(
            (sum, record) => sum + (feedbackMap.get(record.messageKey)?.helpful ?? 0),
            0
          ),
          notHelpful: (latestCategory.auditRecords ?? []).reduce(
            (sum, record) => sum + (feedbackMap.get(record.messageKey)?.notHelpful ?? 0),
            0
          ),
          sentAt: latestCategory.sentAt,
          error: latestCategory.error
        }
      : {
          category,
          title: category,
          status: 'skipped' as const,
          itemCount: 0,
          emptyDigest: true,
          scheduleState: scheduleStates[category],
          suppressedSummary: summarizeSuppression(0, 0, 0),
          savedAttentionCount: 0,
          preferredSourceNames: [],
          preferredTopicLabels: [],
          focusAreas: [],
          trendHighlights
        };
  });

  const latestRunAt = Object.values(scheduleStates)
    .map(item => item?.lastRunAt)
    .filter(Boolean)
    .sort()
    .at(-1);
  const latestSuccessAt = Object.values(scheduleStates)
    .map(item => item?.lastSuccessAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  return {
    enabled: defaults.enabled,
    schedule: defaults.schedule,
    cron: undefined,
    scheduleValid: Object.values(schedules).some(item => item?.scheduleValid),
    jobKey: undefined,
    lastRegisteredAt: Object.values(schedules)
      .map(item => item?.lastRegisteredAt)
      .filter(Boolean)
      .sort()
      .at(-1),
    scheduler: 'bree',
    timezone: Object.values(schedules)
      .map(item => item?.timezone)
      .find(Boolean),
    lastRunAt: latestRunAt,
    lastSuccessAt: latestSuccessAt ?? latestSuccessfulRun?.runAt,
    scheduleStates,
    recentRuns: runs.slice(0, 12),
    categories
  };
}

export async function listPersistedBriefingSchedules(
  workspaceRoot: string
): Promise<DailyTechBriefingScheduleRecord[]> {
  const scheduleDir = join(workspaceRoot, 'data', 'runtime', 'schedules');
  const entries = await readdir(scheduleDir).catch(() => []);
  const records: DailyTechBriefingScheduleRecord[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json') || !entry.startsWith('daily-tech-briefing-')) {
      continue;
    }
    const filePath = join(scheduleDir, entry);
    if (!(await pathExists(filePath))) {
      continue;
    }
    const record = await readJsonFileOrDefault<DailyTechBriefingScheduleRecord | null>(filePath, null);
    if (record) {
      records.push(record);
    }
  }
  return records;
}

export async function appendBriefingFeedback(workspaceRoot: string, feedback: BriefingFeedbackRecord): Promise<void> {
  const records = await readBriefingFeedback(workspaceRoot);
  records.unshift(feedback);
  await ensureDir(join(workspaceRoot, 'data', 'runtime', 'briefings'));
  await writeJson(getFeedbackPath(workspaceRoot), records.slice(0, 500), { spaces: 2 });
}

export async function readBriefingFeedback(workspaceRoot: string): Promise<BriefingFeedbackRecord[]> {
  const filePath = getFeedbackPath(workspaceRoot);
  if (!(await pathExists(filePath))) {
    return [];
  }
  return readJsonFileOrDefault(filePath, []);
}

async function readJsonFileOrDefault<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return (await readJson(filePath)) as T;
  } catch (error) {
    // Briefing runtime files are append-only operational state. If a file is truncated or partially written,
    // fall back to an empty structure so scheduled runs can self-heal on the next successful write.
    return fallback;
  }
}

function pruneRunRecords(records: TechBriefingRunRecord[], now = new Date()) {
  const cutoff = now.getTime() - BRIEFING_RUN_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return records
    .filter(record => new Date(record.runAt).getTime() >= cutoff)
    .sort((left, right) => new Date(right.runAt).getTime() - new Date(left.runAt).getTime())
    .slice(0, MAX_BRIEFING_RUN_RECORDS);
}

function pruneHistoryRecords(records: BriefingHistoryRecord[]) {
  return records
    .sort((left, right) => {
      const rightTime = new Date(right.lastSentAt ?? right.firstSeenAt).getTime();
      const leftTime = new Date(left.lastSentAt ?? left.firstSeenAt).getTime();
      return rightTime - leftTime;
    })
    .slice(0, MAX_BRIEFING_HISTORY_RECORDS);
}

function getSchedulePath(workspaceRoot: string, category: TechBriefingCategory) {
  return join(workspaceRoot, 'data', 'runtime', 'schedules', `daily-tech-briefing-${category}.json`);
}

function getRunsPath(workspaceRoot: string) {
  return join(workspaceRoot, 'data', 'runtime', 'briefings', 'daily-tech-briefing-runs.json');
}

function getHistoryPath(workspaceRoot: string) {
  return join(workspaceRoot, 'data', 'runtime', 'briefings', 'daily-tech-briefing-history.json');
}

function getScheduleStatePath(workspaceRoot: string) {
  return join(workspaceRoot, 'data', 'runtime', 'briefings', 'daily-tech-briefing-schedule-state.json');
}

function getFeedbackPath(workspaceRoot: string) {
  return join(workspaceRoot, 'data', 'runtime', 'briefings', 'daily-tech-briefing-feedback.json');
}

function createDailyTechBriefingScheduleRecord(
  category: TechBriefingCategory,
  schedule: string,
  now: Date
): DailyTechBriefingScheduleRecord {
  const resolution = resolveRuntimeSchedule(schedule);
  const nowIso = now.toISOString();
  return {
    id: `daily-tech-briefing-${category}`,
    name: `Daily Tech Briefing - ${category}`,
    kind: 'daily-tech-briefing',
    category,
    schedule,
    cron: resolution.cron,
    scheduleValid: resolution.scheduleValid,
    scheduler: 'bree',
    status: 'ACTIVE',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    source: 'runtime-bootstrap',
    createdAt: nowIso,
    updatedAt: nowIso,
    nextRunAt: resolution.mode === 'manual' ? undefined : computeNextRunAt(schedule, now).toISOString()
  };
}

function summarizeSuppression(crossRunSuppressedCount = 0, sameRunMergedCount = 0, overflowCollapsedCount = 0) {
  const total = crossRunSuppressedCount + sameRunMergedCount + overflowCollapsedCount;
  if (!total) {
    return '本轮无抑制，所有展示内容均为直接命中。';
  }
  return `本轮共节省 ${total} 条低价值噪音，其中跨轮去重 ${crossRunSuppressedCount}、同轮合并 ${sameRunMergedCount}、超上限折叠 ${overflowCollapsedCount}。`;
}

function summarizePreferredSourceNames(
  records: Array<{ messageKey: string; sourceName: string }>,
  feedbackMap: Map<string, { helpful: number; notHelpful: number }>
) {
  return rankByPreference(
    records.map(record => ({
      label: record.sourceName,
      score: scoreFeedback(feedbackMap.get(record.messageKey))
    }))
  );
}

function summarizePreferredTopicLabels(
  records: Array<{ messageKey: string; displayScope?: string; title: string }>,
  feedbackMap: Map<string, { helpful: number; notHelpful: number }>
) {
  return rankByPreference(
    records.flatMap(record => {
      const labels = extractTopicLabels(record.displayScope, record.title);
      const score = scoreFeedback(feedbackMap.get(record.messageKey));
      return labels.map(label => ({ label, score }));
    })
  );
}

function summarizeFocusAreas(
  records: Array<{ messageKey: string; impactScenarioTags?: string[]; category: TechBriefingCategory }>,
  feedbackMap: Map<string, { helpful: number; notHelpful: number }>
) {
  return rankByPreference(
    records.flatMap(record => {
      const labels = record.impactScenarioTags?.length
        ? record.impactScenarioTags
        : defaultFocusAreasByCategory(record.category);
      const score = Math.max(1, scoreFeedback(feedbackMap.get(record.messageKey)));
      return labels.map(label => ({ label, score }));
    })
  );
}

function summarizeTrendHighlights(
  categoryRuns: Array<{
    auditRecords?: Array<{ title: string; sent: boolean; updateStatus?: string }>;
  }>
) {
  const counts = new Map<string, { title: string; count: number; updates: number }>();
  for (const run of categoryRuns.slice(0, 6)) {
    for (const record of run.auditRecords ?? []) {
      if (!record.sent) {
        continue;
      }
      const key = record.title.trim().toLowerCase();
      const current = counts.get(key) ?? { title: record.title, count: 0, updates: 0 };
      current.count += 1;
      if (record.updateStatus && record.updateStatus !== 'new' && record.updateStatus !== 'metadata_only') {
        current.updates += 1;
      }
      counts.set(key, current);
    }
  }

  return Array.from(counts.values())
    .filter(item => item.count >= 2 || item.updates > 0)
    .sort(
      (left, right) => right.updates - left.updates || right.count - left.count || left.title.localeCompare(right.title)
    )
    .slice(0, 3)
    .map(item =>
      item.updates > 0
        ? `${item.title} 连续 ${item.count} 轮出现，含 ${item.updates} 次实质变化`
        : `${item.title} 连续 ${item.count} 轮进入简报`
    );
}

function rankByPreference(entries: Array<{ label: string; score: number }>) {
  const scores = new Map<string, number>();
  for (const entry of entries) {
    const label = entry.label.trim();
    if (!label) {
      continue;
    }
    scores.set(label, (scores.get(label) ?? 0) + entry.score);
  }
  return Array.from(scores.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .filter(([, score]) => score > 0)
    .slice(0, 4)
    .map(([label]) => label);
}

function scoreFeedback(feedback?: { helpful: number; notHelpful: number }) {
  if (!feedback) {
    return 1;
  }
  return Math.max(0, 1 + feedback.helpful * 2 - feedback.notHelpful);
}

function extractTopicLabels(displayScope?: string, title?: string) {
  const scopeLabels = (displayScope ?? '')
    .split(/[/,]/)
    .map(item => item.replace(/\(.*?\)/g, '').trim())
    .filter(Boolean);
  if (scopeLabels.length > 0) {
    return scopeLabels.slice(0, 3);
  }
  return (title ?? '')
    .split(/[:|-]/)
    .map(item => item.trim())
    .filter(item => item.length >= 3)
    .slice(0, 2);
}

function defaultFocusAreasByCategory(category: TechBriefingCategory) {
  switch (category) {
    case 'frontend-security':
      return ['SSR/BFF', '公共 API', '浏览器供应链'];
    case 'general-security':
      return ['K8s 控制面', '数据库', '云主机'];
    case 'devtool-security':
      return ['CI Runner', 'Agent 执行面', '开发凭证'];
    case 'ai-tech':
      return ['模型选型', 'Agent 编排', '推理成本'];
    case 'frontend-tech':
      return ['浏览器能力', '工程化链路', '框架升级'];
    case 'backend-tech':
      return ['运行时', '服务框架', '交付链路'];
    case 'cloud-infra-tech':
      return ['编排平台', 'CI/CD', '边缘与 Serverless'];
    default:
      return [];
  }
}
