import type { TechBriefingItem, TechBriefingSourceGroup } from './runtime-tech-briefing.types';

export function hasStackToken(text: string, tokens: string[]) {
  return tokens.some(token => {
    const normalized = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${normalized}([^a-z0-9]|$)`, 'i').test(text);
  });
}

export function normalizeTopicSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/chrome developers|langchain blog|google ai blog|the verge|apifox 官方公告|datadog security labs/gi, ' ')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export function extractRelevanceLevel(reason: string) {
  if (reason.includes('当前关注技术域')) {
    return 2;
  }
  if (reason.includes('浏览器能力')) {
    return 2;
  }
  return 1;
}

export function sourceGroupRank(group: TechBriefingSourceGroup) {
  switch (group) {
    case 'official':
      return 3;
    case 'authority':
      return 2;
    default:
      return 1;
  }
}

export function relevanceLevelRank(level: TechBriefingItem['relevanceLevel']) {
  switch (level) {
    case 'immediate':
      return 3;
    case 'team':
      return 2;
    default:
      return 1;
  }
}

export function recommendedActionRank(level: TechBriefingItem['recommendedAction']) {
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
