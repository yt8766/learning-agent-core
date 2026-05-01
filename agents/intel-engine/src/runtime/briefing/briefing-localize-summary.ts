import type {
  TechBriefingCategory,
  TechBriefingCategoryResult,
  TechBriefingDigestResult,
  TechBriefingItem,
  TechBriefingSourceGroup
} from './briefing.types';
import { buildInteractiveCard } from './briefing-localize-card';
import {
  appendCommandInstructions,
  actionChecklist,
  buildCategorySections,
  buildCoreChange,
  buildImpactNote,
  describeStackRelevance,
  extractCheckCommand,
  inferSecurityCheckCommand,
  itemTypeLabel
} from './briefing-localize-render-content';
import {
  appendSourceSummary,
  categoryBannerLabel,
  categoryEmoji,
  categoryTitle,
  describeAuthorityTier,
  describeSourceGroup,
  fixConfidenceLabel,
  formatActionDeadline,
  formatAffectedScope,
  formatCategoryCardTitle,
  formatDate,
  formatDateTime,
  formatEffort,
  formatLookbackRange,
  formatSilencedCategoryList,
  groupSourceNames,
  isSecurityCategory,
  isTodayItem,
  priorityEmoji,
  recommendedActionLabel,
  relevanceLevelLabel,
  statusLabel,
  shouldRenderDigestCategory,
  summarizePriorityCounts,
  toMonthDayRange,
  trimSentence,
  trimText
} from './briefing-localize-render-shared';

export function renderDigestContent(
  category: TechBriefingCategory,
  items: TechBriefingItem[],
  now: Date,
  sourcesChecked: string[],
  lookbackDays: number,
  sourceGroups?: Record<TechBriefingSourceGroup, string[]>
) {
  const lookbackRange = formatLookbackRange(now, lookbackDays);
  const lines = [`# ${categoryTitle(category)}`, `统计时间：${lookbackRange}`, `覆盖范围：最近 ${lookbackDays} 天`, ''];
  appendSourceSummary(lines, sourceGroups ?? groupSourceNames(sourcesChecked));
  if (items.length === 0) {
    lines.push('今日未发现最近一周内的高置信新增。', '', '说明：当前仍会发送空报，方便确认定时任务和来源巡检正常。');
    return lines.join('\n');
  }

  const todayHighlights = items.filter(item => isTodayItem(item.publishedAt, now));
  const weeklyItems = items.filter(item => !todayHighlights.some(highlight => highlight.id === item.id));

  lines.push(`命中 ${items.length} 条高置信更新。`, '');
  if (todayHighlights.length > 0) {
    lines.push('## 今日重点', '');
    todayHighlights.forEach((item, index) => appendItemSection(lines, category, item, index + 1));
  }
  if (weeklyItems.length > 0) {
    lines.push('## 本周补充', '');
    weeklyItems.forEach((item, index) => appendItemSection(lines, category, item, index + 1));
  }
  lines.push(
    '## 来源说明',
    '- 官方来源优先作为主结论。',
    '- 权威媒体与安全研究机构用于补充交叉验证。',
    '- 社区热门仅作为补充信号，不单独决定高置信结论。'
  );
  return lines.join('\n');
}

