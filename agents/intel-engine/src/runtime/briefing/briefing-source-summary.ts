import type { TechBriefingCategory, TechBriefingSourceGroup } from './briefing.types';
import { FEED_SOURCES, FRONTEND_SECURITY_PAGE_SOURCES, FRONTEND_SECURITY_SOURCES } from './briefing-sources';

export const BRIEFING_CATEGORY_SOURCE_LABELS: Record<TechBriefingCategory, string[]> = {
  'frontend-security': [...FRONTEND_SECURITY_SOURCES, ...FRONTEND_SECURITY_PAGE_SOURCES]
    .filter(source => source.category === 'frontend-security')
    .map(source => source.name),
  'general-security': [...FRONTEND_SECURITY_SOURCES, ...FRONTEND_SECURITY_PAGE_SOURCES]
    .filter(source => source.category === 'general-security')
    .map(source => source.name),
  'devtool-security': FRONTEND_SECURITY_PAGE_SOURCES.filter(source => source.category === 'devtool-security').map(
    source => source.name
  ),
  'ai-tech': FEED_SOURCES.filter(source => source.category === 'ai-tech').map(source => source.name),
  'frontend-tech': FEED_SOURCES.filter(source => source.category === 'frontend-tech').map(source => source.name),
  'backend-tech': FEED_SOURCES.filter(source => source.category === 'backend-tech').map(source => source.name),
  'cloud-infra-tech': FEED_SOURCES.filter(source => source.category === 'cloud-infra-tech').map(source => source.name)
};

export const BRIEFING_CATEGORY_SOURCE_GROUPS: Record<
  TechBriefingCategory,
  Record<TechBriefingSourceGroup, string[]>
> = {
  'frontend-security': groupSourceNames([
    ...FRONTEND_SECURITY_SOURCES,
    ...FRONTEND_SECURITY_PAGE_SOURCES.filter(source => source.category === 'frontend-security')
  ]),
  'general-security': groupSourceNames([
    ...FRONTEND_SECURITY_SOURCES.filter(source => source.category === 'general-security'),
    ...FRONTEND_SECURITY_PAGE_SOURCES.filter(source => source.category === 'general-security')
  ]),
  'devtool-security': groupSourceNames(
    FRONTEND_SECURITY_PAGE_SOURCES.filter(source => source.category === 'devtool-security')
  ),
  'ai-tech': groupSourceNames(FEED_SOURCES.filter(source => source.category === 'ai-tech')),
  'frontend-tech': groupSourceNames(FEED_SOURCES.filter(source => source.category === 'frontend-tech')),
  'backend-tech': groupSourceNames(FEED_SOURCES.filter(source => source.category === 'backend-tech')),
  'cloud-infra-tech': groupSourceNames(FEED_SOURCES.filter(source => source.category === 'cloud-infra-tech'))
};

function groupSourceNames(
  sources: Array<{ sourceGroup: TechBriefingSourceGroup; name: string }>
): Record<TechBriefingSourceGroup, string[]> {
  return {
    official: sources.filter(source => source.sourceGroup === 'official').map(source => source.name),
    authority: sources.filter(source => source.sourceGroup === 'authority').map(source => source.name),
    community: sources.filter(source => source.sourceGroup === 'community').map(source => source.name)
  };
}
