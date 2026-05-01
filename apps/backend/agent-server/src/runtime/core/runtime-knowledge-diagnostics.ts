export function normalizeRuntimeKnowledgeDiagnostics(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const normalized: Record<string, unknown> = {};
  copyHybridDiagnosticsFields(value, normalized);

  const nestedHybrid = value.hybrid;
  if (isRecord(nestedHybrid)) {
    const normalizedHybrid: Record<string, unknown> = {};
    copyHybridDiagnosticsFields(nestedHybrid, normalizedHybrid);
    if (Object.keys(normalizedHybrid).length) {
      normalized.hybrid = normalizedHybrid;
    }
  }

  const postRetrieval = normalizePostRetrievalDiagnostics(value.postRetrieval);
  if (postRetrieval) {
    normalized.postRetrieval = postRetrieval;
  }

  return Object.keys(normalized).length ? normalized : undefined;
}

function copyHybridDiagnosticsFields(source: Record<string, unknown>, target: Record<string, unknown>) {
  copyString(source, target, 'retrievalMode');
  copyStringList(source, target, 'enabledRetrievers');
  copyStringList(source, target, 'failedRetrievers');
  copyString(source, target, 'fusionStrategy');
  copyBoolean(source, target, 'prefilterApplied');
  copyNumber(source, target, 'candidateCount');
}

function normalizePostRetrievalDiagnostics(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const filtering = normalizeFilteringDiagnostics(value.filtering);
  const ranking = normalizeRankingDiagnostics(value.ranking);
  const diversification = normalizeDiversificationDiagnostics(value.diversification);
  if (!filtering || !ranking || !diversification) {
    return undefined;
  }

  return { filtering, ranking, diversification };
}

function normalizeFilteringDiagnostics(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const normalized: Record<string, unknown> = {};
  copyBoolean(value, normalized, 'enabled');
  copyNumber(value, normalized, 'beforeCount');
  copyNumber(value, normalized, 'afterCount');
  copyNumber(value, normalized, 'droppedCount');
  copyNumber(value, normalized, 'maskedCount');
  const reasons = value.reasons;
  if (isRecord(reasons)) {
    const normalizedReasons: Record<string, number> = {};
    for (const [key, reasonCount] of Object.entries(reasons)) {
      if (typeof reasonCount === 'number' && Number.isFinite(reasonCount)) {
        normalizedReasons[key] = reasonCount;
      }
    }
    normalized.reasons = normalizedReasons;
  }
  return hasRequiredNumbers(normalized, ['beforeCount', 'afterCount', 'droppedCount']) ? normalized : undefined;
}

function normalizeRankingDiagnostics(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const normalized: Record<string, unknown> = {};
  copyBoolean(value, normalized, 'enabled');
  copyString(value, normalized, 'strategy');
  copyNumber(value, normalized, 'scoredCount');
  copyStringList(value, normalized, 'signals');
  return typeof normalized.strategy === 'string' && Array.isArray(normalized.signals) ? normalized : undefined;
}

function normalizeDiversificationDiagnostics(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const normalized: Record<string, unknown> = {};
  copyBoolean(value, normalized, 'enabled');
  copyString(value, normalized, 'strategy');
  copyNumber(value, normalized, 'beforeCount');
  copyNumber(value, normalized, 'afterCount');
  copyNumber(value, normalized, 'maxPerSource');
  copyNumber(value, normalized, 'maxPerParent');
  return hasRequiredNumbers(normalized, ['beforeCount', 'afterCount', 'maxPerSource']) ? normalized : undefined;
}

function hasRequiredNumbers(record: Record<string, unknown>, keys: string[]) {
  return keys.every(key => typeof record[key] === 'number');
}

function copyString(source: Record<string, unknown>, target: Record<string, unknown>, key: string) {
  const value = source[key];
  if (typeof value === 'string') {
    target[key] = value;
  }
}

function copyStringList(source: Record<string, unknown>, target: Record<string, unknown>, key: string) {
  const value = source[key];
  if (Array.isArray(value)) {
    const strings = value.filter((item): item is string => typeof item === 'string');
    if (strings.length === value.length) {
      target[key] = strings;
    }
  }
}

function copyBoolean(source: Record<string, unknown>, target: Record<string, unknown>, key: string) {
  const value = source[key];
  if (typeof value === 'boolean') {
    target[key] = value;
  }
}

function copyNumber(source: Record<string, unknown>, target: Record<string, unknown>, key: string) {
  const value = source[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    target[key] = value;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
