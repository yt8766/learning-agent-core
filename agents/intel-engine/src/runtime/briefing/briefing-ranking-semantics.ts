import type { TechBriefingItem } from './briefing.types';
import { hasStackToken } from './briefing-ranking-shared';

export function enrichCardSemantics(
  item: TechBriefingItem,
  signals: {
    keywords: Set<string>;
  }
): TechBriefingItem {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  const matchedKeywords = [...signals.keywords].filter(keyword => hasStackToken(text, [keyword]));
  const immediateMatch =
    matchedKeywords.length > 0 ||
    /\b(nextjs|next\.js|react|typescript|node\.js|nodejs|kubernetes|docker|terraform|langgraph|langchain|claude code|mcp)\b/i.test(
      text
    );
  const relevanceLevel: TechBriefingItem['relevanceLevel'] =
    item.category === 'frontend-security' ||
    item.category === 'general-security' ||
    item.category === 'devtool-security'
      ? item.priorityCode === 'P0' || item.priorityCode === 'P1'
        ? 'immediate'
        : 'team'
      : immediateMatch
        ? 'immediate'
        : item.sourceGroup === 'official'
          ? 'team'
          : 'watch';

  const recommendedAction: TechBriefingItem['recommendedAction'] =
    item.category === 'frontend-security' ||
    item.category === 'general-security' ||
    item.category === 'devtool-security'
      ? item.priorityCode === 'P0'
        ? 'fix-now'
        : item.priorityCode === 'P1'
          ? 'evaluate'
          : 'watch'
      : /\b(breaking|migration|upgrade|release notes|runtime|sdk|api|view transitions?|serverless|ci\/cd|cicd|reasoning|multimodal)\b/i.test(
            text
          )
        ? 'evaluate'
        : /\b(agent|workflow|middleware|pilot|preview|beta)\b/i.test(text)
          ? 'pilot'
          : 'watch';

  const whyItMatters = buildWhyItMatters(item);
  const impactScenarioTags = inferImpactScenarioTags(item, matchedKeywords);
  const recommendedNextStep = inferRecommendedNextStep(item, recommendedAction);
  const estimatedEffort =
    item.estimatedEffort ??
    (item.category === 'frontend-security' ||
    item.category === 'general-security' ||
    item.category === 'devtool-security'
      ? `排查 ${item.estimatedTriageMinutes ?? 20} 分钟 + 修复 ${item.estimatedFixMinutes ?? 60} 分钟`
      : recommendedAction === 'pilot'
        ? 'PoC 半天'
        : recommendedAction === 'evaluate'
          ? '阅读 10 分钟 + 评估半天'
          : '阅读 5 分钟');

  const fixConfidence: TechBriefingItem['fixConfidence'] =
    item.fixedVersions?.length && item.fixedVersions.length > 0
      ? 'confirmed-fix'
      : item.category === 'frontend-security' ||
          item.category === 'general-security' ||
          item.category === 'devtool-security'
        ? 'mitigation-only'
        : 'unconfirmed';

  return {
    ...item,
    relevanceLevel,
    recommendedAction,
    whyItMatters,
    impactScenarioTags,
    recommendedNextStep,
    estimatedEffort,
    fixConfidence
  };
}

function buildWhyItMatters(item: TechBriefingItem) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  if (item.category === 'ai-tech') {
    if (/\b(gemini|claude|gpt|qwen|glm|phi|model|reasoning|multimodal|audio|voice)\b/i.test(text)) {
      return '会影响模型选型、复杂推理链路和多模态能力规划，值得尽快判断是否进入评测。';
    }
    return '可能影响 Agent 编排、SDK 接入成本或平台能力边界，适合纳入团队技术观察。';
  }
  if (item.category === 'frontend-tech') {
    return '通常会影响浏览器能力、工程化方案或框架升级窗口，适合纳入前端工程评估。';
  }
  if (item.category === 'backend-tech') {
    return '可能影响运行时选型、服务端框架升级窗口或交付链路，适合尽快判断是否进入评测。';
  }
  if (item.category === 'cloud-infra-tech') {
    return '可能影响部署编排、CI/CD 稳定性或基础设施成本，适合纳入平台工程评估。';
  }
  return '会影响风险暴露面、修复优先级和团队处置节奏，需要尽快确认是否命中。';
}

function inferImpactScenarioTags(item: TechBriefingItem, matchedKeywords: string[]) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  const tags = new Set<string>();
  if (matchedKeywords.length > 0) {
    matchedKeywords.slice(0, 2).forEach(keyword => tags.add(keyword));
  }
  if (/\b(ssr|bff|node\.js|nodejs)\b/i.test(text)) tags.add('SSR/BFF');
  if (/\b(github actions|gitlab ci|ci\/cd|cicd)\b/i.test(text)) tags.add('CI Runner');
  if (/\b(kubernetes|control plane|cluster)\b/i.test(text)) tags.add('K8s 控制面');
  if (/\b(api|sdk|gateway)\b/i.test(text)) tags.add('公共 API');
  if (/\b(browser|chrome|view transitions?)\b/i.test(text)) tags.add('浏览器体验');
  if (/\b(agent|workflow|memory|langgraph|langchain)\b/i.test(text)) tags.add('Agent 编排');
  return [...tags];
}

function inferRecommendedNextStep(item: TechBriefingItem, action: TechBriefingItem['recommendedAction']) {
  if (
    item.category === 'frontend-security' ||
    item.category === 'general-security' ||
    item.category === 'devtool-security'
  ) {
    return item.actionSteps?.triage?.[0] ?? '先确认受影响版本、部署范围与暴露面';
  }
  switch (action) {
    case 'pilot':
      return '安排一个小范围 PoC，验证接入收益与兼容性';
    case 'evaluate':
      return '拉一位负责人做 10-30 分钟评估，判断是否进入团队排期';
    case 'watch':
      return '先收藏观察，等下一轮或更多官方细节再决定';
    default:
      return '先确认是否命中当前技术栈与升级窗口';
  }
}
