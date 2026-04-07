import { createHash } from 'node:crypto';

import type {
  TechBriefingCategory,
  TechBriefingDisplaySeverity,
  TechBriefingItem,
  TechBriefingSourceGroup,
  TechBriefingUpdateStatus
} from './runtime-tech-briefing.types';
import { computePriorityScore } from './runtime-tech-briefing-localize';

type WorkspaceSignals = {
  keywords: Set<string>;
};

const signalCache = new Map<string, Promise<WorkspaceSignals>>();

export async function finalizeItemsForRanking(
  category: TechBriefingCategory,
  items: TechBriefingItem[],
  workspaceRoot: string
) {
  const signals = await readWorkspaceSignals(workspaceRoot);
  const filtered = filterItemsByCategory(category, items);
  const enriched = filtered.map(item => enrichRelevance(item, signals));
  return markCrossVerified(enriched)
    .map(item => annotateStableMetadata(item))
    .map(item => enrichCardSemantics(item, signals));
}

export function rankItems(
  category: TechBriefingCategory,
  items: TechBriefingItem[],
  sourcePolicy: 'tiered-authority' | 'official-only'
) {
  const filtered =
    sourcePolicy === 'official-only'
      ? items.filter(item => {
          if (item.sourceGroup === 'official') {
            return true;
          }
          if (category !== 'frontend-security' && category !== 'devtool-security') {
            return false;
          }
          return (
            item.sourceGroup === 'authority' &&
            item.contentKind === 'incident' &&
            (item.crossVerified || item.technicalityScore >= 4 || item.confidence >= 0.88)
          );
        })
      : items.filter(item => item.sourceGroup !== 'community' || item.crossVerified || item.technicalityScore >= 4);
  return filtered.sort((left, right) => {
    const repoGap = extractRelevanceLevel(right.relevanceReason) - extractRelevanceLevel(left.relevanceReason);
    if (repoGap !== 0) {
      return repoGap;
    }
    const explicitRelevanceGap = relevanceLevelRank(right.relevanceLevel) - relevanceLevelRank(left.relevanceLevel);
    if (explicitRelevanceGap !== 0) {
      return explicitRelevanceGap;
    }
    const actionGap = recommendedActionRank(right.recommendedAction) - recommendedActionRank(left.recommendedAction);
    if (actionGap !== 0) {
      return actionGap;
    }
    const groupGap = sourceGroupRank(right.sourceGroup) - sourceGroupRank(left.sourceGroup);
    if (groupGap !== 0) {
      return groupGap;
    }
    const priorityGap = computePriorityScore(category, right) - computePriorityScore(category, left);
    if (priorityGap !== 0) {
      return priorityGap;
    }
    if (right.crossVerified !== left.crossVerified) {
      return Number(right.crossVerified) - Number(left.crossVerified);
    }
    if (right.technicalityScore !== left.technicalityScore) {
      return right.technicalityScore - left.technicalityScore;
    }
    if (right.confidence !== left.confidence) {
      return right.confidence - left.confidence;
    }
    return right.publishedAt.localeCompare(left.publishedAt);
  });
}

