import { createHash } from 'node:crypto';

import { ActionIntent } from '@agent/shared';

import {
  FEED_SOURCES,
  FRONTEND_SECURITY_PAGE_SOURCES,
  FRONTEND_SECURITY_SOURCES
} from './runtime-tech-briefing-sources';
import { collectFeedItems, collectNvdItems, collectSecurityPageItems } from './runtime-tech-briefing-parsers';
import { finalizeItemsForRanking, rankItems } from './runtime-tech-briefing-ranking';
import { translateBriefingItems } from './runtime-tech-briefing-translate';
import { computePreferenceScore, enrichActionMetadata } from './runtime-tech-briefing-item-enrichment';
import type { BriefingSettings } from './runtime-tech-briefing-schedule';
import type { TechBriefingCategory, TechBriefingItem } from './runtime-tech-briefing.types';

export interface RuntimeTechBriefingCollectorContext {
  workspaceRoot: string;
  settings: {
    dailyTechBriefing: BriefingSettings;
  };
  fetchImpl?: typeof fetch;
  mcpClientManager?: {
    hasCapability: (capabilityId: string) => boolean;
    invokeTool: (
      toolName: string,
      request: {
        taskId: string;
        toolName: string;
        intent: ActionIntent;
        input: Record<string, unknown>;
        requestedBy: 'agent' | 'user';
      }
    ) => Promise<{
      ok: boolean;
      rawOutput?: unknown;
      errorMessage?: string;
    }>;
  };
  translateText?: (input: {
    category: TechBriefingCategory;
    title: string;
    summary: string;
    sourceName: string;
  }) => Promise<{ title: string; summary: string }>;
  readBriefingFeedback: (workspaceRoot: string) => Promise<
    Array<{
      messageKey: string;
      category: TechBriefingCategory;
      feedbackType: 'helpful' | 'notHelpful';
      reasonTag?: string;
    }>
  >;
}

const MCP_DISCOVERY_QUERIES: Record<TechBriefingCategory, string[]> = {
  'frontend-security': ['frontend security advisory javascript npm chrome node.js'],
  'general-security': ['linux windows macos docker kubernetes postgres redis security advisory'],
  'devtool-security': ['claude code cursor mcp security advisory workspace trust'],
  'ai-tech': ['OpenAI Anthropic Google AI LangChain LangGraph AI release blog'],
  'frontend-tech': ['React Next.js Vue Vite TypeScript release blog'],
  'backend-tech': ['Node.js Bun Deno Go Rust Spring .NET release blog'],
  'cloud-infra-tech': ['Kubernetes Docker Terraform GitHub Actions GitLab CI release blog']
};

export async function collectBriefingCategoryItems(params: {
  category: TechBriefingCategory;
  now: Date;
  lookbackDays: number;
  context: RuntimeTechBriefingCollectorContext;
}) {
  const fetchImpl = params.context.fetchImpl ?? fetch;
  if (
    params.category === 'frontend-security' ||
    params.category === 'general-security' ||
    params.category === 'devtool-security'
  ) {
    const items = await Promise.allSettled([
      ...(params.category === 'frontend-security' || params.category === 'general-security'
        ? FRONTEND_SECURITY_SOURCES.filter(source => source.category === params.category).map(source =>
            collectNvdItems(source, params.now, params.lookbackDays, fetchImpl)
          )
        : []),
      ...FRONTEND_SECURITY_PAGE_SOURCES.filter(source => source.category === params.category).map(source =>
        collectSecurityPageItems(source, params.now, params.lookbackDays, fetchImpl)
      )
    ]);
    const normalized = items.flatMap(result => (result.status === 'fulfilled' ? result.value : []));
    return finalizeBriefingCollectedItems({
      category: params.category,
      items: normalized,
      now: params.now,
      context: params.context
    });
  }

  const categorySources = FEED_SOURCES.filter(source => source.category === params.category);
  const settled = await Promise.allSettled(
    categorySources.map(source => collectFeedItems(source, params.category, params.now, params.lookbackDays, fetchImpl))
  );
  return finalizeBriefingCollectedItems({
    category: params.category,
    items: settled.flatMap(result => (result.status === 'fulfilled' ? result.value : [])),
    now: params.now,
    context: params.context
  });
}

async function finalizeBriefingCollectedItems(params: {
  category: TechBriefingCategory;
  items: TechBriefingItem[];
  now: Date;
  context: RuntimeTechBriefingCollectorContext;
}) {
  const finalized = await finalizeItemsForRanking(params.category, params.items, params.context.workspaceRoot);
  const supplemental = await collectSearchMcpItems(params.category, params.now, params.context);
  const translated = await translateBriefingItems(
    params.category,
    rankItems(params.category, finalized.concat(supplemental), params.context.settings.dailyTechBriefing.sourcePolicy),
    { settings: params.context.settings as any, translateText: params.context.translateText }
  );
  return applyPreferenceRanking(
    params.category,
    translated.map(item => enrichActionMetadata(item)),
    params.context
  );
}

