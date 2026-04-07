import { createHash } from 'node:crypto';

import type {
  FeedSourceRecord,
  NvdKeywordSourceRecord,
  SecurityPageSourceRecord
} from './runtime-tech-briefing-sources';
import type { TechBriefingCategory, TechBriefingItem } from './runtime-tech-briefing.types';
import { localizeFeedItem, localizeSecurityItem } from './runtime-tech-briefing-localize';
import {
  buildRelevanceReason,
  cleanTitle,
  computeTechnicalityScore,
  decodeXml,
  extractHeading,
  extractHtmlTitle,
  extractMediaSummary,
  extractPrimaryContent,
  extractSummary,
  stripTagsWithNewlines,
  summarizeText
} from './runtime-tech-briefing-parser-helpers';

const FETCH_TIMEOUT_MS = 12_000;

export async function collectFeedItems(
  source: FeedSourceRecord,
  category: TechBriefingCategory,
  now: Date,
  lookbackDays: number,
  fetchImpl: typeof fetch
): Promise<TechBriefingItem[]> {
  const response = await fetchWithTimeout(fetchImpl, source.feedUrl);
  if (!response.ok) {
    throw new Error(`feed_fetch_failed:${source.feedUrl}:${response.status}`);
  }
  const xml = await response.text();
  const items = parseFeedEntries(xml)
    .map(entry => toFeedItem(entry, source, category))
    .filter(item => isWithinLookback(item.publishedAt, now, lookbackDays))
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
  return dedupeItems(items);
}

export async function collectNvdItems(
  source: NvdKeywordSourceRecord,
  now: Date,
  lookbackDays: number,
  fetchImpl: typeof fetch
): Promise<TechBriefingItem[]> {
  const startDate = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const requests = source.keywords.map(async keyword => {
    const url = new URL('https://services.nvd.nist.gov/rest/json/cves/2.0');
    url.searchParams.set('keywordSearch', keyword);
    url.searchParams.set('pubStartDate', startDate);
    url.searchParams.set('resultsPerPage', '10');
    const response = await fetchWithTimeout(fetchImpl, url.toString());
    if (!response.ok) {
      throw new Error(`nvd_fetch_failed:${keyword}:${response.status}`);
    }
    const payload = (await response.json()) as {
      vulnerabilities?: Array<{
        cve?: {
          id?: string;
          published?: string;
          descriptions?: Array<{ lang?: string; value?: string }>;
        };
      }>;
    };
    return (payload.vulnerabilities ?? [])
      .map(item => item.cve)
      .filter(Boolean)
      .map(cve => {
        const cveId = cve?.id ?? keyword;
        const description =
          cve?.descriptions?.find(entry => entry.lang === 'en')?.value ??
          cve?.descriptions?.[0]?.value ??
          `${keyword} 近期出现新的官方漏洞记录。`;
        const localized = localizeSecurityItem(keyword, cveId, description);
        return {
          id: createStableId(source.id, cveId),
          category: source.category,
          title: localized.title,
          url: `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cveId)}`,
          publishedAt: cve?.published ?? now.toISOString(),
          sourceName: source.name,
          sourceUrl: source.sourceUrl,
          sourceType: source.sourceType,
          authorityTier: source.authorityTier,
          sourceGroup: source.sourceGroup,
          contentKind: source.contentKind,
          summary: summarizeText(localized.summary, 320),
          confidence: 0.96,
          sourceLabel: `${source.name} / ${keyword}`,
          relevanceReason: `命中${source.category === 'general-security' ? '基础设施安全' : '前端安全'}关键词 ${keyword}`,
          technicalityScore: 5,
          crossVerified: false
        } satisfies TechBriefingItem;
      });
  });
  const results = await Promise.allSettled(requests);
  return dedupeItems(
    results
      .flatMap(result => (result.status === 'fulfilled' ? result.value : []))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  );
}

export async function collectSecurityPageItems(
  source: SecurityPageSourceRecord,
  now: Date,
  lookbackDays: number,
  fetchImpl: typeof fetch
): Promise<TechBriefingItem[]> {
  const response = await fetchWithTimeout(fetchImpl, source.pageUrl);
  if (!response.ok) {
    throw new Error(`security_page_fetch_failed:${source.pageUrl}:${response.status}`);
  }
  const html = await response.text();
  const page = parseSecurityPage(html, source, now);
  if (!page || !isWithinLookback(page.publishedAt, now, lookbackDays)) {
    return [];
  }
  return [page];
}