export function renderSummaryDigest(params: {
  now: Date;
  categories: TechBriefingCategoryResult[];
  sourceGroups: Record<TechBriefingSourceGroup, string[]>;
  lookbackDaysByCategory: Record<TechBriefingCategory, number>;
  sendEmptyDigest: boolean;
  renderMode?: 'markdown-summary' | 'interactive-card' | 'dual';
  detailMode?: 'summary' | 'detailed';
}): TechBriefingDigestResult {
  const {
    now,
    categories,
    sourceGroups,
    lookbackDaysByCategory,
    renderMode = 'dual',
    detailMode = 'detailed'
  } = params;
  const visibleCategories = categories.filter(shouldRenderDigestCategory);
  const silencedCategories = categories.filter(category => !shouldRenderDigestCategory(category));
  const newCount = categories.reduce((sum, category) => sum + (category.newCount ?? 0), 0);
  const updateCount = categories.reduce((sum, category) => sum + (category.updateCount ?? 0), 0);
  const crossRunSuppressedCount = categories.reduce(
    (sum, category) => sum + (category.crossRunSuppressedCount ?? 0),
    0
  );
  const sameRunMergedCount = categories.reduce((sum, category) => sum + (category.sameRunMergedCount ?? 0), 0);
  const overflowCollapsedCount = categories.reduce((sum, category) => sum + (category.overflowCollapsedCount ?? 0), 0);
  const singleCategory = categories.length === 1 ? categories[0] : null;
  const digestTitle = singleCategory
    ? formatCategoryCardTitle(singleCategory.category)
    : visibleCategories.length === 1
      ? formatCategoryCardTitle(visibleCategories[0]!.category)
      : `每日技术情报简报 | ${formatDate(now)}`;

  const lines = [
    digestTitle,
    `日期：${formatDate(now)} | 周期：过去 24 小时增量`,
    `增量摘要：本轮新增 ${newCount} 条，更新 ${updateCount} 条，抑制重复 ${crossRunSuppressedCount} 条，同轮合并 ${sameRunMergedCount} 条。`,
    ''
  ];

  if (visibleCategories.length === 0) {
    lines.push('本轮未发现新增或实质更新。', '重复及未发生实质变更的主题已自动抑制。');
  } else {
    visibleCategories.forEach(category =>
      appendSummaryCategory(lines, category, now, lookbackDaysByCategory[category.category])
    );
  }

  if (silencedCategories.length > 0) {
    lines.push(
      '',
      `注：已巡检${formatSilencedCategoryList(silencedCategories)}等 ${silencedCategories.length} 个分类，今日无新增高置信更新。`
    );
  }
  lines.push(
    `ℹ️ 运行底座统计：本轮共巡检官方源 ${sourceGroups.official.length} 个，权威媒体 ${sourceGroups.authority.length} 个，社区热门 ${sourceGroups.community.length} 个。`
  );
  lines.push('官方来源优先作为主结论，重复及未发生实质变更的主题已自动抑制。');

  return {
    title: digestTitle,
    mode: 'single-summary-card',
    renderMode,
    detailMode,
    content: lines.join('\n').trim(),
    card: buildInteractiveCard(
      digestTitle,
      visibleCategories,
      {
        newCount,
        updateCount,
        crossRunSuppressedCount,
        sameRunMergedCount,
        overflowCollapsedCount,
        silencedCategories
      },
      sourceGroups,
      lookbackDaysByCategory,
      detailMode
    ),
    categoryCount: visibleCategories.length,
    newCount,
    updateCount,
    crossRunSuppressedCount,
    sameRunMergedCount,
    overflowCollapsedCount,
    sourcesChecked: sourceGroups,
    historyLinks: []
  };
}

function appendItemSection(lines: string[], category: TechBriefingCategory, item: TechBriefingItem, index: number) {
  const relevance = describeStackRelevance(item);
  lines.push('', `${index}. ${trimText(item.title, 64)}`, '', `一句话摘要：${item.summary}`);
  lines.push(`为什么和我们相关：${item.relevanceReason}；${relevance.note}`);
  lines.push(`核心变化：${buildCoreChange(category)}`);
  lines.push(`为什么值得关注：${buildImpactNote(category, item)}`);
  lines.push(`建议动作：${trimText(actionChecklist(category, item).join('；'), 140)}`);
  lines.push(
    `来源信息：来源 ${item.sourceName}；来源分层 ${describeSourceGroup(item.sourceGroup)}；发布时间 ${formatDateTime(item.publishedAt)}；权威级别 ${describeAuthorityTier(item.authorityTier)}；技术性评分 ${item.technicalityScore}/5；交叉验证 ${item.crossVerified ? '是' : '否'}`
  );
  lines.push(`原文链接：${item.url}`, '');
}

