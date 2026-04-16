import type {
  TechBriefingCategory,
  TechBriefingCategoryResult,
  TechBriefingItem,
  TechBriefingSourceGroup
} from './runtime-tech-briefing.types';
import {
  actionUrgencyLabel,
  categoryEmoji,
  categoryTitle,
  fixConfidenceLabel,
  formatActionDeadline,
  formatAffectedScope,
  formatEffort,
  formatSilencedCategoryList,
  isSecurityCategory,
  priorityEmoji,
  recommendedActionLabel,
  relevanceLevelLabel,
  summarizePriorityCounts,
  trimSentence,
  trimText
} from './runtime-tech-briefing-localize-render-shared';
import {
  buildCategorySections,
  buildCommandMarkdown,
  buildImpactNote,
  describeStackRelevance,
  extractCheckCommand,
  inferSecurityCheckCommand,
  itemTypeLabel
} from './runtime-tech-briefing-localize-render-content';

export function buildInteractiveCard(
  title: string,
  categories: TechBriefingCategoryResult[],
  summary: {
    newCount: number;
    updateCount: number;
    crossRunSuppressedCount: number;
    sameRunMergedCount: number;
    overflowCollapsedCount: number;
    silencedCategories: TechBriefingCategoryResult[];
  },
  sourceGroups: Record<TechBriefingSourceGroup, string[]>,
  lookbackDaysByCategory: Record<TechBriefingCategory, number>,
  detailMode: 'summary' | 'detailed'
) {
  const elements: Array<Record<string, unknown>> = [
    {
      tag: 'div',
      text: {
        tag: 'lark_md',
        content:
          `**过去 24 小时增量**\n` +
          `新增 **${summary.newCount}** · 更新 **${summary.updateCount}** · ` +
          `抑制 **${summary.crossRunSuppressedCount}** · 合并 **${summary.sameRunMergedCount}** · 折叠 **${summary.overflowCollapsedCount}**`
      }
    },
    { tag: 'hr' }
  ];

  if (categories.length === 0) {
    elements.push({
      tag: 'div',
      text: { tag: 'lark_md', content: '本轮未发现新增或实质更新，重复主题已自动抑制。' }
    });
  } else {
    categories.forEach(category => {
      elements.push(
        ...buildInteractiveCategorySection(category, lookbackDaysByCategory[category.category], detailMode)
      );
    });
  }

  elements.push(
    { tag: 'hr' },
    ...(summary.silencedCategories.length > 0
      ? [
          {
            tag: 'note',
            elements: [
              {
                tag: 'plain_text',
                content: `已巡检${formatSilencedCategoryList(summary.silencedCategories)}等 ${summary.silencedCategories.length} 个分类，今日无新增高置信更新。`
              }
            ]
          }
        ]
      : []),
    ...(summary.silencedCategories.length > 0 ? [{ tag: 'hr' }] : []),
    ...(summary.crossRunSuppressedCount + summary.sameRunMergedCount + summary.overflowCollapsedCount > 0
      ? [
          {
            tag: 'note',
            elements: [
              {
                tag: 'plain_text',
                content: `今日已帮你节省 ${summary.crossRunSuppressedCount + summary.sameRunMergedCount + summary.overflowCollapsedCount} 条重复或低价值更新。`
              }
            ]
          }
        ]
      : []),
    ...(summary.crossRunSuppressedCount + summary.sameRunMergedCount + summary.overflowCollapsedCount > 0
      ? [{ tag: 'hr' }]
      : []),
    {
      tag: 'note',
      elements: [
        {
          tag: 'plain_text',
          content: `来源统计：官方 ${sourceGroups.official.length} 个，权威媒体 ${sourceGroups.authority.length} 个，社区热门 ${sourceGroups.community.length} 个`
        }
      ]
    }
  );

  return {
    config: { wide_screen_mode: true },
    header: { template: 'blue', title: { tag: 'plain_text', content: title } },
    elements
  };
}