function filterItemsByCategory(category: TechBriefingCategory, items: TechBriefingItem[]) {
  return items.filter(item => {
    const text = `${item.title} ${item.summary}`.toLowerCase();
    if (category === 'ai-tech') {
      const isTechnical =
        /\b(model|models|api|sdk|agent|workflow|reasoning|benchmark|tooling|framework|middleware|langchain|langgraph|inference|eval|runtime|openclaw|gemini|claude|gpt|qwen|glm|phi|nemotron|swe-bench|tool calling|memory|multimodal)\b/i.test(
          text
        ) ||
        item.contentKind === 'release' ||
        item.contentKind === 'benchmark' ||
        item.contentKind === 'docs-update';
      const isExcluded =
        /\b(funding|raises|customer|customers|case study|partnership|database partnership|knowledge work|disaster response|workshop|enterprise story|bank customer|customer story|customer stories|partnership|announcing|creativity|ll cool j|translator|translation|headphones|android tips|ios tips|search live|consumer feature|photo editing|shopping|education classroom)\b/i.test(
          text
        );
      const isBrandOrCorpNews =
        /\b(acquires?|acquisition|media company|support independent media|forest|satellite imagery|brazil|global conversations|team pricing|pricing for teams|share videos|google vids)\b/i.test(
          text
        );
      return isTechnical && !isExcluded && !isBrandOrCorpNews;
    }
    if (category === 'frontend-tech') {
      const isRelevant =
        hasStackToken(text, ['react', 'nextjs', 'next.js', 'vue', 'vite', 'typescript']) ||
        /\b(web api|browser|chrome|edge|rsc|ssr|adapter|deploy|platform|tooling|bundler|build|rollup|webpack|eslint|dx|view transition|compiler|worker)\b/i.test(
          text
        ) ||
        item.contentKind === 'docs-update';
      const isExcluded =
        /\b(ddos|magic transit|client-side security|flow protection|mitigation|network protection)\b/i.test(text);
      if (!isRelevant || isExcluded) {
        return false;
      }
      if (item.sourceGroup === 'community') {
        return /\b(github|official|release|rfc|benchmark|details|deep dive|adapter|typescript|react|nextjs|next\.js|vite|vue)\b/i.test(
          text
        );
      }
      return true;
    }
    if (category === 'backend-tech') {
      const isRelevant =
        hasStackToken(text, [
          'node.js',
          'nodejs',
          'bun',
          'deno',
          'go',
          'rust',
          'java',
          'spring',
          'spring boot',
          '.net',
          'dotnet'
        ]) ||
        /\b(runtime|framework|language|orm|server|backend|service|microservice|build|compiler|release notes?)\b/i.test(
          text
        );
      const isExcluded =
        /\b(funding|raises|customer|customers|case study|partnership|marketing|webinar|event|conference)\b/i.test(text);
      return isRelevant && !isExcluded;
    }
    if (category === 'cloud-infra-tech') {
      const isRelevant =
        hasStackToken(text, [
          'kubernetes',
          'docker',
          'terraform',
          'serverless',
          'github actions',
          'gitlab ci',
          'cloudflare',
          'vercel',
          'aws'
        ]) ||
        /\b(ci\/cd|cicd|deployment|orchestration|infra|container|cluster|iac|edge|observability|rollout)\b/i.test(text);
      const isExcluded =
        /\b(funding|raises|customer|customers|case study|partnership|marketing|event|conference)\b/i.test(text);
      return isRelevant && !isExcluded;
    }
    if (category === 'general-security') {
      const isRelevant =
        hasStackToken(text, [
          'linux',
          'windows',
          'macos',
          'postgres',
          'postgresql',
          'redis',
          'kubernetes',
          'docker',
          'node.js',
          'nodejs',
          'aws'
        ]) || /\b(cve|security|rce|privilege|bypass|escape|advisory|bulletin|critical|high severity)\b/i.test(text);
      const isExcluded = /\b(marketing|funding|customer story|case study|event|conference)\b/i.test(text);
      return isRelevant && !isExcluded;
    }
    return true;
  });
}

function enrichRelevance(item: TechBriefingItem, signals: WorkspaceSignals): TechBriefingItem {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  const matchedKeywords = [...signals.keywords].filter(keyword => hasStackToken(text, [keyword]));
  if (matchedKeywords.length > 0) {
    return {
      ...item,
      relevanceReason: `命中当前关注技术域：${matchedKeywords.join(' / ')}`
    };
  }
  if (item.category === 'frontend-tech' && /\b(chrome|view transitions?|browser|web api)\b/i.test(text)) {
    return {
      ...item,
      relevanceReason: '命中浏览器能力与前端工程观察范围'
    };
  }
  if (
    item.category === 'backend-tech' &&
    /\b(node\.js|nodejs|bun|deno|go|rust|java|spring|spring boot|dotnet|\.net)\b/i.test(text)
  ) {
    return {
      ...item,
      relevanceReason: '命中后端运行时、语言与框架观察范围'
    };
  }
  if (
    item.category === 'cloud-infra-tech' &&
    /\b(kubernetes|docker|terraform|serverless|github actions|gitlab ci|edge)\b/i.test(text)
  ) {
    return {
      ...item,
      relevanceReason: '命中云原生、部署编排与 CI/CD 观察范围'
    };
  }
  if (
    item.category === 'general-security' &&
    /\b(linux|windows|macos|postgres|postgresql|redis|kubernetes|docker|node\.js|nodejs|aws)\b/i.test(text)
  ) {
    return {
      ...item,
      relevanceReason: '命中基础设施与通用安全高风险关键词'
    };
  }
  return item;
}

