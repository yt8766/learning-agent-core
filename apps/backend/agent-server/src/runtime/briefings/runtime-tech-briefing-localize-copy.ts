import type { TechBriefingCategory } from './runtime-tech-briefing.types';

const REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bofficial\b/gi, '官方'],
  [/\bupdate(s)?\b/gi, '更新'],
  [/\brelease notes?\b/gi, '发布说明'],
  [/\brelease\b/gi, '发布'],
  [/\bsecurity advisory\b/gi, '安全公告'],
  [/\bsupply chain\b/gi, '供应链'],
  [/\bissue\b/gi, '问题'],
  [/\bpatched?\b/gi, '已修复'],
  [/\bvulnerability\b/gi, '漏洞'],
  [/\bmalware\b/gi, '恶意软件'],
  [/\bcompromis(ed|e)?\b/gi, '被攻破'],
  [/\bcapability\b/gi, '能力'],
  [/\bcapabilities\b/gi, '能力'],
  [/\bfeature(s)?\b/gi, '特性'],
  [/\bmodel(s)?\b/gi, '模型'],
  [/\bagent(s)?\b/gi, '智能体'],
  [/\breasoning\b/gi, '推理'],
  [/\bperformance\b/gi, '性能'],
  [/\bsupport(s|ed|ing)?\b/gi, '支持'],
  [/\blaunch(ed|es)?\b/gi, '发布'],
  [/\bimprove(d|ment|s)?\b/gi, '改进'],
  [/\bAPI\b/g, 'API'],
  [/\bfrontend\b/gi, '前端'],
  [/\btooling\b/gi, '工具链'],
  [/\bworkflow(s)?\b/gi, '工作流']
];

export function localizeFeedItem(category: TechBriefingCategory, sourceName: string, title: string, summary: string) {
  const normalizedTitle = normalizeWhitespace(title);
  const normalizedSummary = normalizeWhitespace(summary || title);
  const translatedTitle = toChineseTechText(normalizedTitle);
  const translatedSummary = toChineseTechText(normalizedSummary);
  return {
    title: buildFeedTitle(category, sourceName, translatedTitle || normalizedTitle),
    summary: buildFeedSummary(
      category,
      sourceName,
      translatedTitle || normalizedTitle,
      translatedSummary || normalizedSummary
    )
  };
}

export function localizeSecurityItem(keyword: string, cveId: string, description: string) {
  const translated = toChineseTechText(description);
  return {
    title: `${keyword} 安全通告：${cveId}`,
    summary: `NVD 在最近一周收录了与 ${keyword} 相关的官方漏洞记录。核心说明：${translated || description}`
  };
}

function buildFeedTitle(category: TechBriefingCategory, sourceName: string, translatedTitle: string) {
  const cleaned = stripTrailingPunctuation(translatedTitle);
  if (containsChinese(cleaned)) {
    return cleaned;
  }
  const label =
    category === 'ai-tech'
      ? 'AI 技术更新'
      : category === 'devtool-security'
        ? '开发工具安全更新'
        : category === 'general-security'
          ? '通用安全更新'
          : category === 'backend-tech'
            ? '后端技术更新'
            : category === 'cloud-infra-tech'
              ? '云原生更新'
              : '前端工程更新';
  return `${sourceName} ${label}`;
}

function buildFeedSummary(
  category: TechBriefingCategory,
  sourceName: string,
  translatedTitle: string,
  translatedSummary: string
) {
  const titleSentence = stripTrailingPunctuation(translatedTitle);
  const summarySentence = stripTrailingPunctuation(translatedSummary);
  if (category === 'ai-tech') {
    return `${titleSentence}。${summarySentence}`;
  }
  if (category === 'devtool-security') {
    return `${sourceName} 发布了新的开发工具安全说明。${summarySentence}`;
  }
  if (category === 'frontend-tech' || category === 'backend-tech' || category === 'cloud-infra-tech') {
    return `${titleSentence}。${summarySentence}`;
  }
  if (category === 'general-security') {
    return `${sourceName} 发布了新的基础设施安全说明。${summarySentence}`;
  }
  return `${sourceName} 发布了新的安全说明。${summarySentence}`;
}

function toChineseTechText(input: string) {
  let output = normalizeWhitespace(input);
  for (const [pattern, replacement] of REPLACEMENTS) {
    output = output.replace(pattern, replacement);
  }
  output = output.replace(/\s+/g, ' ').trim();
  return output;
}

function containsChinese(value: string) {
  return /[\u4e00-\u9fff]/.test(value);
}

function stripTrailingPunctuation(value: string) {
  return value.replace(/[。.!！?？]+$/g, '').trim();
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}