function buildInteractiveCategorySection(
  category: TechBriefingCategoryResult,
  lookbackDays: number,
  detailMode: 'summary' | 'detailed' = 'detailed'
) {
  const items = category.displayedItems ?? [];
  const sections = buildCategorySections(category.category, items);
  if (isSecurityCategory(category.category)) {
    return buildInteractiveSecurityCategorySection(category, items, lookbackDays, detailMode);
  }
  const blocks: Array<Record<string, unknown>> = [
    {
      tag: 'div',
      text: {
        tag: 'lark_md',
        content:
          `**${categoryEmoji(category.category)} ${categoryTitle(category.category)}**  \n` +
          `${items.length} 条命中 · 最近 ${lookbackDays} 天 · 新增 ${category.newCount ?? 0} · 更新 ${category.updateCount ?? 0}`
      }
    },
    {
      tag: 'column_set',
      columns: [
        metricColumn('抑制', String(category.crossRunSuppressedCount ?? 0)),
        metricColumn('合并', String(category.sameRunMergedCount ?? 0)),
        metricColumn('折叠', String(category.overflowCollapsedCount ?? 0))
      ]
    }
  ];

  if (items.length === 0) {
    blocks.push({ tag: 'div', text: { tag: 'plain_text', content: '本轮无新增。' } }, { tag: 'hr' });
    return blocks;
  }

  sections.forEach(section => {
    if (section.items.length === 0) return;
    if (section.label) {
      blocks.push({ tag: 'div', text: { tag: 'lark_md', content: `**${section.label}**` } });
    }
    section.items.forEach(item => {
      blocks.push({
        tag: 'div',
        text: {
          tag: 'lark_md',
          content:
            `${priorityEmoji(item.priorityCode)} **${item.priorityCode ?? 'P2'} | ${itemTypeLabel(category.category, item)} | ${trimText(item.cleanTitle ?? item.title, 96)}**  \n` +
            `> ${trimSentence(item.summary, 80)}`
        }
      });
      if (detailMode === 'detailed') {
        blocks.push({
          tag: 'column_set',
          columns: [
            infoColumn('命中范围', item.displayScope ?? describeStackRelevance(item).note),
            infoColumn('相关性', relevanceLevelLabel(item.relevanceLevel)),
            infoColumn('建议动作', recommendedActionLabel(item.recommendedAction))
          ]
        });
        blocks.push({
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**值得看原因**\n${item.whyItMatters ?? buildImpactNote(category.category, item)}`
          }
        });
        blocks.push({
          tag: 'div',
          text: {
            tag: 'lark_md',
            content:
              `**首动作**\n- ${item.recommendedNextStep ?? '先确认是否命中当前技术栈与升级窗口'}\n\n` +
              `**关键影响**\n${buildImpactNote(category.category, item)}\n\n` +
              `**建议动作**\n` +
              `- 排查：${item.actionSteps?.triage?.join('；') ?? '确认命中范围'}\n` +
              `- 修复：${item.actionSteps?.fix?.join('；') ?? '安排升级或缓解措施'}\n` +
              `- 验证：${item.actionSteps?.verify?.join('；') ?? '完成回归验证'}`
          }
        });
      }
      if (item.affectedVersions?.length || item.fixedVersions?.length || item.actionDeadline || item.estimatedEffort) {
        blocks.push({
          tag: 'column_set',
          columns: [
            infoColumn('受影响版本', item.affectedVersions?.join(', ') ?? '未标注'),
            infoColumn('修复版本', item.fixedVersions?.join(', ') ?? '未标注'),
            infoColumn('预计投入', item.estimatedEffort ?? item.actionDeadline ?? '常规跟进')
          ]
        });
      }
      blocks.push({
        tag: 'action',
        actions: [{ tag: 'button', text: { tag: 'plain_text', content: '查看原文' }, type: 'primary', url: item.url }]
      });
      const checkCommand = extractCheckCommand(item);
      if (checkCommand && detailMode === 'detailed') {
        blocks.push({ tag: 'div', text: { tag: 'lark_md', content: buildCommandMarkdown(checkCommand) } });
      }
    });
  });

  if ((category.overflowTitles?.length ?? 0) > 0) {
    blocks.push({
      tag: 'fold',
      title: `📦 其他更新（${category.overflowTitles?.length ?? 0} 条）`,
      children: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content:
              category.overflowTitles
                ?.slice(0, 3)
                .map(title => `- ${title}`)
                .join('\n') ?? ''
          }
        },
        ...((category.overflowTitles?.length ?? 0) > 3
          ? [
              {
                tag: 'div',
                text: {
                  tag: 'lark_md',
                  content:
                    category.overflowTitles
                      ?.slice(3)
                      .map(title => `- ${title}`)
                      .join('\n') ?? ''
                }
              }
            ]
          : [])
      ]
    });
  }

  blocks.push({ tag: 'hr' });
  return blocks;
}

function buildInteractiveSecurityCategorySection(
  category: TechBriefingCategoryResult,
  items: TechBriefingItem[],
  lookbackDays: number,
  detailMode: 'summary' | 'detailed' = 'detailed'
) {
  const blocks: Array<Record<string, unknown>> = [
    {
      tag: 'div',
      text: {
        tag: 'lark_md',
        content:
          `**${categoryEmoji(category.category)} ${categoryTitle(category.category)}**  \n` +
          `${items.length} 条命中 · 最近 ${lookbackDays} 天 · ${summarizePriorityCounts(items)}`
      }
    },
    {
      tag: 'column_set',
      columns: [
        metricColumn('新增', String(category.newCount ?? 0)),
        metricColumn('更新', String(category.updateCount ?? 0)),
        metricColumn('抑制', String(category.crossRunSuppressedCount ?? 0))
      ]
    }
  ];

  if (items.length === 0) {
    blocks.push(
      { tag: 'div', text: { tag: 'plain_text', content: '本轮无新增，重复主题或无实质变化的公告已自动抑制。' } },
      { tag: 'hr' }
    );
    return blocks;
  }

  items.forEach(item => {
    const command = extractCheckCommand(item) ?? inferSecurityCheckCommand(category.category, item);
    blocks.push({
      tag: 'div',
      text: {
        tag: 'lark_md',
        content:
          `${priorityEmoji(item.priorityCode)} **【${item.priorityCode ?? 'P2'} · ${actionUrgencyLabel(item.priorityCode)}】${trimText(item.cleanTitle ?? item.title, 96)}**  \n` +
          `> ${trimSentence(item.summary, 120)}`
      }
    });
    blocks.push({
      tag: 'column_set',
      columns: [
        infoColumn('影响范围', formatAffectedScope(item)),
        infoColumn('修复把握', fixConfidenceLabel(item.fixConfidence)),
        infoColumn('行动时限', formatActionDeadline(item))
      ]
    });
    blocks.push({
      tag: 'div',
      text: {
        tag: 'lark_md',
        content:
          `**Why now**\n${item.whyItMatters ?? buildImpactNote(category.category, item)}\n\n` +
          `**Who is impacted**\n${(item.impactScenarioTags ?? ['需结合当前部署确认']).join('、')}\n\n` +
          `**Recommended next step**\n${item.recommendedNextStep ?? '先确认是否命中当前部署范围'}`
      }
    });
    if (detailMode === 'detailed') {
      blocks.push({
        tag: 'div',
        text: {
          tag: 'lark_md',
          content:
            `**排查**\n- ${(item.actionSteps?.triage ?? ['确认受影响版本、部署范围与暴露面']).join('\n- ')}\n\n` +
            `**修复**\n- ${(item.actionSteps?.fix ?? ['升级到官方修复版本或先应用缓解措施']).join('\n- ')}\n\n` +
            `**验证**\n- ${(item.actionSteps?.verify ?? ['验证核心链路、日志与告警状态']).join('\n- ')}`
        }
      });
      if (command) {
        blocks.push({ tag: 'div', text: { tag: 'lark_md', content: buildCommandMarkdown(command) } });
      }
    }
    blocks.push({
      tag: 'action',
      actions: [{ tag: 'button', text: { tag: 'plain_text', content: '查看原文' }, type: 'primary', url: item.url }]
    });
  });

  blocks.push({ tag: 'hr' });
  return blocks;
}

function metricColumn(label: string, value: string) {
  return {
    tag: 'column',
    width: 'weighted',
    weight: 1,
    elements: [{ tag: 'markdown', content: `**${label}**\n${value}` }]
  };
}

function infoColumn(label: string, value: string) {
  return {
    tag: 'column',
    width: 'weighted',
    weight: 1,
    elements: [{ tag: 'markdown', content: `**${label}**\n${value}` }]
  };
}