function enrichCardSemantics(item: TechBriefingItem, signals: WorkspaceSignals): TechBriefingItem {
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

function markCrossVerified(items: TechBriefingItem[]) {
  const clustered = new Map<string, number>();
  for (const item of items) {
    const clusterId = buildEventClusterId(item);
    clustered.set(clusterId, (clustered.get(clusterId) ?? 0) + 1);
  }
  return items.map(item => {
    const eventClusterId = buildEventClusterId(item);
    const count = clustered.get(eventClusterId) ?? 1;
    return {
      ...item,
      eventClusterId,
      crossVerified: count > 1,
      confidence: Math.min(0.99, item.confidence + (count > 1 ? 0.04 : 0))
    };
  });
}

async function readWorkspaceSignals(workspaceRoot: string): Promise<WorkspaceSignals> {
  const existing = signalCache.get(workspaceRoot);
  if (existing) {
    return existing;
  }
  const pending = loadWorkspaceSignals(workspaceRoot);
  signalCache.set(workspaceRoot, pending);
  return pending;
}

async function loadWorkspaceSignals(workspaceRoot: string): Promise<WorkspaceSignals> {
  const keywords = new Set<string>([
    'react',
    'nextjs',
    'next.js',
    'vite',
    'astro',
    'vue',
    'typescript',
    'eslint',
    'css',
    'langgraph',
    'langchain',
    'gemini',
    'claude',
    'gpt',
    'qwen',
    'glm',
    'phi',
    'nemotron',
    'openai',
    'axios',
    'apifox',
    'node.js',
    'nodejs',
    'chrome',
    'v8',
    'webassembly',
    'wasm',
    'claude code',
    'devtool',
    'mcp',
    'cursor',
    'windsurf',
    'langsmith',
    'hugging face',
    'spaces',
    'pnpm',
    'npm',
    'bun',
    'deno',
    'go',
    'rust',
    'java',
    'spring',
    'dotnet',
    '.net',
    'kubernetes',
    'docker',
    'terraform',
    'serverless',
    'github actions',
    'gitlab ci',
    'postgres',
    'postgresql',
    'redis',
    'linux',
    'windows',
    'macos',
    'aws'
  ]);
  return { keywords };
}

function buildEventClusterId(item: TechBriefingItem) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  const tokens = [
    'axios',
    'apifox',
    'node.js',
    'nodejs',
    'chrome',
    'v8',
    'webassembly',
    'wasm',
    'claude code',
    'mcp',
    'cursor',
    'windsurf',
    'langsmith',
    'hugging face',
    'spaces',
    'gemini',
    'claude',
    'gpt',
    'qwen',
    'glm',
    'phi',
    'nemotron',
    'next.js',
    'nextjs',
    'react',
    'vite',
    'typescript',
    'langgraph',
    'langchain',
    'view transitions',
    'bun',
    'deno',
    'go',
    'rust',
    'java',
    'spring',
    'kubernetes',
    'docker',
    'terraform',
    'serverless',
    'github actions',
    'gitlab ci',
    'postgres',
    'postgresql',
    'redis',
    'linux',
    'windows',
    'macos'
  ]
    .filter(token => hasStackToken(text, [token]))
    .slice(0, 2);
  return `${item.category}:${tokens.join('|') || normalizeTopicSegment(item.cleanTitle ?? item.title)}:${item.contentKind}`;
}

