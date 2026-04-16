import { createHash } from 'node:crypto';

import type {
  TechBriefingCategory,
  TechBriefingDisplaySeverity,
  TechBriefingItem,
  TechBriefingUpdateStatus
} from './runtime-tech-briefing.types';
import { computePriorityScore } from './runtime-tech-briefing-ranking-policy';
import { hasStackToken, normalizeTopicSegment } from './runtime-tech-briefing-ranking-shared';

export function annotateStableMetadata(item: TechBriefingItem): TechBriefingItem {
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
