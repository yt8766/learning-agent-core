import type { RuntimeSettings } from '@agent/config';
import { ActionIntent } from '@agent/core';

import { BRIEFING_CATEGORY_TITLES } from './runtime-tech-briefing-sources';
import {
  BRIEFING_CATEGORY_SOURCE_GROUPS,
  BRIEFING_CATEGORY_SOURCE_LABELS
} from './runtime-tech-briefing-source-summary';
import { renderSummaryDigest } from './runtime-tech-briefing-localize';
import {
  buildSuppressedSummary,
  decideItemForSend,
  limitCategoryItems,
  mergeSameRunItems,
  toAuditRecord
} from './runtime-tech-briefing-category-processor';
import { collectBriefingCategoryItems } from './runtime-tech-briefing-category-collector';
import { deliverBriefingDigest } from './runtime-tech-briefing-delivery';
import {
  type BriefingCategoryConfig,
  type BriefingSettings,
  computeCronForCategory,
  nextBriefingScheduleState,
  resolveBriefingCategoryConfig,
  resolveBriefingLookbackDays,
  scheduleForCategory
} from './runtime-tech-briefing-schedule';
import {
  ensureDailyTechBriefingSchedules,
  readBriefingFeedback,
  readBriefingHistory,
  readBriefingScheduleState,
  readDailyTechBriefingStatus,
  saveBriefingScheduleState,
  saveDailyTechBriefingSchedule
} from './runtime-tech-briefing-storage';
import type {
  BriefingHistoryRecord,
  DailyTechBriefingStatusRecord,
  TechBriefingCategory,
  TechBriefingCategoryResult,
  TechBriefingCategoryScheduleState,
  TechBriefingDigestResult,
  TechBriefingItem,
  TechBriefingSourceGroup,
  TechBriefingRunRecord
} from './runtime-tech-briefing.types';

type ActionIntentValue = (typeof ActionIntent)[keyof typeof ActionIntent];

export interface RuntimeTechBriefingContext {
  settings: Pick<
    RuntimeSettings,
    'workspaceRoot' | 'zhipuApiKey' | 'zhipuApiBaseUrl' | 'zhipuModels' | 'providers' | 'dailyTechBriefing'
  > & {
    dailyTechBriefing: BriefingSettings;
  };
  fetchImpl?: typeof fetch;
  mcpClientManager?: {
    hasCapability: (capabilityId: string) => boolean;
    invokeTool: (
      toolName: string,
      request: {
        taskId: string;
        toolName: string;
        intent: ActionIntentValue;
        input: Record<string, unknown>;
        requestedBy: 'agent' | 'user';
      }
    ) => Promise<{
      ok: boolean;
      rawOutput?: unknown;
      errorMessage?: string;
    }>;
  };
  translateText?: (input: {
    category: TechBriefingCategory;
    title: string;
    summary: string;
    sourceName: string;
  }) => Promise<{ title: string; summary: string }>;
}

const ORDERED_BRIEFING_CATEGORIES: TechBriefingCategory[] = [
  'frontend-security',
  'general-security',
  'devtool-security',
  'ai-tech',
  'frontend-tech',
  'backend-tech',
  'cloud-infra-tech'
];

const MCP_DISCOVERY_QUERIES: Record<TechBriefingCategory, string[]> = {
  'frontend-security': ['frontend security advisory javascript npm chrome node.js'],
  'general-security': ['linux windows macos docker kubernetes postgres redis security advisory'],
  'devtool-security': ['claude code cursor mcp security advisory workspace trust'],
  'ai-tech': ['OpenAI Anthropic Google AI LangChain LangGraph AI release blog'],
  'frontend-tech': ['React Next.js Vue Vite TypeScript release blog'],
  'backend-tech': ['Node.js Bun Deno Go Rust Spring .NET release blog'],
  'cloud-infra-tech': ['Kubernetes Docker Terraform GitHub Actions GitLab CI release blog']
};

export class RuntimeTechBriefingService {
  private inFlight = false;

  constructor(private readonly getContext: () => RuntimeTechBriefingContext) {}

  async initializeSchedule() {
    const ctx = this.ctx();
    if (!ctx.settings.dailyTechBriefing.enabled) {
      return [];
    }
    return ensureDailyTechBriefingSchedules(
      ctx.settings.workspaceRoot,
      Object.fromEntries(
        ORDERED_BRIEFING_CATEGORIES.map(category => [
          category,
          {
            schedule: scheduleForCategory(
              category,
              this.categoryConfig(category),
              ctx.settings.dailyTechBriefing.schedule
            )
          }
        ])
      ) as Partial<Record<TechBriefingCategory, { schedule: string }>>
    );
  }

