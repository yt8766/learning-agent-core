import type {
  TechBriefingAuthorityTier,
  TechBriefingCategory,
  TechBriefingCategoryResult,
  TechBriefingDisplaySeverity,
  TechBriefingItem,
  TechBriefingSourceGroup
} from './runtime-tech-briefing.types';

export function describeAuthorityTier(tier: TechBriefingAuthorityTier) {
  switch (tier) {
    case 'official-advisory':
      return '官方安全通告';
    case 'official-release':
      return '官方发布说明';
    case 'official-blog':
      return '官方博客';
    default:
      return '头部媒体';
  }
}

export function categoryTitle(category: TechBriefingCategory) {
  switch (category) {
    case 'frontend-security':
      return '前端安全情报';
    case 'general-security':
      return '通用安全情报';
    case 'devtool-security':
      return 'Agent / DevTool 安全情报';
    case 'ai-tech':
      return 'AI 新技术情报';
    case 'backend-tech':
      return '后端/全栈新技术';
    case 'cloud-infra-tech':
      return '云原生与基础设施';
    default:
      return '前端新技术情报';
  }
}

export function formatDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function formatLookbackRange(now: Date, lookbackDays: number) {
  const end = normalizeUtcDate(now);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - Math.max(lookbackDays - 1, 0));
  return `${formatDate(start)} - ${formatDate(end)}`;
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 19).replace('T', ' ');
  }
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

export function appendSourceSummary(lines: string[], sourceGroups: Record<TechBriefingSourceGroup, string[]>) {
  lines.push('已检查来源：');
  appendSourceGroup(lines, '官方', sourceGroups.official);
  appendSourceGroup(lines, '权威媒体', sourceGroups.authority);
  appendSourceGroup(lines, '社区热门', sourceGroups.community);
  lines.push('');
}

export function groupSourceNames(sourceNames: string[]): Record<TechBriefingSourceGroup, string[]> {
  return { official: sourceNames, authority: [], community: [] };
}

export function describeSourceGroup(group: TechBriefingSourceGroup) {
  switch (group) {
    case 'official':
      return '官方';
    case 'authority':
      return '权威媒体/研究机构';
    default:
      return '社区热门';
  }
}

export function isTodayItem(publishedAt: string, now: Date) {
  const published = new Date(publishedAt);
  if (Number.isNaN(published.getTime())) {
    return false;
  }
  return (
    published.getUTCFullYear() === now.getUTCFullYear() &&
    published.getUTCMonth() === now.getUTCMonth() &&
    published.getUTCDate() === now.getUTCDate()
  );
}

