import { createHash } from 'node:crypto';
import { ActionIntent } from '@agent/shared';

import {
  BRIEFING_CATEGORY_TITLES,
  FEED_SOURCES,
  FRONTEND_SECURITY_PAGE_SOURCES,
  FRONTEND_SECURITY_SOURCES
} from './runtime-tech-briefing-sources';
import {
  BRIEFING_CATEGORY_SOURCE_GROUPS,
  BRIEFING_CATEGORY_SOURCE_LABELS
} from './runtime-tech-briefing-source-summary';
import { computePriorityScore, renderSummaryDigest } from './runtime-tech-briefing-localize';
import { sendLarkDigestMessage } from './runtime-tech-briefing-lark';
import { collectFeedItems, collectNvdItems, collectSecurityPageItems } from './runtime-tech-briefing-parsers';
import { finalizeItemsForRanking, rankItems } from './runtime-tech-briefing-ranking';
import { translateBriefingItems } from './runtime-tech-briefing-translate';
import {
  appendDailyTechBriefingRun,
  ensureDailyTechBriefingSchedules,
  readBriefingFeedback,
  readBriefingHistory,
  readBriefingScheduleState,
  readDailyTechBriefingStatus,
  saveBriefingHistory,
  saveBriefingScheduleState,
  saveDailyTechBriefingSchedule
} from './runtime-tech-briefing-storage';
import { computeNextRunAt, resolveRuntimeSchedule } from '../schedules/runtime-schedule.helpers';
import type {
  BriefingAuditRecord,
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

type BriefingCategoryConfig = {
  enabled: boolean;
  baseIntervalHours: number;
  lookbackDays: number;
  adaptivePolicy: {
    hotThresholdRuns: number;
    cooldownEmptyRuns: number;
    allowedIntervalHours: number[];
  };
};

type BriefingSettings = {
  enabled: boolean;
  schedule: string;
  sendEmptyDigest: boolean;
  maxItemsPerCategory: number;
  duplicateWindowDays: number;
  maxNonCriticalItemsPerCategory: number;
  maxCriticalItemsPerCategory: number;
  maxTotalItemsPerCategory: number;
  sendOnlyDelta: boolean;
  resendOnlyOnMaterialChange: boolean;
  larkDigestMode: 'markdown-summary' | 'interactive-card' | 'dual';
  larkDetailMode?: 'summary' | 'detailed';
  sourcePolicy: 'tiered-authority' | 'official-only';
  webhookEnvVar: string;
  webhookUrl?: string;
  translationEnabled: boolean;
  translationModel: string;
  aiLookbackDays: number;
  frontendLookbackDays: number;
  securityLookbackDays: number;
  categories?: {
    frontendSecurity?: BriefingCategoryConfig;
    generalSecurity?: BriefingCategoryConfig;
    devtoolSecurity?: BriefingCategoryConfig;
    aiTech?: BriefingCategoryConfig;
    frontendTech?: BriefingCategoryConfig;
    backendTech?: BriefingCategoryConfig;
    cloudInfraTech?: BriefingCategoryConfig;
  };
};

export interface RuntimeTechBriefingContext {
  settings: {
    workspaceRoot: string;
    zhipuApiKey?: string;
    zhipuApiBaseUrl?: string;
    zhipuModels?: {
      manager: string;
      research: string;
      executor: string;
      reviewer: string;
    };
    providers?: Array<{
      id: string;
      type: 'zhipu' | 'openai' | 'openai-compatible' | 'ollama' | 'anthropic';
      displayName?: string;
      apiKey?: string;
      baseUrl?: string;
      models: string[];
      roleModels?: Partial<Record<'manager' | 'research' | 'executor' | 'reviewer', string>>;
    }>;
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
        intent: ActionIntent;
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

    const sent = await this.sendDigest(digest);
    await saveBriefingScheduleState(this.ctx().settings.workspaceRoot, nextStates);

    if (sent) {
      await saveBriefingHistory(
        this.ctx().settings.workspaceRoot,
        updateHistoryRecords(history, categoryResults, now),
        now,
        this.ctx().settings.dailyTechBriefing.duplicateWindowDays
      );
    }

    const finalizedCategories = categoryResults.map(category => finalizeCategoryStatus(category, sent));
    const run: TechBriefingRunRecord = {
      id: createHash('sha1')
        .update(
          `${now.toISOString()}:${categories.join('|')}:${finalizedCategories.map(item => item.status).join('|')}`
        )
        .digest('hex')
        .slice(0, 12),
      runAt: now.toISOString(),
      status: finalizedCategories.every(
        item => item.status === 'sent' || item.status === 'empty' || item.status === 'skipped'
      )
        ? 'sent'
        : finalizedCategories.some(item => item.status === 'sent' || item.status === 'empty')
          ? 'partial'
          : 'failed',
      categories: finalizedCategories,
      digest: {
        title: digest.title,
        mode: categories.length === ORDERED_BRIEFING_CATEGORIES.length ? 'single-summary-card' : 'per-category',
        categoryCount: digest.categoryCount,
        newCount: digest.newCount,
        updateCount: digest.updateCount,
        crossRunSuppressedCount: digest.crossRunSuppressedCount,
        sameRunMergedCount: digest.sameRunMergedCount,
        overflowCollapsedCount: digest.overflowCollapsedCount
      }
    };
    await appendDailyTechBriefingRun(this.ctx().settings.workspaceRoot, run);
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
    const fetchImpl = this.ctx().fetchImpl ?? fetch;
    if (category === 'frontend-security' || category === 'general-security' || category === 'devtool-security') {
      const items = await Promise.allSettled([
        ...(category === 'frontend-security' || category === 'general-security'
          ? FRONTEND_SECURITY_SOURCES.filter(source => source.category === category).map(source =>
              collectNvdItems(source, now, this.lookbackDaysFor(category), fetchImpl)
            )
          : []),
        ...FRONTEND_SECURITY_PAGE_SOURCES.filter(source => source.category === category).map(source =>
          collectSecurityPageItems(source, now, this.lookbackDaysFor(category), fetchImpl)
        )
      ]);
      const normalized = items.flatMap(result => (result.status === 'fulfilled' ? result.value : []));
      const supplemental = await this.collectSearchMcpItems(category, now);
      const finalized = await finalizeItemsForRanking(category, normalized, this.ctx().settings.workspaceRoot);
      const translated = await translateBriefingItems(
        category,
        rankItems(category, finalized.concat(supplemental), this.ctx().settings.dailyTechBriefing.sourcePolicy),
        { settings: this.ctx().settings as any, translateText: this.ctx().translateText }
      );
      return this.applyPreferenceRanking(
        category,
        translated.map(item => enrichActionMetadata(item))
      );
    }

    const categorySources = FEED_SOURCES.filter(source => source.category === category);
    const settled = await Promise.allSettled(
      categorySources.map(source => collectFeedItems(source, category, now, this.lookbackDaysFor(category), fetchImpl))
    );
    const finalized = await finalizeItemsForRanking(
      category,
      settled.flatMap(result => (result.status === 'fulfilled' ? result.value : [])),
      this.ctx().settings.workspaceRoot
    );
    const supplemental = await this.collectSearchMcpItems(category, now);
    const translated = await translateBriefingItems(
      category,
      rankItems(category, finalized.concat(supplemental), this.ctx().settings.dailyTechBriefing.sourcePolicy),
      { settings: this.ctx().settings as any, translateText: this.ctx().translateText }
    );
    return this.applyPreferenceRanking(
      category,
      translated.map(item => enrichActionMetadata(item))
    );
  }

  private async collectSearchMcpItems(category: TechBriefingCategory, now: Date): Promise<TechBriefingItem[]> {
    const mcpClientManager = this.ctx().mcpClientManager;
    if (!mcpClientManager?.hasCapability('webSearchPrime')) {
      return [];
    }

    const candidates: TechBriefingItem[] = [];
    for (const query of MCP_DISCOVERY_QUERIES[category] ?? []) {
      const result = await mcpClientManager.invokeTool('webSearchPrime', {
        taskId: `briefing-${category}-${now.getTime()}`,
        toolName: 'webSearchPrime',
        intent: ActionIntent.CALL_EXTERNAL_API,
        input: {
          query,
          goal: `Collect latest ${category} briefing updates`,
          freshnessHint: category.includes('security') ? 'urgent' : 'recent'
        },
        requestedBy: 'agent'
      });
      if (!result.ok) {
        continue;
      }
      candidates.push(...toMcpSearchItems(category, now, result.rawOutput));
    }

    return dedupeMcpSearchItems(candidates);
  }

  private async sendDigest(digest: TechBriefingDigestResult) {
    const webhookUrl = this.ctx().settings.dailyTechBriefing.webhookUrl;
    const fetchImpl = this.ctx().fetchImpl ?? fetch;
    if (!digest.categoryCount) {
      return false;
    }
    const response = await sendLarkDigestMessage({
      title: digest.title,
      content: digest.content,
      card: digest.card,
      renderMode: this.ctx().settings.dailyTechBriefing.larkDigestMode,
      webhookUrl,
      fetchImpl
    });
    return !('skipped' in response);
  }

  private async applyPreferenceRanking(category: TechBriefingCategory, items: TechBriefingItem[]) {
    if (items.length <= 1) {
      return items;
    }
    const feedback = await readBriefingFeedback(this.ctx().settings.workspaceRoot);
    if (feedback.length === 0) {
      return items;
    }

    const positiveSourceNames = new Set<string>();
    const negativeSourceNames = new Set<string>();
    const positiveReasonTags = new Set<string>();
    const negativeReasonTags = new Set<string>();
    const feedbackByKey = new Map<string, { helpful: number; notHelpful: number }>();

    for (const record of feedback) {
      if (record.category !== category) {
        continue;
      }
      const current = feedbackByKey.get(record.messageKey) ?? { helpful: 0, notHelpful: 0 };
      if (record.feedbackType === 'helpful') {
        current.helpful += 1;
        if (record.reasonTag) {
          positiveReasonTags.add(record.reasonTag);
        }
      } else {
        current.notHelpful += 1;
        if (record.reasonTag) {
          negativeReasonTags.add(record.reasonTag);
        }
      }
      feedbackByKey.set(record.messageKey, current);
    }

    for (const item of items) {
      const stats = feedbackByKey.get(item.messageKey ?? '');
      if (!stats) {
        continue;
      }
      if (stats.helpful > stats.notHelpful) {
        positiveSourceNames.add(item.sourceName);
      }
      if (stats.notHelpful > stats.helpful) {
        negativeSourceNames.add(item.sourceName);
      }
    }

    return items
      .map((item, index) => ({
        item,
        index,
        preferenceScore: computePreferenceScore(item, {
          positiveSourceNames,
          negativeSourceNames,
          positiveReasonTags,
          negativeReasonTags
        })
      }))
      .sort((left, right) => right.preferenceScore - left.preferenceScore || left.index - right.index)
      .map(entry => entry.item);
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
    const config = this.categoryConfig(category);
    const allowed = [...config.adaptivePolicy.allowedIntervalHours].sort((left, right) => left - right);
    const previousInterval = previous?.currentIntervalHours ?? config.baseIntervalHours;
    const hot = (result.newCount ?? 0) + (result.updateCount ?? 0) > 0 && result.displayedItems?.some(isCriticalItem);
    const consecutiveHotRuns = hot ? (previous?.consecutiveHotRuns ?? 0) + 1 : 0;
    const consecutiveEmptyRuns = result.itemCount === 0 ? (previous?.consecutiveEmptyRuns ?? 0) + 1 : 0;

    let nextInterval = previousInterval;
    let lastAdaptiveReason = previous?.lastAdaptiveReason;
    if (consecutiveHotRuns >= config.adaptivePolicy.hotThresholdRuns) {
      nextInterval = nextLowerInterval(allowed, previousInterval);
      lastAdaptiveReason = nextInterval !== previousInterval ? 'hot_streak' : previous?.lastAdaptiveReason;
    } else if (consecutiveEmptyRuns >= config.adaptivePolicy.cooldownEmptyRuns) {
      nextInterval = nextHigherInterval(allowed, previousInterval);
      lastAdaptiveReason = nextInterval !== previousInterval ? 'cooldown' : previous?.lastAdaptiveReason;
    } else if (!previous) {
      nextInterval = config.baseIntervalHours;
      lastAdaptiveReason = reason === 'forced' ? 'manual_reset' : previous?.lastAdaptiveReason;
    }

    const runAt = now.toISOString();
    return {
      enabled: config.enabled,
      baseIntervalHours: config.baseIntervalHours,
      currentIntervalHours: nextInterval,
      allowedIntervalHours: allowed,
      lookbackDays: config.lookbackDays,
      lastRunAt: runAt,
      nextRunAt: new Date(now.getTime() + nextInterval * 60 * 60 * 1000).toISOString(),
      lastSuccessAt: result.status === 'failed' ? previous?.lastSuccessAt : runAt,
      lastHotAt: hot ? runAt : previous?.lastHotAt,
      consecutiveHotRuns,
      consecutiveEmptyRuns,
      lastAdaptiveReason,
      recentRunStats: [
        {
          runAt,
          itemCount: result.itemCount,
          newCount: result.newCount ?? 0,
          updateCount: result.updateCount ?? 0,
          hot,
          status: result.status
        },
        ...(previous?.recentRunStats ?? [])
      ].slice(0, 6)
    };
  }

  private categoryConfig(category: TechBriefingCategory): BriefingCategoryConfig {
    const settings = this.ctx().settings.dailyTechBriefing;
    const explicit = settings.categories;
    switch (category) {
      case 'frontend-security':
        return (
          explicit?.frontendSecurity ?? {
            enabled: true,
            baseIntervalHours: 4,
            lookbackDays: 3,
            adaptivePolicy: { hotThresholdRuns: 2, cooldownEmptyRuns: 6, allowedIntervalHours: [2, 4, 8] }
          }
        );
      case 'general-security':
        return (
          explicit?.generalSecurity ?? {
            enabled: true,
            baseIntervalHours: 4,
            lookbackDays: settings.securityLookbackDays,
            adaptivePolicy: { hotThresholdRuns: 2, cooldownEmptyRuns: 6, allowedIntervalHours: [2, 4, 8] }
          }
        );
      case 'devtool-security':
        return (
          explicit?.devtoolSecurity ?? {
            enabled: true,
            baseIntervalHours: 4,
            lookbackDays: 7,
            adaptivePolicy: { hotThresholdRuns: 2, cooldownEmptyRuns: 6, allowedIntervalHours: [2, 4, 8] }
          }
        );
      case 'ai-tech':
        return (
          explicit?.aiTech ?? {
            enabled: true,
            baseIntervalHours: 24,
            lookbackDays: settings.aiLookbackDays,
            adaptivePolicy: { hotThresholdRuns: 2, cooldownEmptyRuns: 6, allowedIntervalHours: [12, 24, 48] }
          }
        );
      case 'frontend-tech':
        return (
          explicit?.frontendTech ?? {
            enabled: true,
            baseIntervalHours: 24,
            lookbackDays: settings.frontendLookbackDays,
            adaptivePolicy: { hotThresholdRuns: 2, cooldownEmptyRuns: 6, allowedIntervalHours: [12, 24, 48] }
          }
        );
      case 'backend-tech':
        return (
          explicit?.backendTech ?? {
            enabled: true,
            baseIntervalHours: 24,
            lookbackDays: 7,
            adaptivePolicy: { hotThresholdRuns: 2, cooldownEmptyRuns: 6, allowedIntervalHours: [12, 24, 48] }
          }
        );
      default:
        return (
          explicit?.cloudInfraTech ?? {
            enabled: true,
            baseIntervalHours: 24,
            lookbackDays: 7,
            adaptivePolicy: { hotThresholdRuns: 2, cooldownEmptyRuns: 6, allowedIntervalHours: [12, 24, 48] }
          }
        );
    }
  }

  private lookbackDaysFor(category: TechBriefingCategory) {
    return this.categoryConfig(category).lookbackDays;
  }

  private ctx() {
    return this.getContext();
  }
}

function toMcpSearchItems(category: TechBriefingCategory, now: Date, payload: unknown): TechBriefingItem[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }
  const results = Array.isArray((payload as { results?: unknown[] }).results)
    ? ((payload as { results?: unknown[] }).results as unknown[])
    : [];

  return results
    .map(result => toMcpSearchItem(category, now, result))
    .filter((item): item is TechBriefingItem => Boolean(item));
}

