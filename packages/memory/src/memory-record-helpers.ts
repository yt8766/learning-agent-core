import {
  MemoryRecord,
  MemorySearchReason,
  MemorySearchRequest,
  MemorySearchResult,
  ReflectionRecord
} from '@agent/shared';

export function normalizeMemoryRecord(record: MemoryRecord): MemoryRecord {
  const status = record.status ?? 'active';
  const confidence = clamp(record.confidence ?? legacyConfidence(record), 0, 1);
  const importance = clamp(Math.round(record.importance ?? legacyImportance(record)), 1, 10);

  return {
    ...record,
    memoryType: record.memoryType ?? inferMemoryType(record.type),
    scopeType: record.scopeType ?? inferScopeType(record),
    sourceEvidenceIds: record.sourceEvidenceIds ?? record.quarantineEvidenceRefs ?? [],
    relatedEntities: record.relatedEntities ?? inferRelatedEntities(record),
    confidence,
    importance,
    freshnessScore: clamp(record.freshnessScore ?? computeFreshnessScore(record), 0, 1),
    verificationStatus: record.verificationStatus ?? (status === 'disputed' ? 'disputed' : 'unverified'),
    usageMetrics: {
      retrievedCount: record.usageMetrics?.retrievedCount ?? 0,
      injectedCount: record.usageMetrics?.injectedCount ?? 0,
      adoptedCount: record.usageMetrics?.adoptedCount ?? 0,
      dismissedCount: record.usageMetrics?.dismissedCount ?? 0,
      correctedCount: record.usageMetrics?.correctedCount ?? 0,
      lastRetrievedAt: record.usageMetrics?.lastRetrievedAt,
      lastAdoptedAt: record.usageMetrics?.lastAdoptedAt,
      lastDismissedAt: record.usageMetrics?.lastDismissedAt,
      lastCorrectedAt: record.usageMetrics?.lastCorrectedAt
    },
    version: record.version ?? 1,
    status
  };
}

export function isTaskSummaryQuery(query: string) {
  return ['复盘', '总结', 'summary', 'retrospective', 'postmortem', '经验'].some(token => query.includes(token));
}

export function nextVersion(record: MemoryRecord) {
  return (record.version ?? 1) + 1;
}

export function computeFreshnessScore(record: MemoryRecord): number {
  const ageMs = Date.now() - new Date(record.lastUsedAt ?? record.createdAt).getTime();
  const ageDays = Math.max(0, ageMs / (1000 * 60 * 60 * 24));
  return Math.exp(-0.08 * ageDays);
}

export async function buildStructuredSearchResult(
  records: MemoryRecord[],
  request: MemorySearchRequest,
  searchReflections: (query: string, limit: number) => Promise<ReflectionRecord[]>
): Promise<MemorySearchResult> {
  const query = request.query.trim().toLowerCase();
  const limit = request.limit ?? 10;
  const matched = records
    .filter(record => isVisibleForStructuredSearch(record, request))
    .filter(record => {
      if (!query) {
        return true;
      }
      return `${record.summary} ${record.content} ${record.tags.join(' ')}`.toLowerCase().includes(query);
    });

  const scored = matched
    .map(record => {
      const score = scoreMemoryRecord(record, request);
      return {
        record,
        score,
        reason: buildReason(record, request, score)
      };
    })
    .filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score);

  const reflections = request.includeReflections ? await searchReflections(request.query, limit) : [];
  const reasons: MemorySearchReason[] = [
    ...scored.slice(0, limit).map(item => ({
      id: item.record.id,
      kind: 'memory' as const,
      summary: item.record.summary,
      score: Number(item.score.toFixed(4)),
      reason: item.reason
    })),
    ...reflections.slice(0, Math.min(3, limit)).map(item => ({
      id: item.id,
      kind: 'reflection' as const,
      summary: item.summary,
      score: 0.3,
      reason: 'reflection matched current query'
    }))
  ];

  return {
    coreMemories: scored
      .filter(
        item =>
          item.record.scopeType === 'session' ||
          item.record.scopeType === 'user' ||
          item.record.scopeType === 'workspace'
      )
      .slice(0, Math.min(3, limit))
      .map(item => item.record),
    archivalMemories: scored
      .filter(item => !['session', 'user', 'workspace'].includes(item.record.scopeType ?? ''))
      .slice(0, limit)
      .map(item => item.record),
    rules: [],
    reflections,
    reasons
  };
}

function inferMemoryType(type: string): NonNullable<MemoryRecord['memoryType']> {
  if (/preference|habit|style/i.test(type)) return 'preference';
  if (/constraint|rule|approval/i.test(type)) return 'constraint';
  if (/procedure|playbook|success/i.test(type)) return 'procedure';
  if (/reflection/i.test(type)) return 'reflection';
  if (/summary/i.test(type)) return 'summary';
  if (/skill/i.test(type)) return 'skill-experience';
  if (/failure|postmortem/i.test(type)) return 'failure-pattern';
  return 'fact';
}

