export type TechBriefingCategory =
  | 'frontend-security'
  | 'general-security'
  | 'devtool-security'
  | 'ai-tech'
  | 'frontend-tech'
  | 'backend-tech'
  | 'cloud-infra-tech';

export interface TechBriefingCategoryScheduleState {
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

export type TechBriefingAuthorityTier = 'official-advisory' | 'official-release' | 'official-blog' | 'top-tier-media';

export type TechBriefingSourceType = 'nvd-api' | 'rss' | 'atom' | 'official-page' | 'security-page';

export type TechBriefingSourceGroup = 'official' | 'authority' | 'community';

export type TechBriefingContentKind =
  | 'release'
  | 'docs-update'
  | 'advisory'
  | 'incident'
  | 'benchmark'
  | 'community-discussion';

export type TechBriefingParserKind = 'feed' | 'security-advisory' | 'incident-page' | 'media-report' | 'community-post';

export type TechBriefingUpdateStatus =
  | 'new'
  | 'version_upgrade'
  | 'breaking_change'
  | 'security_status_change'
  | 'capability_added'
  | 'official_confirmation'
  | 'patch_released'
  | 'metadata_only';

export type TechBriefingDisplaySeverity = 'critical' | 'high' | 'medium' | 'normal' | 'stable';

export type TechBriefingDecisionReason =
  | 'send_new'
  | 'send_update'
  | 'critical_override'
  | 'suppress_duplicate'
  | 'suppress_metadata_only'
  | 'same_run_merged'
  | 'overflow_collapsed';

export interface TechBriefingItem {
  id: string;
  category: TechBriefingCategory;
  title: string;
  url: string;
  publishedAt: string;
  sourceName: string;
  sourceUrl: string;
  sourceType: TechBriefingSourceType;
  authorityTier: TechBriefingAuthorityTier;
  sourceGroup: TechBriefingSourceGroup;
  contentKind: TechBriefingContentKind;
  summary: string;
  confidence: number;
  sourceLabel: string;
  relevanceReason: string;
  technicalityScore: number;
  crossVerified: boolean;
  eventClusterId?: string;
  stableTopicKey?: string;
  messageKey?: string;
  contentFingerprint?: string;
  updateStatus?: TechBriefingUpdateStatus;
  isMaterialChange?: boolean;
  decisionReason?: TechBriefingDecisionReason;
  displaySeverity?: TechBriefingDisplaySeverity;
  displayScope?: string;
  cleanTitle?: string;
  affectedVersions?: string[];
  fixedVersions?: string[];
  estimatedTriageMinutes?: number;
  estimatedFixMinutes?: number;
  estimatedEffort?: string;
  actionDeadline?: string;
  priorityCode?: 'P0' | 'P1' | 'P2';
  relevanceLevel?: 'immediate' | 'team' | 'watch';
  recommendedAction?: 'ignore' | 'watch' | 'evaluate' | 'pilot' | 'fix-now';
  whyItMatters?: string;
  fixConfidence?: 'confirmed-fix' | 'mitigation-only' | 'unconfirmed';
  impactScenarioTags?: string[];
  recommendedNextStep?: string;
  actionSteps?: {
    triage: string[];
    fix: string[];
    verify: string[];
  };
  detailLevel?: 'summary' | 'detailed';
}

export interface TechBriefingCategoryResult {
  category: TechBriefingCategory;
  status: 'sent' | 'empty' | 'failed' | 'skipped';
  title: string;
  itemCount: number;
  sent: boolean;
  emptyDigest: boolean;
  sourcesChecked: string[];
  newCount?: number;
  updateCount?: number;
  crossRunSuppressedCount?: number;
  sameRunMergedCount?: number;
  overflowCollapsedCount?: number;
  suppressedSummary?: string;
  savedAttentionCount?: number;
  displayedItemCount?: number;
  displayedItems?: TechBriefingItem[];
  overflowTitles?: string[];
  auditRecords?: BriefingAuditRecord[];
  error?: string;
  sentAt?: string;
}

export interface TechBriefingDigestResult {
  title: string;
  mode: 'single-summary-card' | 'per-category';
  renderMode?: 'markdown-summary' | 'interactive-card' | 'dual';
  detailMode?: 'summary' | 'detailed';
  content: string;
  card?: Record<string, unknown>;
  categoryCount: number;
  newCount: number;
  updateCount: number;
  crossRunSuppressedCount: number;
  sameRunMergedCount: number;
  overflowCollapsedCount: number;
  suppressedSummary?: string;
  savedAttentionCount?: number;
  sourcesChecked: Record<TechBriefingSourceGroup, string[]>;
  sourceAvailability?: Record<
    TechBriefingCategory,
    Array<{ sourceName: string; status: 'success' | 'empty' | 'timeout' | 'failed'; detail?: string }>
  >;
  historyLinks?: string[];
  parts?: Array<{
    title: string;
    content: string;
    card?: Record<string, unknown>;
  }>;
}

export interface TechBriefingRunRecord {
  id: string;
  runAt: string;
  status: 'sent' | 'partial' | 'failed';
  categories: TechBriefingCategoryResult[];
  digest?: Pick<
    TechBriefingDigestResult,
    | 'title'
    | 'mode'
    | 'categoryCount'
    | 'newCount'
    | 'updateCount'
    | 'crossRunSuppressedCount'
    | 'sameRunMergedCount'
    | 'overflowCollapsedCount'
  >;
}

export interface DailyTechBriefingScheduleRecord {
  id: string;
  name: string;
  kind: 'daily-tech-briefing';
  category: TechBriefingCategory;
  schedule: string;
  status: 'ACTIVE' | 'DISABLED';
  cron?: string;
  scheduleValid?: boolean;
  jobKey?: string;
  lastRegisteredAt?: string;
  scheduler?: 'bree';
  timezone?: string;
  source: 'runtime-bootstrap';
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  nextRunAt?: string;
}

export interface DailyTechBriefingStatusRecord {
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
  scheduleStates?: Partial<Record<TechBriefingCategory, TechBriefingCategoryScheduleState>>;
  recentRuns?: TechBriefingRunRecord[];
  categories: Array<{
    category: TechBriefingCategory;
    title: string;
    status: 'sent' | 'empty' | 'failed' | 'skipped';
    itemCount: number;
    emptyDigest: boolean;
    scheduleState?: TechBriefingCategoryScheduleState;
    newCount?: number;
    updateCount?: number;
    crossRunSuppressedCount?: number;
    sameRunMergedCount?: number;
    overflowCollapsedCount?: number;
    suppressedSummary?: string;
    savedAttentionCount?: number;
    displayedItemCount?: number;
    overflowTitles?: string[];
    auditRecords?: BriefingAuditRecord[];
    helpful?: number;
    notHelpful?: number;
    preferredSourceNames?: string[];
    preferredTopicLabels?: string[];
    focusAreas?: string[];
    trendHighlights?: string[];
    sentAt?: string;
    error?: string;
  }>;
}

export interface BriefingHistoryRecord {
  messageKey: string;
  category: TechBriefingCategory;
  firstSeenAt: string;
  firstSentAt?: string;
  lastSentAt?: string;
  lastPublishedAt: string;
  lastContentFingerprint: string;
  lastContentChangeAt?: string;
  lastTitle: string;
  lastUrl: string;
  lastSourceName: string;
  lastDecision: TechBriefingDecisionReason;
}

export interface BriefingAuditRecord {
  messageKey: string;
  title: string;
  category: TechBriefingCategory;
  decisionReason: TechBriefingDecisionReason;
  updateStatus?: TechBriefingUpdateStatus;
  displaySeverity?: TechBriefingDisplaySeverity;
  sourceName: string;
  sourceGroup: TechBriefingSourceGroup;
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
}

export interface BriefingFeedbackRecord {
  id: string;
  messageKey: string;
  category: TechBriefingCategory;
  feedbackType: 'helpful' | 'notHelpful';
  reasonTag?: 'too-noisy' | 'irrelevant' | 'too-late' | 'useful-actionable';
  createdAt: string;
}

export interface BriefingRawEvidenceRecord {
  provider: 'mcp-web-search' | 'feed' | 'security-page' | 'nvd-api';
  query?: string;
  capturedAt: string;
  payload: unknown;
}
