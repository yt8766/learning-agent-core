import { DEFAULT_QUERY_KEYWORD_LIMIT, DEFAULT_QUERY_VARIANT_LIMIT } from './retrieval-runtime-defaults';

const QUESTION_PREFIX_RULES: Array<{ pattern: RegExp; replacement: string; reason: string }> = [
  {
    pattern: /^(?:how\s+(?:do|can|should)\s+i|how\s+to)\s+/i,
    replacement: '',
    reason: 'removed question framing'
  },
  {
    pattern:
      /^(?:what\s+is|what's|what\s+are|what\s+does|where\s+is|why\s+is|can\s+i|should\s+i|do\s+i\s+need\s+to|do\s+i)\s+/i,
    replacement: '',
    reason: 'removed conversational prefix'
  },
  {
    pattern: /^(?:please\s+)?(?:help\s+me\s+)?(?:find|understand|fix|build|set\s+up|configure|create|write)\s+/i,
    replacement: '',
    reason: 'removed request framing'
  }
];

const CHINESE_REWRITE_RULES: Array<{ pattern: RegExp; replacement: string; reason: string }> = [
  {
    pattern: /咋样/g,
    replacement: '怎么样',
    reason: 'normalized colloquial chinese phrasing'
  },
  {
    pattern: /咋办/g,
    replacement: '怎么处理',
    reason: 'normalized colloquial chinese phrasing'
  },
  {
    pattern: /有啥/g,
    replacement: '有什么',
    reason: 'normalized colloquial chinese phrasing'
  },
  {
    pattern: /咋/g,
    replacement: '怎么',
    reason: 'normalized colloquial chinese phrasing'
  },
  {
    pattern: /啥/g,
    replacement: '什么',
    reason: 'normalized colloquial chinese phrasing'
  },
  {
    pattern: /搞得/g,
    replacement: '做得',
    reason: 'normalized colloquial chinese phrasing'
  },
  {
    pattern: /更准一点/g,
    replacement: '更准确',
    reason: 'normalized colloquial chinese phrasing'
  }
];

const STOP_WORDS = new Set([
  'a',
  'about',
  'after',
  'again',
  'all',
  'also',
  'an',
  'and',
  'any',
  'are',
  'as',
  'at',
  'be',
  'because',
  'been',
  'before',
  'between',
  'but',
  'by',
  'can',
  'could',
  'do',
  'does',
  'for',
  'from',
  'get',
  'go',
  'have',
  'how',
  'i',
  'if',
  'in',
  'into',
  'is',
  'it',
  'its',
  'just',
  'like',
  'me',
  'need',
  'of',
  'on',
  'or',
  'please',
  'should',
  'so',
  'some',
  'than',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'to',
  'under',
  'up',
  'use',
  'want',
  'was',
  'we',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'will',
  'with',
  'would',
  'you'
]);

export interface QueryRewriteResult {
  query: string;
  applied: boolean;
  reason?: string;
}

export function cleanQueryText(query: string): string {
  return query
    .replace(/[\u3000\t\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.,!?;:，。！？；：、“”"'`~-]+/, '')
    .replace(/[\s.,!?;:，。！？；：、“”"'`~-]+$/, '')
    .trim();
}

/**
 * Applies deterministic rewrite rules before retrieval.
 * Chinese colloquial normalization wins before English request-prefix removal so CJK intent words are preserved.
 */
export function rewriteQueryText(query: string): QueryRewriteResult {
  const cleanedQuery = cleanQueryText(query);
  let rewrittenQuery = cleanedQuery;

  for (const rule of CHINESE_REWRITE_RULES) {
    rewrittenQuery = rewrittenQuery.replace(rule.pattern, rule.replacement);
  }
  rewrittenQuery = cleanQueryText(rewrittenQuery);

  if (rewrittenQuery && rewrittenQuery !== cleanedQuery) {
    return {
      query: rewrittenQuery,
      applied: true,
      reason: 'normalized colloquial chinese phrasing'
    };
  }

  for (const rule of QUESTION_PREFIX_RULES) {
    const rewritten = cleanQueryText(cleanedQuery.replace(rule.pattern, rule.replacement));
    if (rewritten && rewritten !== cleanedQuery) {
      return {
        query: rewritten,
        applied: true,
        reason: rule.reason
      };
    }
  }

  return {
    query: cleanedQuery,
    applied: false
  };
}

export function extractQueryKeywords(query: string): string[] {
  const cleanedQuery = cleanQueryText(query).toLowerCase();
  const tokens = cleanedQuery.match(/[a-z0-9]+(?:'[a-z0-9]+)?|[\u4e00-\u9fff]+/gi) ?? [];
  const keywords: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const normalizedToken = token.toLowerCase();
    if (STOP_WORDS.has(normalizedToken)) {
      continue;
    }

    if (seen.has(normalizedToken)) {
      continue;
    }

    seen.add(normalizedToken);
    keywords.push(token);

    if (keywords.length >= DEFAULT_QUERY_KEYWORD_LIMIT) {
      break;
    }
  }

  return keywords;
}

/**
 * Builds the ordered fallback query list used by retrieval.
 * Keep the normalized query first and original query second so recall can recover when rewriting is too aggressive.
 */
export function buildQueryVariants(originalQuery: string, normalizedQuery: string): string[] {
  const primaryVariant = cleanQueryText(normalizedQuery);
  const variants = primaryVariant ? [primaryVariant] : [];
  const cleanedOriginalQuery = cleanQueryText(originalQuery);

  if (cleanedOriginalQuery && cleanedOriginalQuery !== primaryVariant) {
    variants.push(cleanedOriginalQuery);
  }

  const keywordQuery = extractQueryKeywords(primaryVariant).join(' ');
  if (keywordQuery && keywordQuery !== primaryVariant) {
    variants.push(keywordQuery);
  }

  const dedupedVariants: string[] = [];
  const seen = new Set<string>();

  for (const variant of variants) {
    const cleanedVariant = cleanQueryText(variant);
    if (!cleanedVariant || seen.has(cleanedVariant.toLowerCase())) {
      continue;
    }

    seen.add(cleanedVariant.toLowerCase());
    dedupedVariants.push(cleanedVariant);

    if (dedupedVariants.length >= DEFAULT_QUERY_VARIANT_LIMIT) {
      break;
    }
  }

  return dedupedVariants;
}