export function trimText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(maxLength - 1, 0)).trim()}...`;
}

export function trimSentence(value: string, maxLength: number) {
  return trimText(value.replace(/\s+/g, ' ').trim(), maxLength);
}

export function categoryEmoji(category: TechBriefingCategory) {
  if (category === 'frontend-security') return '🚨';
  if (category === 'general-security') return '🔐';
  if (category === 'devtool-security') return '🛡️';
  if (category === 'ai-tech') return '🤖';
  if (category === 'backend-tech') return '🧩';
  if (category === 'cloud-infra-tech') return '☁️';
  return '🌐';
}

export function categoryBannerLabel(category: TechBriefingCategory) {
  if (category === 'frontend-security') return '高危更新';
  if (category === 'general-security') return '基础设施安全';
  if (category === 'devtool-security') return '安全事件';
  return '高置信更新';
}

export function severityEmoji(severity: TechBriefingDisplaySeverity | undefined) {
  switch (severity) {
    case 'critical':
      return '🔴';
    case 'high':
      return '🟠';
    case 'medium':
      return '🟡';
    case 'stable':
      return '🟢';
    default:
      return '🔵';
  }
}

export function priorityEmoji(priorityCode: TechBriefingItem['priorityCode']) {
  switch (priorityCode) {
    case 'P0':
      return '🔴';
    case 'P1':
      return '🟠';
    default:
      return '🟡';
  }
}

export function statusLabel(item: TechBriefingItem) {
  switch (item.updateStatus) {
    case 'patch_released':
      return '更新 · 已修复';
    case 'breaking_change':
      return '更新 · 破坏性变更';
    case 'official_confirmation':
      return '更新 · 官方确认';
    case 'new':
    default:
      return item.decisionReason === 'send_update' ? '更新' : '新增';
  }
}

export function isSecurityCategory(category: TechBriefingCategory) {
  return category === 'frontend-security' || category === 'general-security' || category === 'devtool-security';
}

export function shouldRenderDigestCategory(category: TechBriefingCategoryResult) {
  const items = category.displayedItems ?? [];
  if (items.length === 0) return false;
  if (!isSecurityCategory(category.category)) return true;
  return items.some(item => item.priorityCode === 'P0' || item.priorityCode === 'P1');
}

export function formatSilencedCategoryList(categories: TechBriefingCategoryResult[]) {
  return categories
    .slice(0, 3)
    .map(category => categoryTitle(category.category))
    .join('、');
}

export function summarizePriorityCounts(items: TechBriefingItem[]) {
  const counts = {
    P0: items.filter(item => item.priorityCode === 'P0').length,
    P1: items.filter(item => item.priorityCode === 'P1').length,
    P2: items.filter(item => (item.priorityCode ?? 'P2') === 'P2').length
  };
  return [`🔴P0:${counts.P0}`, `🟠P1:${counts.P1}`, `🟡P2:${counts.P2}`].join(' ');
}

export function actionUrgencyLabel(priorityCode: TechBriefingItem['priorityCode']) {
  switch (priorityCode) {
    case 'P0':
      return '立即处理';
    case 'P1':
      return '本周处理';
    default:
      return '纳入排期';
  }
}

export function formatActionDeadline(item: TechBriefingItem) {
  const raw =
    item.actionDeadline ??
    (item.priorityCode === 'P0' ? '24 小时内' : item.priorityCode === 'P1' ? '本周内' : '下个迭代');
  return `${priorityEmoji(item.priorityCode)} ${actionUrgencyLabel(item.priorityCode)}（${raw}）`;
}

export function formatEffort(item: TechBriefingItem) {
  return `排查 ${item.estimatedTriageMinutes ?? 10} 分钟 + 修复 ${item.estimatedFixMinutes ?? 30} 分钟`;
}

export function formatAffectedScope(item: TechBriefingItem) {
  if (item.affectedVersions?.length) return item.affectedVersions.join(', ');
  if (item.displayScope) return item.displayScope;
  return '需结合公告与当前部署版本确认';
}

export function relevanceLevelLabel(level: TechBriefingItem['relevanceLevel']) {
  switch (level) {
    case 'immediate':
      return '立即相关';
    case 'team':
      return '团队关注';
    default:
      return '行业观察';
  }
}

export function recommendedActionLabel(action: TechBriefingItem['recommendedAction']) {
  switch (action) {
    case 'fix-now':
      return '立即修复';
    case 'pilot':
      return '建议试点';
    case 'evaluate':
      return '纳入评测';
    case 'watch':
      return '收藏观察';
    default:
      return '暂不处理';
  }
}

export function fixConfidenceLabel(level: TechBriefingItem['fixConfidence']) {
  switch (level) {
    case 'confirmed-fix':
      return '官方已确认修复';
    case 'mitigation-only':
      return '有缓解无正式修复';
    default:
      return '仅风险提示';
  }
}

export function formatCategoryCardTitle(category: TechBriefingCategory) {
  return `${categoryEmoji(category)} ${categoryTitle(category)}`;
}

export function toMonthDayRange(range: string) {
  const [start, end] = range.split(' - ');
  return `${start.slice(5)} 至 ${end.slice(5)}`;
}

function appendSourceGroup(lines: string[], label: string, sources: string[]) {
  lines.push(`- ${label} ${sources.length} 个`);
  if (sources.length > 0) {
    lines.push(`  ${sources.join('、')}`);
  }
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function normalizeUtcDate(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}