function parseFeedEntries(xml: string) {
  const entries = extractBlocks(xml, 'item');
  if (entries.length > 0) {
    return entries.map(block => ({
      title: decodeXml(extractField(block, 'title')),
      link: decodeXml(extractField(block, 'link')),
      publishedAt: decodeXml(extractField(block, 'pubDate')) || decodeXml(extractField(block, 'published')),
      summary: decodeXml(extractField(block, 'description') || extractField(block, 'content:encoded'))
    }));
  }

  return extractBlocks(xml, 'entry').map(block => ({
    title: decodeXml(extractField(block, 'title')),
    link: decodeXml(extractAtomLink(block)),
    publishedAt: decodeXml(extractField(block, 'updated') || extractField(block, 'published')),
    summary: decodeXml(extractField(block, 'summary') || extractField(block, 'content'))
  }));
}

function parseSecurityPage(html: string, source: SecurityPageSourceRecord, now: Date): TechBriefingItem | null {
  const primaryContent = extractPrimaryContent(html);
  const title = cleanTitle(extractHtmlTitle(html) || extractHeading(primaryContent) || source.name);
  const text = stripTagsWithNewlines(primaryContent);
  const summary = summarizeText(
    source.pageKind === 'media-incident' ? extractMediaSummary(text) : extractSummary(text),
    320
  );
  const extractedPublishedAt = extractSecurityPagePublishedAt(html, text, source);
  if (!extractedPublishedAt) {
    return null;
  }
  const publishedAt = normalizeDate(extractedPublishedAt);
  if (!summary) {
    return null;
  }

  const localized = localizeSecurityItem(source.name, normalizeSecurityTitle(title), summary);
  return {
    id: createStableId(source.id, source.pageUrl),
    category: source.category,
    title: source.pageKind === 'gitlab-advisory' ? localized.title : summarizeText(title, 160),
    cleanTitle: summarizeText(title, 120),
    url: source.pageUrl,
    publishedAt,
    sourceName: source.name,
    sourceUrl: source.sourceUrl,
    sourceType: source.sourceType,
    authorityTier: source.authorityTier,
    sourceGroup: source.sourceGroup,
    contentKind: source.contentKind,
    summary:
      source.pageKind === 'gitlab-advisory'
        ? summarizeText(localized.summary, 320)
        : summarizeText(localizeFeedItem(source.category, source.name, title, summary).summary, 320),
    confidence: source.authorityTier === 'official-advisory' ? 0.95 : 0.84,
    sourceLabel: source.name,
    relevanceReason: buildRelevanceReason(source.category, `${title} ${summary}`),
    technicalityScore: computeTechnicalityScore(source.category, title, summary, source.contentKind),
    crossVerified: false
  };
}

function extractSecurityPagePublishedAt(html: string, text: string, source: SecurityPageSourceRecord) {
  if (source.pageKind === 'github-advisory') {
    return extractGithubAdvisoryPublishedAt(html, text);
  }
  if (source.id === 'apifox-official-incident') {
    return extractApifoxIncidentPublishedAt(html, text);
  }
  return extractPageDate(text);
}

function extractApifoxIncidentPublishedAt(html: string, text: string) {
  const rebuiltAt =
    html.match(/algoliaDocSearchRebuiltAt[^0-9]*(20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)/i)?.[1] ??
    html.match(
      /algoliaDocSearchRebuiltAt["']?\s*[:=]\s*["'](20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)["']/i
    )?.[1];
  if (rebuiltAt) {
    return rebuiltAt;
  }
  return extractPageDate(text);
}

function toFeedItem(
  entry: { title: string; link: string; publishedAt: string; summary: string },
  source: FeedSourceRecord,
  category: TechBriefingCategory
): TechBriefingItem {
  const cleanedTitle = cleanTitle(entry.title);
  const localized = localizeFeedItem(category, source.name, cleanedTitle, entry.summary || entry.title);
  return {
    id: createStableId(source.id, entry.link || entry.title),
    category,
    title: summarizeText(localized.title, 160),
    cleanTitle: summarizeText(cleanedTitle, 120),
    url: entry.link,
    publishedAt: normalizeDate(entry.publishedAt),
    sourceName: source.name,
    sourceUrl: source.sourceUrl,
    sourceType: source.sourceType,
    authorityTier: source.authorityTier,
    sourceGroup: source.sourceGroup,
    contentKind: source.contentKind,
    summary: summarizeText(localized.summary, 320),
    confidence: source.authorityTier === 'official-release' ? 0.94 : 0.9,
    sourceLabel: source.name,
    relevanceReason: buildRelevanceReason(category, `${entry.title} ${entry.summary}`),
    technicalityScore: computeTechnicalityScore(category, entry.title, entry.summary, source.contentKind),
    crossVerified: false
  };
}

