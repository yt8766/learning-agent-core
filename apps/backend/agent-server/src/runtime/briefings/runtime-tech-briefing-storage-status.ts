import type { TechBriefingCategory } from './runtime-tech-briefing.types';

export function summarizeSuppression(crossRunSuppressedCount = 0, sameRunMergedCount = 0, overflowCollapsedCount = 0) {
  const total = crossRunSuppressedCount + sameRunMergedCount + overflowCollapsedCount;
  if (!total) {
    return '本轮无抑制，所有展示内容均为直接命中。';
  }
  return `本轮共节省 ${total} 条低价值噪音，其中跨轮去重 ${crossRunSuppressedCount}、同轮合并 ${sameRunMergedCount}、超上限折叠 ${overflowCollapsedCount}。`;
}

export function summarizePreferredSourceNames(
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

export function summarizePreferredTopicLabels(
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

export function summarizeFocusAreas(
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

export function summarizeTrendHighlights(
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