async function collectSearchMcpItems(
  category: TechBriefingCategory,
  now: Date,
  context: RuntimeTechBriefingCollectorContext
): Promise<TechBriefingItem[]> {
  const mcpClientManager = context.mcpClientManager;
  if (!mcpClientManager?.hasCapability('webSearchPrime')) {
    return [];
  }

  const candidates: TechBriefingItem[] = [];
  for (const query of MCP_DISCOVERY_QUERIES[category] ?? []) {
    const result = await mcpClientManager.invokeTool('webSearchPrime', {
      taskId: `briefing-${category}-${now.getTime()}`,
      toolName: 'webSearchPrime',
      intent: ActionIntent.CALL_EXTERNAL_API,
      input: {
        query,
        goal: `Collect latest ${category} briefing updates`,
        freshnessHint: category.includes('security') ? 'urgent' : 'recent'
      },
      requestedBy: 'agent'
    });
    if (!result.ok) {
      continue;
    }
    candidates.push(...toMcpSearchItems(category, now, result.rawOutput));
  }

  return dedupeMcpSearchItems(candidates);
}

async function applyPreferenceRanking(
  category: TechBriefingCategory,
  items: TechBriefingItem[],
  context: RuntimeTechBriefingCollectorContext
) {
  if (items.length <= 1) {
    return items;
  }
  const feedback = await context.readBriefingFeedback(context.workspaceRoot);
  if (feedback.length === 0) {
    return items;
  }

  const positiveSourceNames = new Set<string>();
  const negativeSourceNames = new Set<string>();
  const positiveReasonTags = new Set<string>();
  const negativeReasonTags = new Set<string>();
  const feedbackByKey = new Map<string, { helpful: number; notHelpful: number }>();

  for (const record of feedback) {
    if (record.category !== category) {
      continue;
    }
    const current = feedbackByKey.get(record.messageKey) ?? { helpful: 0, notHelpful: 0 };
    if (record.feedbackType === 'helpful') {
      current.helpful += 1;
      if (record.reasonTag) {
        positiveReasonTags.add(record.reasonTag);
      }
    } else {
      current.notHelpful += 1;
      if (record.reasonTag) {
        negativeReasonTags.add(record.reasonTag);
      }
    }
    feedbackByKey.set(record.messageKey, current);
  }

  for (const item of items) {
    const stats = feedbackByKey.get(item.messageKey ?? '');
    if (!stats) {
      continue;
    }
    if (stats.helpful > stats.notHelpful) {
      positiveSourceNames.add(item.sourceName);
    }
    if (stats.notHelpful > stats.helpful) {
      negativeSourceNames.add(item.sourceName);
    }
  }

  return items
    .map((item, index) => ({
      item,
      index,
      preferenceScore: computePreferenceScore(item, {
        positiveSourceNames,
        negativeSourceNames,
        positiveReasonTags,
        negativeReasonTags
      })
    }))
    .sort((left, right) => right.preferenceScore - left.preferenceScore || left.index - right.index)
    .map(entry => entry.item);
}

export function toMcpSearchItems(category: TechBriefingCategory, now: Date, payload: unknown): TechBriefingItem[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }
  const results = Array.isArray((payload as { results?: unknown[] }).results)
    ? ((payload as { results?: unknown[] }).results as unknown[])
    : [];

  return results
    .map(result => toMcpSearchItem(category, now, result))
    .filter((item): item is TechBriefingItem => Boolean(item));
}

function toMcpSearchItem(category: TechBriefingCategory, now: Date, result: unknown): TechBriefingItem | undefined {
  if (!result || typeof result !== 'object') {
    return undefined;
  }
  const raw = result as Record<string, unknown>;
  const url = typeof raw.url === 'string' ? raw.url : undefined;
  const title = typeof raw.title === 'string' ? raw.title : undefined;
  const summary = typeof raw.summary === 'string' ? raw.summary : undefined;
  if (!url || !title || !summary) {
    return undefined;
  }

  const sourceMeta = resolveSearchSourceMeta(category, url);
  if (!sourceMeta) {
    return undefined;
  }

  return {
    id: createHash('sha1').update(`mcp:${category}:${url}`).digest('hex').slice(0, 12),
    category,
    title,
    cleanTitle: title,
    url,
    publishedAt: typeof raw.fetchedAt === 'string' ? raw.fetchedAt : now.toISOString(),
    sourceName: sourceMeta.name,
    sourceUrl: sourceMeta.sourceUrl,
    sourceType: 'official-page',
    authorityTier: sourceMeta.authorityTier,
    sourceGroup: sourceMeta.sourceGroup,
    contentKind: sourceMeta.contentKind,
    summary,
    confidence: 0.72,
    sourceLabel: `${sourceMeta.name} / MCP Search`,
    relevanceReason: `由 BigModel Web Search MCP 补充发现，命中 ${category} 白名单来源`,
    technicalityScore: 3,
    crossVerified: false
  };
}

function resolveSearchSourceMeta(category: TechBriefingCategory, url: string) {
  const hostname = safeHostname(url);
  if (!hostname) {
    return undefined;
  }

  const allSources = [
    ...FEED_SOURCES.filter(source => source.category === category).map(source => ({
      name: source.name,
      sourceUrl: source.sourceUrl,
      authorityTier: source.authorityTier,
      sourceGroup: source.sourceGroup,
      contentKind: source.contentKind
    })),
    ...FRONTEND_SECURITY_PAGE_SOURCES.filter(source => source.category === category).map(source => ({
      name: source.name,
      sourceUrl: source.sourceUrl,
      authorityTier: source.authorityTier,
      sourceGroup: source.sourceGroup,
      contentKind: source.contentKind
    }))
  ];

  return allSources.find(source => {
    const sourceHost = safeHostname(source.sourceUrl);
    return sourceHost ? hostname === sourceHost || hostname.endsWith(`.${sourceHost}`) : false;
  });
}

function safeHostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

function dedupeMcpSearchItems(items: TechBriefingItem[]) {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = `${item.category}:${item.url}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
