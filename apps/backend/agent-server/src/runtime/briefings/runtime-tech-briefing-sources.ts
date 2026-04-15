import type {
  TechBriefingAuthorityTier,
  TechBriefingCategory,
  TechBriefingContentKind,
  TechBriefingParserKind,
  TechBriefingSourceGroup,
  TechBriefingSourceType
} from './runtime-tech-briefing.types';
import { AI_FEED_SOURCES } from './runtime-tech-briefing-sources-ai';
import { BACKEND_FEED_SOURCES } from './runtime-tech-briefing-sources-backend';
import { CLOUD_INFRA_FEED_SOURCES } from './runtime-tech-briefing-sources-cloud';
import { FRONTEND_FEED_SOURCES } from './runtime-tech-briefing-sources-frontend';
import { FRONTEND_SECURITY_PAGE_SOURCES_DATA } from './runtime-tech-briefing-sources-security-pages';
import { FRONTEND_SECURITY_SOURCES_DATA } from './runtime-tech-briefing-sources-security-keywords';

export interface FeedSourceRecord {
  id: string;
  category: Exclude<TechBriefingCategory, 'frontend-security' | 'general-security' | 'devtool-security'>;
  name: string;
  sourceUrl: string;
  feedUrl: string;
  sourceType: Extract<TechBriefingSourceType, 'rss' | 'atom'>;
  authorityTier: Exclude<TechBriefingAuthorityTier, 'official-advisory'>;
  sourceGroup: Exclude<TechBriefingSourceGroup, 'community'> | 'community';
  contentKind: Exclude<TechBriefingContentKind, 'advisory' | 'incident'>;
  parserKind?: Extract<TechBriefingParserKind, 'feed' | 'community-post'>;
  topicTags?: string[];
}

export interface NvdKeywordSourceRecord {
  id: string;
  category: 'frontend-security' | 'general-security';
  name: string;
  sourceUrl: string;
  sourceType: 'nvd-api';
  authorityTier: 'official-advisory';
  sourceGroup: 'official';
  contentKind: 'advisory';
  parserKind?: 'security-advisory';
  topicTags?: string[];
  keywords: string[];
}

export interface SecurityPageSourceRecord {
  id: string;
  category: 'frontend-security' | 'general-security' | 'devtool-security';
  name: string;
  sourceUrl: string;
  pageUrl: string;
  sourceType: 'security-page' | 'official-page';
  authorityTier: TechBriefingAuthorityTier;
  sourceGroup: TechBriefingSourceGroup;
  contentKind: Extract<TechBriefingContentKind, 'advisory' | 'incident' | 'community-discussion'>;
  parserKind?: Exclude<TechBriefingParserKind, 'feed'>;
  topicTags?: string[];
  pageKind: 'github-advisory' | 'gitlab-advisory' | 'incident-page' | 'media-incident';
}

export const FEED_SOURCES: FeedSourceRecord[] = [
  ...AI_FEED_SOURCES,
  ...FRONTEND_FEED_SOURCES,
  ...BACKEND_FEED_SOURCES,
  ...CLOUD_INFRA_FEED_SOURCES
];

export const FRONTEND_SECURITY_SOURCES: NvdKeywordSourceRecord[] = FRONTEND_SECURITY_SOURCES_DATA;

export const FRONTEND_SECURITY_PAGE_SOURCES: SecurityPageSourceRecord[] = FRONTEND_SECURITY_PAGE_SOURCES_DATA;

export const BRIEFING_CATEGORY_TITLES: Record<TechBriefingCategory, string> = {
  'frontend-security': '前端安全情报',
  'general-security': '通用安全情报',
  'devtool-security': 'Agent / DevTool 安全情报',
  'ai-tech': 'AI 新技术情报',
  'frontend-tech': '前端新技术情报',
  'backend-tech': '后端/全栈新技术',
  'cloud-infra-tech': '云原生与基础设施'
};