function appendSummaryCategory(lines: string[], category: TechBriefingCategoryResult, now: Date, lookbackDays: number) {
  const displayedItems = category.displayedItems ?? [];
  const sections = buildCategorySections(category.category, displayedItems);
  const range = formatLookbackRange(now, lookbackDays);
  if (isSecurityCategory(category.category)) {
    appendSecuritySummaryCategory(lines, category, displayedItems);
    return;
  }
  lines.push(
    `${categoryEmoji(category.category)} [${categoryTitle(category.category)}] ${displayedItems.length} 条${categoryBannerLabel(category.category)} · 最近 ${lookbackDays} 天`
  );
  lines.push(
    `(统计周期: ${toMonthDayRange(range)} | 本轮新增 ${category.newCount ?? 0}, 更新 ${category.updateCount ?? 0}, 抑制重复 ${category.crossRunSuppressedCount ?? 0}, 同轮合并 ${category.sameRunMergedCount ?? 0}, 折叠 ${category.overflowCollapsedCount ?? 0})`
  );
  lines.push('— — — — — — — — — — —', '');
  if (displayedItems.length === 0) {
    lines.push('本轮无新增。', '');
    return;
  }
  sections.forEach(section => {
    if (section.items.length === 0) return;
    if (section.label) lines.push(`**${section.label}**`, '');
    section.items.forEach((item, index) => appendSummaryItem(lines, category.category, item, index + 1));
  });
  if ((category.overflowTitles?.length ?? 0) > 0) {
    lines.push(`📦 其他更新（${category.overflowTitles?.length ?? 0} 条）`);
    category.overflowTitles?.forEach(title => lines.push(`- ${title}`));
    lines.push('');
  }
}

function appendSecuritySummaryCategory(
  lines: string[],
  category: TechBriefingCategoryResult,
  items: TechBriefingItem[]
) {
  const counts = summarizePriorityCounts(items);
  lines.push(
    `## ${categoryEmoji(category.category)} ${categoryTitle(category.category)}（${items.length} 条 | ${counts}）`
  );
  if (items.length === 0) {
    lines.push('', '本轮无新增，重复主题或无实质变化的公告已自动抑制。', '');
    return;
  }
  lines.push('', '<details>', '<summary>展开查看详情</summary>', '');
  items.forEach(item => appendSecuritySummaryItem(lines, category.category, item));
  lines.push('</details>', '');
}