  async runScheduled(now = new Date(), categories: TechBriefingCategory[] = ORDERED_BRIEFING_CATEGORIES) {
    const ctx = this.ctx();
    if (!ctx.settings.dailyTechBriefing.enabled || this.inFlight) {
      return null;
    }
    this.inFlight = true;
    try {
      return await this.runNow(now, categories, { reason: 'scheduled' });
    } finally {
      this.inFlight = false;
    }
  }

  async forceRun(category: TechBriefingCategory, now = new Date()) {
    return this.runNow(now, [category], { reason: 'forced' });
  }

  async runNow(
    now = new Date(),
    categories = ORDERED_BRIEFING_CATEGORIES,
    options: { reason?: 'scheduled' | 'forced' | 'manual' } = {}
  ): Promise<TechBriefingRunRecord> {
    const history = await readBriefingHistory(this.ctx().settings.workspaceRoot);
    const historyMap = new Map(history.map(record => [record.messageKey, record] as const));
    const existingStates = await readBriefingScheduleState(this.ctx().settings.workspaceRoot);
    const categoryResults: TechBriefingCategoryResult[] = [];
    const nextStates = { ...existingStates } as Partial<
      Record<TechBriefingCategory, TechBriefingCategoryScheduleState>
    >;

    for (const category of categories) {
      const result = await this.processCategory(category, now, historyMap);
      categoryResults.push(result);
      nextStates[category] = this.nextScheduleState(category, existingStates[category], result, now, options.reason);
      await this.saveCategoryScheduleRecord(category, nextStates[category]!, now);
    }

    const digest = renderSummaryDigest({
      now,
      categories: categoryResults,
      sourceGroups: mergeSourceGroups(categories.map(category => BRIEFING_CATEGORY_SOURCE_GROUPS[category])),
      lookbackDaysByCategory: Object.fromEntries(
        ORDERED_BRIEFING_CATEGORIES.map(category => [category, this.lookbackDaysFor(category)])
      ) as Record<TechBriefingCategory, number>,
      sendEmptyDigest: this.ctx().settings.dailyTechBriefing.sendEmptyDigest,
      renderMode: this.ctx().settings.dailyTechBriefing.larkDigestMode,
      detailMode: this.ctx().settings.dailyTechBriefing.larkDetailMode ?? 'detailed'
    });

    await saveBriefingScheduleState(this.ctx().settings.workspaceRoot, nextStates);
    const { run } = await deliverBriefingDigest({
      workspaceRoot: this.ctx().settings.workspaceRoot,
      categories,
      categoryResults,
      digest,
      history,
      now,
      duplicateWindowDays: this.ctx().settings.dailyTechBriefing.duplicateWindowDays,
      larkDigestMode: this.ctx().settings.dailyTechBriefing.larkDigestMode,
      webhookUrl: this.ctx().settings.dailyTechBriefing.webhookUrl,
      fetchImpl: this.ctx().fetchImpl ?? fetch
    });
    return run;
  }

  async getStatus(): Promise<DailyTechBriefingStatusRecord> {
    const ctx = this.ctx();
    return readDailyTechBriefingStatus(ctx.settings.workspaceRoot, {
      enabled: ctx.settings.dailyTechBriefing.enabled,
      schedule: ctx.settings.dailyTechBriefing.schedule
    });
  }

  private async processCategory(
    category: TechBriefingCategory,
    now: Date,
    historyMap: Map<string, BriefingHistoryRecord>
  ): Promise<TechBriefingCategoryResult> {
    const title = `${BRIEFING_CATEGORY_TITLES[category]} | ${now.toISOString().slice(0, 10)}`;
    const sourcesChecked = BRIEFING_CATEGORY_SOURCE_LABELS[category];
    try {
      const items = await this.collectItems(category, now);
      const merged = mergeSameRunItems(items, historyMap);
      const decided = merged.primaryItems.map(item =>
        decideItemForSend(
          item,
          historyMap.get(item.messageKey ?? ''),
          now,
          this.ctx().settings.dailyTechBriefing.duplicateWindowDays
        )
      );
      const eligible = decided.filter(
        item =>
          item.decisionReason === 'send_new' ||
          item.decisionReason === 'send_update' ||
          item.decisionReason === 'critical_override'
      );
      const limited = limitCategoryItems(eligible, this.ctx().settings.dailyTechBriefing);
      const overflowTitles = eligible
        .filter(item => !limited.displayedItemIds.has(item.id))
        .map(item => item.cleanTitle ?? item.title)
        .slice(0, 6);

      return {
        category,
        title,
        status: limited.displayedItems.length === 0 ? 'empty' : 'sent',
        itemCount: limited.displayedItems.length,
        sent: false,
        emptyDigest: limited.displayedItems.length === 0,
        sourcesChecked,
        newCount: limited.displayedItems.filter(item => item.decisionReason === 'send_new').length,
        updateCount: limited.displayedItems.filter(item => item.decisionReason === 'send_update').length,
        crossRunSuppressedCount: decided.filter(item => item.decisionReason === 'suppress_duplicate').length,
        sameRunMergedCount: merged.sameRunMergedCount,
        overflowCollapsedCount: eligible.length - limited.displayedItems.length,
        suppressedSummary: buildSuppressedSummary(
          decided.filter(item => item.decisionReason === 'suppress_duplicate').length,
          merged.sameRunMergedCount,
          eligible.length - limited.displayedItems.length
        ),
        savedAttentionCount:
          decided.filter(item => item.decisionReason === 'suppress_duplicate').length +
          merged.sameRunMergedCount +
          Math.max(0, eligible.length - limited.displayedItems.length),
        displayedItemCount: limited.displayedItems.length,
        displayedItems: limited.displayedItems,
        overflowTitles,
        auditRecords: [
          ...decided.map(item => toAuditRecord(item, limited.displayedItemIds.has(item.id))),
          ...eligible
            .filter(item => !limited.displayedItemIds.has(item.id))
            .map(item => toAuditRecord({ ...item, decisionReason: 'overflow_collapsed' }, false))
        ]
      };
    } catch (error) {
      return {
        category,
        title,
        status: 'failed',
        itemCount: 0,
        sent: false,
        emptyDigest: false,
        sourcesChecked,
        newCount: 0,
        updateCount: 0,
        crossRunSuppressedCount: 0,
        sameRunMergedCount: 0,
        overflowCollapsedCount: 0,
        displayedItemCount: 0,
        displayedItems: [],
        overflowTitles: [],
        auditRecords: [],
        error: error instanceof Error ? error.message : 'daily_tech_briefing_failed'
      };
    }
  }

