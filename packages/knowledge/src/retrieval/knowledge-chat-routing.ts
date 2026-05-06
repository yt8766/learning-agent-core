export type KnowledgeChatRouteReason = 'legacy_ids' | 'mentions' | 'metadata_match' | 'fallback_all';

export interface KnowledgeChatRouteBase {
  id: string;
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeChatRouteMention {
  type: 'knowledge_base';
  id?: string;
  label?: string;
  [key: string]: unknown;
}

export interface KnowledgeChatRouteMetadata {
  knowledgeBaseId?: string;
  knowledgeBaseIds?: string[] | string;
  mentions?: KnowledgeChatRouteMention[];
  [key: string]: unknown;
}

export interface ResolveKnowledgeChatRouteInput {
  accessibleBases: readonly KnowledgeChatRouteBase[];
  legacyBaseIds?: readonly string[];
  mentions?: readonly KnowledgeChatRouteMention[];
  metadata?: KnowledgeChatRouteMetadata;
  message: string;
}

export interface ResolveKnowledgeChatRouteResult {
  knowledgeBaseIds: string[];
  reason: KnowledgeChatRouteReason;
}

export type KnowledgeChatRoutingErrorCode = 'knowledge_mention_not_found';

export class KnowledgeChatRoutingError extends Error {
  constructor(
    readonly code: KnowledgeChatRoutingErrorCode,
    message: string,
    readonly mention?: KnowledgeChatRouteMention
  ) {
    super(message);
    this.name = 'KnowledgeChatRoutingError';
  }
}

export function resolveKnowledgeChatRoute(input: ResolveKnowledgeChatRouteInput): ResolveKnowledgeChatRouteResult {
  const legacyBaseIds = unique(input.legacyBaseIds ?? []);
  if (legacyBaseIds.length > 0) {
    return { knowledgeBaseIds: legacyBaseIds, reason: 'legacy_ids' };
  }

  const metadataBaseIds = unique(normalizeMetadataBaseIds(input.metadata));
  if (metadataBaseIds.length > 0) {
    return { knowledgeBaseIds: metadataBaseIds, reason: 'legacy_ids' };
  }

  const mentions = [...(input.metadata?.mentions ?? []), ...(input.mentions ?? [])];
  if (mentions.length > 0) {
    return {
      knowledgeBaseIds: resolveMentionedBaseIds(input.accessibleBases, mentions),
      reason: 'mentions'
    };
  }

  const scoredBases = input.accessibleBases
    .map(base => ({ base, score: scoreBaseMetadata(base, input.message) }))
    .filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score);

  if (scoredBases.length > 0) {
    return {
      knowledgeBaseIds: unique(scoredBases.map(item => item.base.id)),
      reason: 'metadata_match'
    };
  }

  return {
    knowledgeBaseIds: input.accessibleBases.map(base => base.id),
    reason: 'fallback_all'
  };
}

function resolveMentionedBaseIds(
  bases: readonly KnowledgeChatRouteBase[],
  mentions: readonly KnowledgeChatRouteMention[]
): string[] {
  return unique(mentions.map(mention => resolveMentionedBaseId(bases, mention)));
}

function normalizeMetadataBaseIds(metadata: KnowledgeChatRouteMetadata | undefined): string[] {
  const value = metadata?.knowledgeBaseIds ?? metadata?.knowledgeBaseId;
  if (Array.isArray(value)) {
    return value;
  }
  return typeof value === 'string' ? value.split(',') : [];
}

function resolveMentionedBaseId(bases: readonly KnowledgeChatRouteBase[], mention: KnowledgeChatRouteMention): string {
  const idMatch = mention.id ? bases.find(base => base.id === mention.id) : undefined;
  if (idMatch) {
    return idMatch.id;
  }

  const normalizedLabel = normalize(mention.label);
  const labelMatch = normalizedLabel ? bases.find(base => normalize(base.name) === normalizedLabel) : undefined;
  if (labelMatch) {
    return labelMatch.id;
  }

  throw new KnowledgeChatRoutingError(
    'knowledge_mention_not_found',
    `知识库 mention 不存在：${mention.label ?? mention.id ?? ''}`,
    mention
  );
}

function scoreBaseMetadata(base: KnowledgeChatRouteBase, message: string): number {
  const terms = tokenize(message);
  if (terms.length === 0) {
    return 0;
  }
  const metadataTerms = new Set(
    tokenize(`${base.name ?? ''} ${base.description ?? ''} ${metadataText(base.metadata)}`)
  );
  return terms.filter(term => metadataTerms.has(term)).length;
}

function metadataText(metadata: Record<string, unknown> | undefined): string {
  if (!metadata) {
    return '';
  }
  return Object.values(metadata)
    .flatMap(value => (Array.isArray(value) ? value : [value]))
    .filter(value => typeof value === 'string' || typeof value === 'number')
    .join(' ');
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/u)
    .map(term => term.trim())
    .filter(term => term.length > 1 && !term.startsWith('@'));
}

function normalize(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(value => value.length > 0))];
}