function inferScopeType(record: MemoryRecord): NonNullable<MemoryRecord['scopeType']> {
  if (record.taskId) return 'task';
  if (record.tags.some(tag => /session/i.test(tag))) return 'session';
  if (record.tags.some(tag => /workspace|repo/i.test(tag))) return 'workspace';
  return 'user';
}

function inferRelatedEntities(record: MemoryRecord): NonNullable<MemoryRecord['relatedEntities']> {
  const entities: NonNullable<MemoryRecord['relatedEntities']> = [];
  if (record.taskId) {
    entities.push({ entityType: 'project' as const, entityId: record.taskId, relation: 'task' });
  }
  const repoTag = record.tags.find(tag => tag.startsWith('repo:'));
  if (repoTag) {
    entities.push({ entityType: 'repo' as const, entityId: repoTag.slice('repo:'.length), relation: 'tag' });
  }
  const workspaceTag = record.tags.find(tag => tag.startsWith('workspace:'));
  if (workspaceTag) {
    entities.push({
      entityType: 'workspace' as const,
      entityId: workspaceTag.slice('workspace:'.length),
      relation: 'tag'
    });
  }
  return entities;
}

function legacyConfidence(record: MemoryRecord) {
  return clamp(record.qualityScore ?? record.effectiveness ?? 0.7, 0, 1);
}

function legacyImportance(record: MemoryRecord) {
  if (record.memoryType === 'constraint' || /approval|must|never/i.test(record.content)) {
    return 9;
  }
  if (record.memoryType === 'preference') {
    return 7;
  }
  return 5;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isVisibleForStructuredSearch(record: MemoryRecord, request: MemorySearchRequest) {
  if (record.quarantined || record.status === 'invalidated' || record.status === 'retired') {
    return false;
  }
  if (record.status === 'disputed' && !request.query.toLowerCase().includes('history')) {
    return false;
  }
  if (request.memoryTypes?.length) {
    const memoryType: NonNullable<MemoryRecord['memoryType']> = record.memoryType ?? inferMemoryType(record.type);
    if (!request.memoryTypes.includes(memoryType)) {
      return false;
    }
  }
  if (request.scopeContext?.allowedScopeTypes?.length) {
    const scopeType: NonNullable<MemoryRecord['scopeType']> = record.scopeType ?? inferScopeType(record);
    if (!request.scopeContext.allowedScopeTypes.includes(scopeType)) {
      return false;
    }
  }
  if (request.entityContext?.length) {
    const entities: NonNullable<MemoryRecord['relatedEntities']> =
      record.relatedEntities ?? inferRelatedEntities(record);
    if (entities.length === 0) {
      return false;
    }
    const matched = request.entityContext.some(ctx =>
      entities.some(entity => entity.entityType === ctx.entityType && entity.entityId === ctx.entityId)
    );
    if (!matched) {
      return false;
    }
  }
  return true;
}

function scoreMemoryRecord(record: MemoryRecord, request: MemorySearchRequest) {
  const normalizedQuery = request.query.toLowerCase();
  const haystack = `${record.summary} ${record.content} ${record.tags.join(' ')}`.toLowerCase();
  const relevance =
    normalizedQuery
      .split(/\s+/)
      .filter(Boolean)
      .reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0) /
    Math.max(1, normalizedQuery.split(/\s+/).filter(Boolean).length);
  const recency = computeFreshnessScore(record);
  const importance = (record.importance ?? legacyImportance(record)) / 10;
  const evidenceWeight = Math.min(1, (record.sourceEvidenceIds?.length ?? 0) / 5);
  const adoptionWeight = record.usageMetrics
    ? (record.usageMetrics.adoptedCount + 1) / Math.max(1, record.usageMetrics.injectedCount + 1)
    : 0.5;
  const scopeWeight = request.scopeContext?.scopeType === record.scopeType ? 1 : 0.5;
  const stalePenalty = record.status === 'stale' ? 0.15 : 0;
  const disputePenalty = record.status === 'disputed' ? 1 : 0;

  return (
    0.25 * recency +
    0.2 * importance +
    0.3 * relevance +
    0.1 * evidenceWeight +
    0.1 * adoptionWeight +
    0.05 * scopeWeight -
    stalePenalty -
    disputePenalty
  );
}

function buildReason(record: MemoryRecord, request: MemorySearchRequest, score: number) {
  const parts = [`score=${score.toFixed(3)}`];
  if (request.scopeContext?.scopeType === record.scopeType) {
    parts.push('scope matched');
  }
  if (request.entityContext?.length && (record.relatedEntities?.length ?? 0) > 0) {
    parts.push('entity matched');
  }
  if ((record.sourceEvidenceIds?.length ?? 0) > 0) {
    parts.push('has evidence');
  }
  if ((record.usageMetrics?.adoptedCount ?? 0) > 0) {
    parts.push('previously adopted');
  }
  return parts.join(', ');
}