function hasStackToken(text: string, tokens: string[]) {
  return tokens.some(token => {
    const normalized = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${normalized}([^a-z0-9]|$)`, 'i').test(text);
  });
}

function extractRelevanceLevel(reason: string) {
  if (reason.includes('当前关注技术域')) {
    return 2;
  }
  if (reason.includes('浏览器能力')) {
    return 2;
  }
  return 1;
}

function sourceGroupRank(group: TechBriefingSourceGroup) {
  switch (group) {
    case 'official':
      return 3;
    case 'authority':
      return 2;
    default:
      return 1;
  }
}

function relevanceLevelRank(level: TechBriefingItem['relevanceLevel']) {
  switch (level) {
    case 'immediate':
      return 3;
    case 'team':
      return 2;
    default:
      return 1;
  }
}

function recommendedActionRank(level: TechBriefingItem['recommendedAction']) {
  switch (level) {
    case 'fix-now':
      return 5;
    case 'pilot':
      return 4;
    case 'evaluate':
      return 3;
    case 'watch':
      return 2;
    default:
      return 1;
  }
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

function annotateStableMetadata(item: TechBriefingItem): TechBriefingItem {
  const stableTopicKey =
    item.eventClusterId ?? `${item.category}:${normalizeTopicSegment(item.cleanTitle ?? item.title)}`;
  const updateStatus = detectUpdateStatus(item);
  const publishedHour = item.publishedAt.slice(0, 13);
  const fingerprintInput = [
    normalizeTopicSegment(item.cleanTitle ?? item.title),
    item.contentKind,
    item.authorityTier,
    extractVersionTokens(`${item.title} ${item.summary}`),
    extractSecurityTokens(`${item.title} ${item.summary}`),
    publishedHour,
    updateStatus
  ].join('|');
  const contentFingerprint = createHash('sha1').update(fingerprintInput).digest('hex');
  return {
    ...item,
    stableTopicKey,
    messageKey: `${item.category}:${stableTopicKey}`,
    contentFingerprint,
    updateStatus,
    isMaterialChange: updateStatus !== 'metadata_only',
    displaySeverity: computeDisplaySeverity(item),
    displayScope: buildDisplayScope(item)
  };
}

function detectUpdateStatus(item: TechBriefingItem): TechBriefingUpdateStatus {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  if (/\b(breaking|breaking change|破坏性变更)\b/.test(text)) {
    return 'breaking_change';
  }
  if (/\b(fixed|patched|修复|补丁|mitigation)\b/.test(text)) {
    return 'patch_released';
  }
  if (
    (item.category === 'frontend-security' ||
      item.category === 'general-security' ||
      item.category === 'devtool-security') &&
    /\b(cve|incident|漏洞|泄露|投毒|compromised|rat|rce|bypass|privilege)\b/.test(text)
  ) {
    return 'security_status_change';
  }
  if (item.sourceGroup === 'official' && item.authorityTier !== 'official-blog') {
    return 'official_confirmation';
  }
  if (extractVersionTokens(text)) {
    return 'version_upgrade';
  }
  if (/\b(api|adapter|support|capability|view transitions?|sdk|model|agent)\b/.test(text)) {
    return 'capability_added';
  }
  return 'new';
}

function computeDisplaySeverity(item: TechBriefingItem): TechBriefingDisplaySeverity {
  const score = computePriorityScore(item.category, item);
  if (item.category === 'frontend-security' && score >= 31) {
    return 'critical';
  }
  if (score >= 31) {
    return 'high';
  }
  if (score >= 21) {
    return 'medium';
  }
  if (score >= 12) {
    return 'normal';
  }
  return 'stable';
}

function buildDisplayScope(item: TechBriefingItem) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  const matched = [
    'axios',
    'apifox',
    'node.js',
    'nodejs',
    'chrome',
    'v8',
    'webassembly',
    'wasm',
    'npm',
    'pnpm',
    'bun',
    'deno',
    'go',
    'rust',
    'java',
    'spring',
    'kubernetes',
    'docker',
    'terraform',
    'serverless',
    'github actions',
    'gitlab ci',
    'postgres',
    'postgresql',
    'redis',
    'linux',
    'windows',
    'macos',
    'aws',
    'claude code',
    'mcp',
    'cursor',
    'windsurf',
    'langsmith',
    'hugging face',
    'spaces',
    'langgraph',
    'langchain',
    'react',
    'next.js',
    'nextjs',
    'vite',
    'astro',
    'vue',
    'typescript',
    'eslint',
    'css',
    'gemini',
    'claude',
    'gpt',
    'qwen',
    'glm',
    'phi',
    'nemotron',
    'chrome',
    'view transitions',
    'browser'
  ].filter(keyword => hasStackToken(text, [keyword]));
  const label = matched.length > 0 ? matched.slice(0, 2).join(' / ') : fallbackScope(item.category, text);
  const level = describeScopeLevel(matched.length);
  return `${label} (${level})`;
}

function fallbackScope(category: TechBriefingCategory, text: string) {
  if (category === 'frontend-tech' && /\b(chrome|view transitions?|browser)\b/.test(text)) {
    return '浏览器能力 / View Transitions';
  }
  if (category === 'frontend-security' && /\b(node\.js|nodejs|ssr|bff|tls)\b/.test(text)) {
    return 'Node.js 服务端 / Next.js SSR / BFF';
  }
  if (category === 'frontend-security' && /\b(chrome|webgl|webcodecs|browser)\b/.test(text)) {
    return 'Chrome / 浏览器客户端安全';
  }
  if (category === 'frontend-security' && /\b(v8|webassembly|wasm)\b/.test(text)) {
    return 'V8 / WebAssembly 运行时';
  }
  if (category === 'frontend-tech' && /\b(eslint|flat config|lint)\b/.test(text)) {
    return '静态代码分析 / 前端工程化';
  }
  if (category === 'frontend-tech' && /\b(astro|vite|ssr|environment api)\b/.test(text)) {
    return 'Vite 构建 / Astro / SSR';
  }
  if (category === 'frontend-tech' && /\b(css|light-dark|color scheme|images?)\b/.test(text)) {
    return 'CSS / UI 渲染与暗黑模式';
  }
  if (category === 'ai-tech') {
    if (/\b(gemini|claude|gpt|qwen|glm|phi|nemotron|model|reasoning|multimodal|audio|voice)\b/.test(text)) {
      return '核心模型演进 / 多模态交互';
    }
    if (/\b(langchain|langgraph|middleware|sdk|api|runtime|agent|workflow|memory)\b/.test(text)) {
      return 'Agent 运行架构 / 平台工具链';
    }
    if (/\b(benchmark|swe-bench|eval|ranking)\b/.test(text)) {
      return '模型评测 / 选型风向';
    }
    return '运行时与 Agent 编排';
  }
  if (category === 'devtool-security') {
    if (/\b(mcp|cursor|windsurf)\b/.test(text)) {
      return 'MCP 生态 / 自定义本地工具链';
    }
    if (/\b(langgraph|checkpointer|sqlite|postgres|memory)\b/.test(text)) {
      return 'LangGraph 编排 / Agent 运行时内存';
    }
    if (/\b(langsmith|permission|rbac|project)\b/.test(text)) {
      return 'LangSmith / 调试台权限';
    }
    if (/\b(hugging face|spaces|gradio|env|environment)\b/.test(text)) {
      return 'Hugging Face Spaces / 演示环境';
    }
    return '开发工具与本地工作区安全';
  }
  if (category === 'frontend-security') {
    return '前端依赖与供应链';
  }
  return '前端工程与工具链';
}

function describeScopeLevel(matchCount: number) {
  if (matchCount >= 2) {
    return '高度相关';
  }
  if (matchCount === 1) {
    return '中度相关';
  }
  return '低相关';
}

function extractVersionTokens(text: string) {
  return Array.from(text.matchAll(/\b\d+\.\d+(?:\.\d+)?\b/g))
    .map(match => match[0])
    .slice(0, 3)
    .join(',');
}

function extractSecurityTokens(text: string) {
  return Array.from(text.matchAll(/\b(CVE-\d{4}-\d+|GHSA-[a-z0-9-]+)\b/gi))
    .map(match => match[0].toUpperCase())
    .slice(0, 3)
    .join(',');
}

function normalizeTopicSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/chrome developers|langchain blog|google ai blog|the verge|apifox 官方公告|datadog security labs/gi, ' ')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}