function toMcpSearchItem(category: TechBriefingCategory, now: Date, result: unknown): TechBriefingItem | undefined {
  if (!result || typeof result !== 'object') {
    return undefined;
  }
  const raw = result as Record<string, unknown>;
  const url = typeof raw.url === 'string' ? raw.url : undefined;
  const title = typeof raw.title === 'string' ? raw.title : undefined;
  const summary = typeof raw.summary === 'string' ? raw.summary : undefined;
  if (!url || !title || !summary) {
    return undefined;
  }

  const sourceMeta = resolveSearchSourceMeta(category, url);
  if (!sourceMeta) {
    return undefined;
  }

  return {
    id: createHash('sha1').update(`mcp:${category}:${url}`).digest('hex').slice(0, 12),
    category,
    title,
    cleanTitle: title,
    url,
    publishedAt: typeof raw.fetchedAt === 'string' ? raw.fetchedAt : now.toISOString(),
    sourceName: sourceMeta.name,
    sourceUrl: sourceMeta.sourceUrl,
    sourceType: 'official-page',
    authorityTier: sourceMeta.authorityTier,
    sourceGroup: sourceMeta.sourceGroup,
    contentKind: sourceMeta.contentKind,
    summary,
    confidence: 0.72,
    sourceLabel: `${sourceMeta.name} / MCP Search`,
    relevanceReason: `由 BigModel Web Search MCP 补充发现，命中 ${category} 白名单来源`,
    technicalityScore: 3,
    crossVerified: false
  };
}

