import type { TechBriefingCategory, TechBriefingItem } from './briefing.types';
import { annotateStableMetadata } from './briefing-ranking-metadata';
import { enrichCardSemantics } from './briefing-ranking-semantics';
import { hasStackToken, normalizeTopicSegment } from './briefing-ranking-shared';

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
  const pending = loadWorkspaceSignals();
  signalCache.set(workspaceRoot, pending);
  return pending;
}

async function loadWorkspaceSignals(): Promise<WorkspaceSignals> {
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
