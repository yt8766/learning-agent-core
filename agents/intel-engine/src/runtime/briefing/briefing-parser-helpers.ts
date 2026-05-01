import type { TechBriefingCategory, TechBriefingContentKind } from './briefing.types';

const NOISE_PATTERNS = [
  /gtm\.js/gi,
  /cookie banner/gi,
  /accept all cookies/gi,
  /manage preferences/gi,
  /subscribe/gi,
  /jspath:/gi,
  /csspath:/gi,
  /share this/gi,
  /follow us/gi,
  /newsletter/gi,
  /all rights reserved/gi
];

export function decodeXml(input: string) {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function extractHtmlTitle(html: string) {
  return decodeXml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim();
}

export function extractHeading(html: string) {
  return decodeXml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '')
    .replace(/<[^>]+>/g, ' ')
    .trim();
}

export function extractPrimaryContent(html: string) {
  const body =
    html.match(/<(article|main)[^>]*>([\s\S]*?)<\/\1>/i)?.[2] ??
    html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ??
    html;
  return body
    .replace(/<(script|style|nav|header|footer|button|form|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(aside|figure|svg|dialog)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(div|section)[^>]*(cookie|share|social|subscribe|newsletter)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
}

export function stripTags(input: string) {
  return input
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripTagsWithNewlines(input: string) {
  return decodeXml(input)
    .replace(/<\/(p|div|section|article|li|h1|h2|h3|br)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\n+/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function extractSummary(text: string) {
  const lines = cleanParagraphs(text);
  return lines.slice(0, 2).join(' ');
}

export function extractMediaSummary(text: string) {
  const lines = cleanParagraphs(text);
  if (lines.length <= 2) {
    return lines.join(' ');
  }
  return [
    lines[0],
    ...lines
      .slice(1)
      .filter(line =>
        /\b(api|sdk|agent|workflow|postinstall|rat|adapter|view transition|compiler|runtime|版本|漏洞|供应链)\b/i.test(
          line
        )
      )
      .slice(0, 1)
  ].join(' ');
}

function cleanParagraphs(text: string) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => line.length > 35)
    .filter(line => !/^home|docs|search|sign in|skip to|cookie|share|follow/i.test(line))
    .map(line => NOISE_PATTERNS.reduce((current, pattern) => current.replace(pattern, ''), line))
    .map(line => line.replace(/\{[^}]+\}/g, ' ').replace(/\[[^\]]+\]/g, ' '))
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export function cleanTitle(input: string) {
  return decodeXml(input)
    .replace(
      /\s*[_|｜-]\s*(新浪科技|新浪网|Datadog Security Labs|IT之家|CN-SEC|Axios 安全快讯|Chrome Developers|web\.dev).*$/i,
      ''
    )
    .replace(/\s*[:：]\s*(Datadog Security Labs|Security Labs|官方博客|博客频道)$/i, '')
    .replace(/\s*\|\s*(Datadog Security Labs|GitHub Advisory Database|GitHub)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function summarizeText(input: string, maxLength: number) {
  const text = stripTags(input);
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1).trim()}...`;
}

export function buildRelevanceReason(category: TechBriefingCategory, text: string) {
  const normalized = text.toLowerCase();
  if (category === 'frontend-security') {
    if (
      /\b(axios|apifox|pnpm|npm|node\.js|nodejs|chrome|v8|webassembly|wasm|supply chain|postinstall|rat)\b/.test(
        normalized
      )
    ) {
      return '命中当前前端依赖与供应链风险关键词';
    }
    return '命中前端安全观察范围';
  }
  if (category === 'general-security') {
    if (
      /\b(node\.js|nodejs|postgres|postgresql|redis|kubernetes|docker|linux|windows|macos|aws|azure|gcp)\b/.test(
        normalized
      )
    ) {
      return '命中基础设施与通用安全高风险关键词';
    }
    return '命中基础设施稳定性与通用安全观察范围';
  }
  if (category === 'devtool-security') {
    if (/\b(claude code|cursor|copilot|mcp|workspace trust|source map|token|credential|泄露|源码)\b/.test(normalized)) {
      return '命中当前代码代理与开发工具安全关键词';
    }
    return '命中开发工具与本地工作区安全观察范围';
  }
  if (category === 'ai-tech') {
    if (/\b(agent|workflow|reasoning|model|sdk|api|langchain|langgraph|llm|inference)\b/.test(normalized)) {
      return '命中运行时与 Agent 编排相关主题';
    }
    return '命中 AI 工程能力更新范围';
  }
  if (category === 'backend-tech') {
    if (/\b(node\.js|nodejs|bun|deno|go|rust|java|spring|spring boot|dotnet|\.net)\b/.test(normalized)) {
      return '命中后端运行时、语言与框架观察范围';
    }
    return '命中后端工程与服务端架构观察范围';
  }
  if (category === 'cloud-infra-tech') {
    if (
      /\b(kubernetes|docker|terraform|serverless|edge|cloudflare|vercel|github actions|gitlab ci|cicd|ci\/cd)\b/.test(
        normalized
      )
    ) {
      return '命中云原生、部署编排与 CI/CD 观察范围';
    }
    return '命中云原生与基础设施工程观察范围';
  }
  if (/\b(react|nextjs|next\.js|vite|vue|typescript|rsc|ssr|adapter|view transition|web api)\b/.test(normalized)) {
    return '命中当前核心前端技术栈';
  }
  return '命中前端工程与工具链观察范围';
}

export function computeTechnicalityScore(
  category: TechBriefingCategory,
  title: string,
  summary: string,
  contentKind: TechBriefingContentKind
) {
  const normalized = `${title} ${summary}`.toLowerCase();
  let score = 1;
  if (contentKind === 'release' || contentKind === 'docs-update' || contentKind === 'advisory') {
    score += 2;
  }
  if (
    /\b(api|sdk|adapter|rsc|ssr|benchmark|reasoning|agent|workflow|rat|postinstall|cve|view transition|compiler|runtime)\b/.test(
      normalized
    )
  ) {
    score += 2;
  }
  if (
    (category === 'frontend-security' || category === 'devtool-security') &&
    /\b(axios|apifox|pnpm|npm|node\.js|nodejs|chrome|v8|webassembly|wasm|claude code|mcp)\b/.test(normalized)
  ) {
    score += 1;
  }
  if (
    (category === 'general-security' || category === 'backend-tech' || category === 'cloud-infra-tech') &&
    /\b(kubernetes|docker|terraform|serverless|node\.js|nodejs|go|rust|java|spring|dotnet|\.net|postgres|postgresql|redis|linux|windows|macos|github actions|gitlab ci)\b/.test(
      normalized
    )
  ) {
    score += 1;
  }
  return Math.min(score, 5);
}

export function hasExactTopic(text: string, token: string) {
  const normalized = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${normalized}([^a-z0-9]|$)`, 'i').test(text);
}
