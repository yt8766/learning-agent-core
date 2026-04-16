import type { TechBriefingCategory, TechBriefingItem } from './runtime-tech-briefing.types';

export function computePriorityScore(category: TechBriefingCategory, item: TechBriefingItem) {
  const impactLevel = buildImpactLevel(category, item);
  const relevance = describeStackRelevance(item).level;
  const impactScore = impactLevel === '高' ? 3 : impactLevel === '中' ? 2 : 1;
  const relevanceScore = relevance === '高' ? 3 : relevance === '中' ? 2 : 1;
  return impactScore * 10 + relevanceScore;
}

function buildImpactLevel(category: TechBriefingCategory, item: TechBriefingItem) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  if (category === 'frontend-security') {
    if (/axios|apifox|npm|pnpm|supply chain|供应链|node\.js|nodejs|chrome|v8|webassembly|wasm/.test(text)) {
      return '高';
    }
    return '中';
  }
  if (category === 'devtool-security') {
    if (
      /claude code|cursor|copilot|mcp|workspace|source map|源码|泄露|token|langgraph|langsmith|hugging face|spaces/.test(
        text
      )
    ) {
      return '高';
    }
    return '中';
  }
  if (category === 'general-security') {
    return /\b(rce|critical|high severity|privilege|bypass|escape)\b/.test(text) ? '高' : '中';
  }
  if (category === 'ai-tech') {
    if (/openai|reasoning|agent|推理|模型|api/.test(text)) {
      return '高';
    }
    return '中';
  }
  if (category === 'backend-tech') {
    return /\b(node\.js|nodejs|bun|deno|go|rust|java|spring|dotnet|\.net|breaking|migration)\b/.test(text)
      ? '高'
      : '中';
  }
  if (category === 'cloud-infra-tech') {
    return /\b(kubernetes|docker|terraform|serverless|github actions|gitlab ci|deployment|orchestration)\b/.test(text)
      ? '高'
      : '中';
  }
  if (/react|vite|next|vue|typescript/.test(text)) {
    return '高';
  }
  if (/eslint|webpack|rollup|tooling|构建/.test(text)) {
    return '中';
  }
  return '低';
}

function describeStackRelevance(item: TechBriefingItem) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  const matched = [
    'react',
    'vite',
    'next',
    'vue',
    'typescript',
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
    'claude code',
    'mcp',
    'langgraph',
    'langsmith',
    'hugging face',
    'spaces',
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
    'redis',
    'linux',
    'windows',
    'macos',
    'aws'
  ].filter(keyword => text.includes(keyword));
  if (matched.length >= 2) {
    return { level: '高' as const, note: `高度相关（命中 ${matched.join(' / ')}）` };
  }
  if (matched.length === 1) {
    return { level: '中' as const, note: `中度相关（命中 ${matched[0]}）` };
  }
  return { level: '低' as const, note: '低相关（未直接命中当前核心栈关键词）' };
}