function appendSummaryItem(lines: string[], category: TechBriefingCategory, item: TechBriefingItem, index: number) {
  lines.push(
    `${priorityEmoji(item.priorityCode)} ${item.priorityCode ?? 'P2'} ${index}. [${itemTypeLabel(category, item)} | ${statusLabel(item)}] ${trimText(item.cleanTitle ?? item.title, 96)}`
  );
  lines.push('', `> 💡 摘要：${trimSentence(item.summary, 80)}`);
  lines.push(`⭐ 值得看原因：${item.whyItMatters ?? buildImpactNote(category, item)}`);
  lines.push(
    `🏷️ 相关性：${relevanceLevelLabel(item.relevanceLevel)} · 建议动作：${recommendedActionLabel(item.recommendedAction)}`
  );
  lines.push(`🎯 命中范围：${item.displayScope ?? describeStackRelevance(item).note}`);
  lines.push(`⚠️ 关键影响：${buildImpactNote(category, item)}`);
  if (item.impactScenarioTags?.length) lines.push(`👥 影响场景：${item.impactScenarioTags.join('、')}`);
  lines.push('🛠️ 建议动作：');
  if (item.recommendedNextStep) lines.push(`首动作：${item.recommendedNextStep}`);
  lines.push(
    `排查：${item.actionSteps?.triage?.join('；') ?? actionChecklist(category, item).at(0) ?? '确认命中范围'}`
  );
  lines.push(
    `修复：${item.actionSteps?.fix?.join('；') ?? actionChecklist(category, item).at(1) ?? '安排升级或缓解措施'}`
  );
  lines.push(
    `验证：${item.actionSteps?.verify?.join('；') ?? actionChecklist(category, item).at(2) ?? '完成回归验证'}`
  );
  if (item.affectedVersions?.length) lines.push(`受影响版本：${item.affectedVersions.join(', ')}`);
  if (item.fixedVersions?.length) lines.push(`修复版本：${item.fixedVersions.join(', ')}`);
  if (item.actionDeadline) lines.push(`行动时限：${item.actionDeadline}`);
  if (item.estimatedTriageMinutes || item.estimatedFixMinutes)
    lines.push(
      `预估处理时长：排查 ${item.estimatedTriageMinutes ?? 0} 分钟，修复 ${item.estimatedFixMinutes ?? 0} 分钟`
    );
  if (item.estimatedEffort) lines.push(`预计投入：${item.estimatedEffort}`);
  lines.push(
    `🔗 [${item.sourceName}](${item.url}) (得分: ${item.technicalityScore}/5 | 交叉验证: ${item.crossVerified ? '是' : '否'} | ${describeAuthorityTier(item.authorityTier)})`,
    ''
  );
}

function appendSecuritySummaryItem(lines: string[], category: TechBriefingCategory, item: TechBriefingItem) {
  const command = extractCheckCommand(item) ?? inferSecurityCheckCommand(category, item);
  const deadlineLabel = formatActionDeadline(item).split('（')[0]?.replace(/^.\s*/, '') ?? '观察';
  lines.push(
    `### ${priorityEmoji(item.priorityCode)}【${item.priorityCode ?? 'P2'} · ${deadlineLabel}】${trimText(item.cleanTitle ?? item.title, 96)}`
  );
  lines.push('', `> 💡 **摘要**：${trimSentence(item.summary, 220)}`, '', '| 字段 | 内容 |', '|------|------|');
  lines.push(`| 类型 | ${itemTypeLabel(category, item)} |`);
  lines.push(`| Why now | ${item.whyItMatters ?? buildImpactNote(category, item)} |`);
  lines.push(`| 首动作 | ${item.recommendedNextStep ?? '先确认是否命中当前部署范围'} |`);
  lines.push(`| 影响范围 | ${formatAffectedScope(item)} |`);
  lines.push(`| 影响场景 | ${(item.impactScenarioTags ?? ['需结合当前部署确认']).join('、')} |`);
  lines.push(`| 修复版本 | ${item.fixedVersions?.join(', ') ?? '公告未明确，请按官方说明确认'} |`);
  lines.push(`| 修复把握 | ${fixConfidenceLabel(item.fixConfidence)} |`);
  lines.push(`| 发布时间 | ${formatDate(item.publishedAt)} |`);
  lines.push(`| 行动时限 | ${formatActionDeadline(item)} |`);
  lines.push(`| 预估耗时 | ${item.estimatedEffort ?? formatEffort(item)} |`);
  lines.push(`| 来源 | [${item.sourceName}](${item.url}) |`, '', '#### 🔍 排查');
  if (command) appendCommandInstructions(lines, command);
  (item.actionSteps?.triage ?? ['确认受影响版本、部署范围与暴露面']).forEach(step => lines.push(`- ${step}`));
  lines.push('', '#### 🧯 修复');
  (item.actionSteps?.fix ?? ['升级到官方修复版本或先应用缓解措施']).forEach(step => lines.push(`- ${step}`));
  lines.push('', '#### ✅ 验证');
  (item.actionSteps?.verify ?? ['验证核心链路、日志与告警状态']).forEach(step => lines.push(`- ${step}`));
  lines.push('');
}
