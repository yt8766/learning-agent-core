import { resolveRuntimeSchedule } from '../schedules/runtime-schedule.helpers';
import type {
  TechBriefingCategory,
  TechBriefingCategoryResult,
  TechBriefingCategoryScheduleState
} from './runtime-tech-briefing.types';

export type BriefingCategoryConfig = {
  enabled: boolean;
  baseIntervalHours: number;
  lookbackDays: number;
  adaptivePolicy: {
    hotThresholdRuns: number;
    cooldownEmptyRuns: number;
    allowedIntervalHours: number[];
  };
};

export type BriefingSettings = {
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

export function resolveBriefingCategoryConfig(
  settings: BriefingSettings,
  category: TechBriefingCategory
): BriefingCategoryConfig {
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

export function resolveBriefingLookbackDays(settings: BriefingSettings, category: TechBriefingCategory) {
  return resolveBriefingCategoryConfig(settings, category).lookbackDays;
}

export function nextBriefingScheduleState(params: {
  settings: BriefingSettings;
  category: TechBriefingCategory;
  previous: TechBriefingCategoryScheduleState | undefined;
  result: TechBriefingCategoryResult;
  now: Date;
  reason?: 'scheduled' | 'forced' | 'manual';
}): TechBriefingCategoryScheduleState {
  const { settings, category, previous, result, now, reason = 'manual' } = params;
  const config = resolveBriefingCategoryConfig(settings, category);
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

export function scheduleForCategory(
  category: TechBriefingCategory,
  config: Pick<BriefingCategoryConfig, 'baseIntervalHours'>,
  defaultSchedule = 'daily 11:00'
) {
  if (category === 'frontend-security' || category === 'general-security' || category === 'devtool-security') {
    return `daily every ${config.baseIntervalHours} hours`;
  }
  return defaultSchedule;
}

export function computeCronForCategory(
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

function nextLowerInterval(allowed: number[], current: number) {
  const index = allowed.indexOf(current);
  return index <= 0 ? allowed[0] : allowed[index - 1];
}

function nextHigherInterval(allowed: number[], current: number) {
  const index = allowed.indexOf(current);
  return index < 0 || index === allowed.length - 1 ? allowed[allowed.length - 1] : allowed[index + 1];
}

function isCriticalItem(item: NonNullable<TechBriefingCategoryResult['displayedItems']>[number]) {
  return item.displaySeverity === 'critical' || item.displaySeverity === 'high';
}