function extractBlocks(xml: string, tagName: string) {
  const pattern = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  return Array.from(xml.matchAll(pattern)).map(match => match[1] ?? '');
}

function extractField(block: string, tagName: string) {
  const pattern = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  return block.match(pattern)?.[1]?.trim() ?? '';
}

function extractAtomLink(block: string) {
  const explicitAlternate = block.match(/<link[^>]+rel="alternate"[^>]+href="([^"]+)"/i)?.[1];
  if (explicitAlternate) {
    return explicitAlternate;
  }
  return block.match(/<link[^>]+href="([^"]+)"/i)?.[1] ?? '';
}

function extractPageDate(text: string) {
  const iso = text.match(/\b20\d{2}-\d{2}-\d{2}\b/)?.[0];
  if (iso) {
    return `${iso}T00:00:00.000Z`;
  }

  const chinese = text.match(/\b(20\d{2})年(\d{1,2})月(\d{1,2})日\b/);
  if (chinese) {
    const [, year, month, day] = chinese;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`;
  }

  const english = text.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2}),\s*(20\d{2})\b/i
  );
  if (english) {
    const [, monthName, day, year] = english;
    const month = normalizeEnglishMonth(monthName);
    return `${year}-${month}-${day.padStart(2, '0')}T00:00:00.000Z`;
  }

  return undefined;
}

async function fetchWithTimeout(fetchImpl: typeof fetch, input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  timeout.unref?.();

  try {
    return await fetchImpl(input, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`fetch_timeout:${String(input)}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function extractGithubAdvisoryPublishedAt(html: string, text: string) {
  const htmlPublished = decodeXml(html.match(/Published\s+([A-Z][a-z]{2,8}\s+\d{1,2},\s*20\d{2})/i)?.[1] ?? '').trim();
  if (htmlPublished) {
    return extractPageDate(htmlPublished);
  }

  const textPublished = text.match(/Published\s+([A-Z][a-z]{2,8}\s+\d{1,2},\s*20\d{2})/i)?.[1];
  if (textPublished) {
    return extractPageDate(textPublished);
  }

  return undefined;
}

function normalizeSecurityTitle(title: string) {
  const cveId = title.match(/CVE-\d{4}-\d+/i)?.[0];
  return cveId ?? title;
}

function normalizeDate(value: string) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? new Date(0).toISOString() : new Date(timestamp).toISOString();
}

function normalizeEnglishMonth(monthName: string) {
  const normalized = monthName.toLowerCase();
  const months = new Map<string, string>([
    ['january', '01'],
    ['jan', '01'],
    ['february', '02'],
    ['feb', '02'],
    ['march', '03'],
    ['mar', '03'],
    ['april', '04'],
    ['apr', '04'],
    ['may', '05'],
    ['june', '06'],
    ['jun', '06'],
    ['july', '07'],
    ['jul', '07'],
    ['august', '08'],
    ['aug', '08'],
    ['september', '09'],
    ['sep', '09'],
    ['sept', '09'],
    ['october', '10'],
    ['oct', '10'],
    ['november', '11'],
    ['nov', '11'],
    ['december', '12'],
    ['dec', '12']
  ]);
  return months.get(normalized) ?? '01';
}

function createStableId(prefix: string, seed: string) {
  return `${prefix}:${createHash('sha1').update(seed).digest('hex').slice(0, 12)}`;
}

function dedupeItems(items: TechBriefingItem[]) {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = `${item.url}|${item.title.toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function isWithinLookback(publishedAt: string, now: Date, lookbackDays: number) {
  const timestamp = Date.parse(publishedAt);
  if (Number.isNaN(timestamp)) {
    return false;
  }
  return timestamp >= now.getTime() - lookbackDays * 24 * 60 * 60 * 1000;
}