function resolveSearchSourceMeta(category: TechBriefingCategory, url: string) {
  const hostname = safeHostname(url);
  if (!hostname) {
    return undefined;
  }

  const allSources = [
    ...FEED_SOURCES.filter(source => source.category === category).map(source => ({
      name: source.name,
      sourceUrl: source.sourceUrl,
      authorityTier: source.authorityTier,
      sourceGroup: source.sourceGroup,
      contentKind: source.contentKind
    })),
    ...FRONTEND_SECURITY_PAGE_SOURCES.filter(source => source.category === category).map(source => ({
      name: source.name,
      sourceUrl: source.sourceUrl,
      authorityTier: source.authorityTier,
      sourceGroup: source.sourceGroup,
      contentKind: source.contentKind
    }))
  ];

  return allSources.find(source => {
    const sourceHost = safeHostname(source.sourceUrl);
    return sourceHost ? hostname === sourceHost || hostname.endsWith(`.${sourceHost}`) : false;
  });
}

function safeHostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

function dedupeMcpSearchItems(items: TechBriefingItem[]) {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = `${item.category}:${item.url}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function mergeSourceGroups(groups: Array<Record<TechBriefingSourceGroup, string[]>>) {
  return {
    official: Array.from(new Set(groups.flatMap(group => group.official))),
    authority: Array.from(new Set(groups.flatMap(group => group.authority))),
    community: Array.from(new Set(groups.flatMap(group => group.community)))
  } satisfies Record<TechBriefingSourceGroup, string[]>;
}

function mergeSameRunItems(items: TechBriefingItem[], historyMap: Map<string, BriefingHistoryRecord>) {
  const clusters = new Map<string, TechBriefingItem[]>();
  for (const item of items) {
    const key = item.messageKey ?? item.stableTopicKey ?? item.id;
    clusters.set(key, [...(clusters.get(key) ?? []), item]);
  }
  const primaryItems: TechBriefingItem[] = [];
  let sameRunMergedCount = 0;
  for (const [key, grouped] of clusters) {
    if (grouped.length === 1) {
      primaryItems.push(grouped[0]);
      continue;
    }
    sameRunMergedCount += grouped.length - 1;
    const previousSource = historyMap.get(key)?.lastSourceName;
    const primary = [...grouped].sort((left, right) => {
      const previousGap = Number(right.sourceName === previousSource) - Number(left.sourceName === previousSource);
      if (previousGap !== 0) {
        return previousGap;
      }
      const sourceGap = sourceGroupWeight(right.sourceGroup) - sourceGroupWeight(left.sourceGroup);
      if (sourceGap !== 0) {
        return sourceGap;
      }
      const authorityGap = sourceAuthorityWeight(right.authorityTier) - sourceAuthorityWeight(left.authorityTier);
      if (authorityGap !== 0) {
        return authorityGap;
      }
      return computePriorityScore(left.category, right) - computePriorityScore(left.category, left);
    })[0];
    primaryItems.push({ ...primary, crossVerified: true });
  }
  return { primaryItems, sameRunMergedCount };
}

function decideItemForSend(
  item: TechBriefingItem,
  history: BriefingHistoryRecord | undefined,
  now: Date,
  duplicateWindowDays: number
): TechBriefingItem {
  if (!history) {
    return { ...item, decisionReason: shouldBypassDuplicateWindow(item) ? 'critical_override' : 'send_new' };
  }
  const withinWindow =
    now.getTime() - new Date(history.lastSentAt ?? history.firstSeenAt).getTime() <=
    duplicateWindowDays * 24 * 60 * 60 * 1000;
  if (!withinWindow) {
    return { ...item, decisionReason: shouldBypassDuplicateWindow(item) ? 'critical_override' : 'send_new' };
  }
  if (history.lastContentFingerprint !== item.contentFingerprint && item.isMaterialChange) {
    return { ...item, decisionReason: shouldBypassDuplicateWindow(item) ? 'critical_override' : 'send_update' };
  }
  return { ...item, decisionReason: 'suppress_duplicate' };
}

function limitCategoryItems(items: TechBriefingItem[], config: BriefingSettings) {
  const critical = items.filter(isCriticalItem).slice(0, config.maxCriticalItemsPerCategory);
  const nonCritical = items.filter(item => !isCriticalItem(item)).slice(0, config.maxNonCriticalItemsPerCategory);
  const displayedItems = [...critical, ...nonCritical]
    .sort((left, right) => {
      const severityGap = severityWeight(right.displaySeverity) - severityWeight(left.displaySeverity);
      if (severityGap !== 0) {
        return severityGap;
      }
      const priorityGap = computePriorityScore(left.category, right) - computePriorityScore(left.category, left);
      if (priorityGap !== 0) {
        return priorityGap;
      }
      return right.publishedAt.localeCompare(left.publishedAt);
    })
    .slice(0, config.maxTotalItemsPerCategory);
  return {
    displayedItems,
    displayedItemIds: new Set(displayedItems.map(item => item.id))
  };
}

function updateHistoryRecords(existing: BriefingHistoryRecord[], categories: TechBriefingCategoryResult[], now: Date) {
  const map = new Map(existing.map(record => [record.messageKey, record] as const));
  const nowIso = now.toISOString();
  for (const category of categories) {
    for (const item of category.displayedItems ?? []) {
      const messageKey = item.messageKey;
      const contentFingerprint = item.contentFingerprint;
      if (!messageKey || !contentFingerprint) {
        continue;
      }
      const record = map.get(messageKey);
      map.set(messageKey, {
        messageKey,
        category: item.category,
        firstSeenAt: record?.firstSeenAt ?? nowIso,
        firstSentAt: record?.firstSentAt ?? nowIso,
        lastSentAt: nowIso,
        lastPublishedAt: item.publishedAt,
        lastContentFingerprint: contentFingerprint,
        lastContentChangeAt:
          !record || record.lastContentFingerprint !== contentFingerprint
            ? nowIso
            : (record.lastContentChangeAt ?? nowIso),
        lastTitle: item.cleanTitle ?? item.title,
        lastUrl: item.url,
        lastSourceName: item.sourceName,
        lastDecision: item.decisionReason ?? 'send_new'
      });
    }
  }
  return [...map.values()];
}

function finalizeCategoryStatus(category: TechBriefingCategoryResult, sent: boolean): TechBriefingCategoryResult {
  if (category.status === 'failed') {
    return category;
  }
  if ((category.displayedItems?.length ?? 0) === 0) {
    return { ...category, status: category.emptyDigest ? 'empty' : 'skipped', sent };
  }
  return {
    ...category,
    status: sent ? 'sent' : 'failed',
    sent,
    sentAt: sent ? new Date().toISOString() : undefined,
    error: sent ? undefined : (category.error ?? 'daily_tech_briefing_send_failed')
  };
}

function enrichActionMetadata(item: TechBriefingItem): TechBriefingItem {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  if (item.category === 'general-security') {
    const priorityCode = /\b(rce|remote code execution|supply chain|credential|token|权限边界|privilege|bypass)\b/.test(
      text
    )
      ? 'P0'
      : /\b(cve|critical|high severity|kubernetes|docker|postgres|redis|linux|windows|macos|aws|node\.js|nodejs)\b/.test(
            text
          )
        ? 'P1'
        : 'P2';
    return {
      ...item,
      priorityCode,
      actionDeadline: priorityCode === 'P0' ? '24 小时内' : priorityCode === 'P1' ? '本周内' : '下个迭代',
      estimatedTriageMinutes: 20,
      estimatedFixMinutes: 60,
      actionSteps: {
        triage: ['确认受影响版本、基础设施暴露面与默认配置', '核对官方安全公告中的利用条件与缓解前提'],
        fix: ['升级到官方修复版本或立即应用缓解措施', '必要时收紧网络、权限、密钥与访问策略'],
        verify: ['验证核心链路、权限边界与健康检查', '确认监控、审计与告警没有持续异常']
      }
    };
  }
  if (item.category === 'backend-tech') {
    const priorityCode = /\b(breaking|deprecated|migration|required)\b/.test(text) ? 'P1' : 'P2';
    return {
      ...item,
      priorityCode,
      actionDeadline: priorityCode === 'P1' ? '本周内' : '下个迭代',
      estimatedTriageMinutes: 20,
      estimatedFixMinutes: 60,
      actionSteps: {
        triage: ['确认是否命中当前后端运行时、语言、框架或构建链路', '评估是否影响现网服务、镜像与脚手架模板'],
        fix: ['安排升级、配置迁移或框架适配', '必要时更新 CI 镜像、基础镜像与项目模板'],
        verify: ['执行类型检查、关键接口回归和构建验证', '确认运行环境版本与产物一致']
      }
    };
  }
  if (item.category === 'cloud-infra-tech') {
    const priorityCode = /\b(security|incident|breaking|deprecated|migration|required)\b/.test(text) ? 'P1' : 'P2';
    return {
      ...item,
      priorityCode,
      actionDeadline: priorityCode === 'P1' ? '本周内' : '下个迭代',
      estimatedTriageMinutes: 20,
      estimatedFixMinutes: 75,
      actionSteps: {
        triage: [
          '确认是否命中 Kubernetes、Docker、Terraform、Serverless、边缘或 CI/CD 链路',
          '核对集群、流水线与 IaC 模块的受影响范围'
        ],
        fix: ['更新编排、镜像、流水线或 IaC 配置', '必要时补充灰度、回滚与资源隔离策略'],
        verify: ['验证部署、编排、流水线和可观测性指标', '确认发布后无新增告警与回滚信号']
      }
    };
  }
  if (item.category === 'frontend-security' && text.includes('axios')) {
    return {
      ...item,
      affectedVersions: ['1.14.1', '0.30.4'],
      fixedVersions: ['1.14.2+', '0.30.5+'],
      estimatedTriageMinutes: 5,
      estimatedFixMinutes: 30,
      actionDeadline: '24 小时内',
      priorityCode: 'P0',
      actionSteps: {
        triage: [
          '执行 `pnpm why axios` 或 `npm ls axios` 检查命中版本',
          '确认生产依赖、锁文件与镜像是否已拉入受影响包'
        ],
        fix: ['升级到官方修复版本并清理受污染缓存', '必要时轮换可能暴露的 Token、Cookie 或凭证'],
        verify: ['重新安装依赖并执行构建、冒烟与安全回归', '确认产物中不再包含受影响版本']
      }
    };
  }
  if (item.category === 'frontend-security' && text.includes('apifox')) {
    return {
      ...item,
      estimatedTriageMinutes: 10,
      estimatedFixMinutes: 30,
      actionDeadline: '24 小时内',
      priorityCode: 'P0',
      actionSteps: {
        triage: ['确认最近一周是否加载过受影响 Apifox 资源', '排查浏览器缓存、日志与凭证暴露范围'],
        fix: ['清理缓存并轮换密钥或 Token', '按官方公告完成升级与隔离处置'],
        verify: ['复查调试链路、前端控制台与访问日志', '确认不再加载受影响资源']
      }
    };
  }
  if (item.category === 'frontend-security' && /\b(node\.js|nodejs|tls|hashdos|bff|ssr)\b/.test(text)) {
    return {
      ...item,
      fixedVersions: ['25.8.2+', '24.14.1+', '22.22.2+', '20.x 官方修复版'],
      estimatedTriageMinutes: 10,
      estimatedFixMinutes: 45,
      actionDeadline: '本周内',
      priorityCode: 'P1'
    };
  }
  if (item.category === 'frontend-security' && /\b(chrome|webgl|webcodecs|use-after-free|browser)\b/.test(text)) {
    return {
      ...item,
      estimatedTriageMinutes: 10,
      estimatedFixMinutes: 20,
      actionDeadline: '本周内',
      priorityCode: 'P1'
    };
  }
  if (item.category === 'frontend-security' && /\b(v8|webassembly|wasm)\b/.test(text)) {
    return {
      ...item,
      estimatedTriageMinutes: 15,
      estimatedFixMinutes: 30,
      actionDeadline: '本周内',
      priorityCode: 'P1'
    };
  }
  if (item.category === 'devtool-security' && text.includes('claude code')) {
    return {
      ...item,
      estimatedTriageMinutes: 10,
      estimatedFixMinutes: 20,
      actionDeadline: '24 小时内',
      priorityCode: 'P0'
    };
  }
  if (item.category === 'devtool-security' && /\b(mcp|cursor|windsurf|path traversal|uri)\b/.test(text)) {
    return {
      ...item,
      estimatedTriageMinutes: 20,
      estimatedFixMinutes: 45,
      actionDeadline: '24 小时内',
      priorityCode: 'P0'
    };
  }
  if (
    item.category === 'devtool-security' &&
    /\b(langgraph|checkpointer|sqlite|postgres|memory|deserialize)\b/.test(text)
  ) {
    return {
      ...item,
      estimatedTriageMinutes: 15,
      estimatedFixMinutes: 30,
      actionDeadline: '本周内',
      priorityCode: 'P1'
    };
  }
  if (item.category === 'devtool-security' && /\b(hugging face|spaces|gradio|env|environment)\b/.test(text)) {
    return {
      ...item,
      estimatedTriageMinutes: 15,
      estimatedFixMinutes: 30,
      actionDeadline: '24 小时内',
      priorityCode: 'P0'
    };
  }
  if (item.category === 'devtool-security' && /\b(langsmith|permission|rbac|project)\b/.test(text)) {
    return {
      ...item,
      estimatedTriageMinutes: 10,
      estimatedFixMinutes: 20,
      actionDeadline: '本周内',
      priorityCode: 'P1'
    };
  }
  const withDefaults = {
    ...item,
    affectedVersions: item.affectedVersions ?? inferAffectedVersions(item),
    fixedVersions: item.fixedVersions ?? inferFixedVersions(item),
    priorityCode:
      item.priorityCode ?? (item.displaySeverity === 'critical' ? 'P0' : item.displaySeverity === 'high' ? 'P1' : 'P2'),
    actionDeadline:
      item.actionDeadline ??
      (item.displaySeverity === 'critical' ? '24 小时内' : item.displaySeverity === 'high' ? '本周内' : '下个迭代'),
    actionSteps: item.actionSteps ?? {
      triage: ['确认是否命中当前技术栈、受影响版本与变更窗口'],
      fix: ['安排升级、配置修正或官方建议的缓解措施'],
      verify: ['完成回归验证并确认告警、日志与产物状态正常']
    }
  };
  return withDefaults;
}

function inferAffectedVersions(item: TechBriefingItem) {
  const text = `${item.title} ${item.summary}`;
  const explicit = collectVersionCandidates(text, [
    /(?:affected|impacted|vulnerable|受影响版本|影响版本)[^0-9a-zA-Z]{0,12}((?:v?\d+\.\d+(?:\.\d+)?(?:\s*[-~]\s*v?\d+\.\d+(?:\.\d+)?)?(?:\s*,\s*)?){1,4})/gi,
    /(?:before|prior to|earlier than|低于|早于)[^0-9a-zA-Z]{0,8}(v?\d+\.\d+(?:\.\d+)?)/gi
  ]);
  if (explicit.length > 0) {
    return explicit;
  }
  if (item.updateStatus === 'security_status_change' || item.category.includes('security')) {
    const versions = collectLooseVersions(text);
    return versions.slice(0, Math.min(versions.length, 4));
  }
  return undefined;
}

function inferFixedVersions(item: TechBriefingItem) {
  const text = `${item.title} ${item.summary}`;
  const explicit = collectVersionCandidates(text, [
    /(?:fixed in|patched in|upgrade to|升级到|修复版本|fixed versions?)[^0-9a-zA-Z]{0,12}((?:v?\d+\.\d+(?:\.\d+)?\+?(?:\s*,\s*)?){1,4})/gi,
    /(?:available in|starting from|from)[^0-9a-zA-Z]{0,8}(v?\d+\.\d+(?:\.\d+)?\+?)/gi
  ]);
  if (explicit.length > 0) {
    return explicit.map(version => (version.endsWith('+') ? version : `${version}+`));
  }
  if (item.updateStatus === 'patch_released') {
    const versions = collectLooseVersions(text);
    return versions.slice(-2).map(version => (version.endsWith('+') ? version : `${version}+`));
  }
  return undefined;
}

function collectVersionCandidates(text: string, patterns: RegExp[]) {
  const versions: string[] = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const segment = match[1] ?? match[0];
      for (const version of collectLooseVersions(segment)) {
        if (!versions.includes(version)) {
          versions.push(version);
        }
      }
    }
  }
  return versions;
}

function collectLooseVersions(text: string) {
  return Array.from(text.matchAll(/\bv?\d+\.\d+(?:\.\d+)?\+?\b/g))
    .map(match => match[0].replace(/^v/i, ''))
    .filter((version, index, array) => array.indexOf(version) === index);
}

function isCriticalItem(item: TechBriefingItem) {
  return item.displaySeverity === 'critical' || item.displaySeverity === 'high';
}

function shouldBypassDuplicateWindow(item: TechBriefingItem) {
  if (
    item.category !== 'frontend-security' &&
    item.category !== 'general-security' &&
    item.category !== 'devtool-security'
  ) {
    return false;
  }
  return item.priorityCode === 'P0' || item.priorityCode === 'P1' || item.displaySeverity === 'critical';
}

function sourceGroupWeight(group: TechBriefingSourceGroup) {
  switch (group) {
    case 'official':
      return 3;
    case 'authority':
      return 2;
    default:
      return 1;
  }
}

function sourceAuthorityWeight(tier: TechBriefingItem['authorityTier']) {
  switch (tier) {
    case 'official-advisory':
      return 4;
    case 'official-release':
      return 3;
    case 'official-blog':
      return 2;
    default:
      return 1;
  }
}

function severityWeight(severity: TechBriefingItem['displaySeverity']) {
  switch (severity) {
    case 'critical':
      return 5;
    case 'high':
      return 4;
    case 'medium':
      return 3;
    case 'normal':
      return 2;
    default:
      return 1;
  }
}

function toAuditRecord(item: TechBriefingItem, sent: boolean): BriefingAuditRecord {
  return {
    messageKey: item.messageKey ?? item.id,
    title: item.cleanTitle ?? item.title,
    category: item.category,
    decisionReason: item.decisionReason ?? 'send_new',
    updateStatus: item.updateStatus,
    displaySeverity: item.displaySeverity,
    sourceName: item.sourceName,
    sourceGroup: item.sourceGroup,
    publishedAt: item.publishedAt,
    sent,
    crossVerified: item.crossVerified,
    displayScope: item.displayScope,
    url: item.url,
    whyItMatters: item.whyItMatters,
    relevanceLevel: item.relevanceLevel,
    recommendedAction: item.recommendedAction,
    impactScenarioTags: item.impactScenarioTags,
    recommendedNextStep: item.recommendedNextStep
  };
}

function buildSuppressedSummary(
  crossRunSuppressedCount: number,
  sameRunMergedCount: number,
  overflowCollapsedCount: number
) {
  const parts = [
    crossRunSuppressedCount > 0 ? `跨轮去重 ${crossRunSuppressedCount}` : '',
    sameRunMergedCount > 0 ? `同轮合并 ${sameRunMergedCount}` : '',
    overflowCollapsedCount > 0 ? `超上限折叠 ${overflowCollapsedCount}` : ''
  ].filter(Boolean);
  return parts.length > 0 ? `今日已压缩 ${parts.join(' / ')} 条噪音更新。` : undefined;
}

function computePreferenceScore(
  item: TechBriefingItem,
  preferences: {
    positiveSourceNames: Set<string>;
    negativeSourceNames: Set<string>;
    positiveReasonTags: Set<string>;
    negativeReasonTags: Set<string>;
  }
) {
  let score = 0;
  if (preferences.positiveSourceNames.has(item.sourceName)) {
    score += 3;
  }
  if (preferences.negativeSourceNames.has(item.sourceName)) {
    score -= 3;
  }
  if (
    preferences.positiveReasonTags.has('useful-actionable') &&
    item.recommendedAction &&
    item.recommendedAction !== 'watch'
  ) {
    score += 2;
  }
  if (preferences.positiveReasonTags.has('too-late') && item.relevanceLevel === 'immediate') {
    score += 1;
  }
  if (preferences.negativeReasonTags.has('too-noisy') && item.recommendedAction === 'watch') {
    score -= 2;
  }
  if (preferences.negativeReasonTags.has('irrelevant') && item.relevanceLevel === 'watch') {
    score -= 2;
  }
  if (preferences.negativeReasonTags.has('too-late') && item.relevanceLevel === 'watch') {
    score -= 1;
  }
  return score;
}

function nextLowerInterval(allowed: number[], current: number) {
  const index = allowed.indexOf(current);
  return index <= 0 ? allowed[0] : allowed[index - 1];
}

function nextHigherInterval(allowed: number[], current: number) {
  const index = allowed.indexOf(current);
  return index < 0 || index === allowed.length - 1 ? allowed[allowed.length - 1] : allowed[index + 1];
}

function scheduleForCategory(
  category: TechBriefingCategory,
  config: Pick<BriefingCategoryConfig, 'baseIntervalHours'>,
  defaultSchedule = 'daily 11:00'
) {
  if (category === 'frontend-security' || category === 'general-security' || category === 'devtool-security') {
    return `daily every ${config.baseIntervalHours} hours`;
  }
  return defaultSchedule;
}

function computeCronForCategory(
  category: TechBriefingCategory,
  intervalHours: number,
  fallbackSchedule = 'daily 11:00'
) {
  if (category !== 'frontend-security' && category !== 'general-security' && category !== 'devtool-security') {
    const normalized = fallbackSchedule.trim().toLowerCase();
    if (normalized === 'daily 11:00') {
      return '0 11 * * *';
    }
    if (normalized === 'manual') {
      return undefined;
    }
    return resolveRuntimeSchedule(fallbackSchedule).cron;
  }
  return intervalHours >= 24 ? '0 0 * * *' : `0 */${intervalHours} * * *`;
}
