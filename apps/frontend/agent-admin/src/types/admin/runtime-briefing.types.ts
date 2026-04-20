export type RuntimeCenterDailyTechBriefingCategory =
  | 'frontend-security'
  | 'general-security'
  | 'devtool-security'
  | 'ai-tech'
  | 'frontend-tech'
  | 'backend-tech'
  | 'cloud-infra-tech';

export interface RuntimeCenterDailyTechBriefingScheduleStateRecord {
  enabled: boolean;
  baseIntervalHours: number;
  currentIntervalHours: number;
  allowedIntervalHours: number[];
  lookbackDays: number;
  lastRunAt?: string;
  nextRunAt?: string;
  lastSuccessAt?: string;
  lastHotAt?: string;
  consecutiveHotRuns: number;
  consecutiveEmptyRuns: number;
  lastAdaptiveReason?: 'hot_streak' | 'cooldown' | 'manual_reset';
  recentRunStats: Array<{
    runAt: string;
    itemCount: number;
    newCount: number;
    updateCount: number;
    hot: boolean;
    status: 'sent' | 'empty' | 'failed' | 'skipped';
  }>;
}

export interface RuntimeCenterDailyTechBriefingRecord {
  enabled: boolean;
  schedule: string;
  cron?: string;
  scheduleValid?: boolean;
  jobKey?: string;
  lastRegisteredAt?: string;
  scheduler?: 'bree';
  timezone?: string;
  lastRunAt?: string;
  lastSuccessAt?: string;
  scheduleStates?: Partial<
    Record<RuntimeCenterDailyTechBriefingCategory, RuntimeCenterDailyTechBriefingScheduleStateRecord>
  >;
  recentRuns?: Array<{
    id: string;
    runAt: string;
    status: 'sent' | 'partial' | 'failed';
    categories: Array<{
      category: RuntimeCenterDailyTechBriefingCategory;
      title: string;
      status: 'sent' | 'empty' | 'failed' | 'skipped';
      itemCount: number;
      emptyDigest: boolean;
    }>;
  }>;
  categories: Array<{
    category: RuntimeCenterDailyTechBriefingCategory;
    title: string;
    status: 'sent' | 'empty' | 'failed' | 'skipped';
    itemCount: number;
    emptyDigest: boolean;
    scheduleState?: RuntimeCenterDailyTechBriefingScheduleStateRecord;
    newCount?: number;
    updateCount?: number;
    crossRunSuppressedCount?: number;
    sameRunMergedCount?: number;
    overflowCollapsedCount?: number;
    suppressedSummary?: string;
    savedAttentionCount?: number;
    displayedItemCount?: number;
    overflowTitles?: string[];
    preferredSourceNames?: string[];
    preferredTopicLabels?: string[];
    focusAreas?: string[];
    trendHighlights?: string[];
    auditRecords?: Array<{
      messageKey: string;
      title: string;
      category: RuntimeCenterDailyTechBriefingCategory;
      decisionReason:
        | 'send_new'
        | 'send_update'
        | 'critical_override'
        | 'suppress_duplicate'
        | 'suppress_metadata_only'
        | 'same_run_merged'
        | 'overflow_collapsed';
      updateStatus?:
        | 'new'
        | 'version_upgrade'
        | 'breaking_change'
        | 'security_status_change'
        | 'capability_added'
        | 'official_confirmation'
        | 'patch_released'
        | 'metadata_only';
      displaySeverity?: 'critical' | 'high' | 'medium' | 'normal' | 'stable';
      sourceName: string;
      sourceGroup: 'official' | 'authority' | 'community';
      publishedAt: string;
      sent: boolean;
      crossVerified: boolean;
      displayScope?: string;
      url: string;
      whyItMatters?: string;
      relevanceLevel?: 'immediate' | 'team' | 'watch';
      recommendedAction?: 'ignore' | 'watch' | 'evaluate' | 'pilot' | 'fix-now';
      impactScenarioTags?: string[];
      recommendedNextStep?: string;
      helpful?: number;
      notHelpful?: number;
    }>;
    helpful?: number;
    notHelpful?: number;
    sentAt?: string;
    error?: string;
  }>;
}