  private async collectItems(category: TechBriefingCategory, now: Date): Promise<TechBriefingItem[]> {
    return collectBriefingCategoryItems({
      category,
      now,
      lookbackDays: this.lookbackDaysFor(category),
      context: {
        workspaceRoot: this.ctx().settings.workspaceRoot,
        settings: {
          dailyTechBriefing: this.ctx().settings.dailyTechBriefing
        },
        fetchImpl: this.ctx().fetchImpl,
        mcpClientManager: this.ctx().mcpClientManager,
        translateText: this.ctx().translateText,
        readBriefingFeedback
      }
    });
  }

  private async saveCategoryScheduleRecord(
    category: TechBriefingCategory,
    state: TechBriefingCategoryScheduleState,
    now: Date
  ) {
    const schedule = await ensureDailyTechBriefingSchedules(this.ctx().settings.workspaceRoot, {
      [category]: {
        schedule: scheduleForCategory(
          category,
          { ...this.categoryConfig(category), baseIntervalHours: state.currentIntervalHours },
          this.ctx().settings.dailyTechBriefing.schedule
        )
      }
    });
    const record = schedule.find(item => item.category === category);
    if (!record) {
      return;
    }
    await saveDailyTechBriefingSchedule(this.ctx().settings.workspaceRoot, {
      ...record,
      schedule: scheduleForCategory(
        category,
        { ...this.categoryConfig(category), baseIntervalHours: state.currentIntervalHours },
        this.ctx().settings.dailyTechBriefing.schedule
      ),
      cron: computeCronForCategory(
        category,
        state.currentIntervalHours,
        this.ctx().settings.dailyTechBriefing.schedule
      ),
      scheduleValid: true,
      jobKey: `runtime-tech-briefing:${category}`,
      lastRegisteredAt: now.toISOString(),
      lastRunAt: state.lastRunAt,
      nextRunAt: state.nextRunAt,
      updatedAt: now.toISOString()
    });
  }

  private nextScheduleState(
    category: TechBriefingCategory,
    previous: TechBriefingCategoryScheduleState | undefined,
    result: TechBriefingCategoryResult,
    now: Date,
    reason: 'scheduled' | 'forced' | 'manual' = 'manual'
  ): TechBriefingCategoryScheduleState {
    return nextBriefingScheduleState({
      settings: this.ctx().settings.dailyTechBriefing,
      category,
      previous,
      result,
      now,
      reason
    });
  }

  private categoryConfig(category: TechBriefingCategory): BriefingCategoryConfig {
    return resolveBriefingCategoryConfig(this.ctx().settings.dailyTechBriefing, category);
  }

  private lookbackDaysFor(category: TechBriefingCategory) {
    return resolveBriefingLookbackDays(this.ctx().settings.dailyTechBriefing, category);
  }

  private ctx() {
    return this.getContext();
  }
}

function mergeSourceGroups(groups: Array<Record<TechBriefingSourceGroup, string[]>>) {
  return {
    official: Array.from(new Set(groups.flatMap(group => group.official))),
    authority: Array.from(new Set(groups.flatMap(group => group.authority))),
    community: Array.from(new Set(groups.flatMap(group => group.community)))
  } satisfies Record<TechBriefingSourceGroup, string[]>;
}
