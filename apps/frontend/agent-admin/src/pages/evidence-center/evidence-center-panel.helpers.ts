import type { EvidenceRecord } from '@/types/admin';

export const EVIDENCE_HIGHLIGHT_STORAGE_KEY = 'agent-admin:evidence-highlight-ids';

interface HighlightStorageReader {
  getItem(key: string): string | null;
}

interface HighlightStorageWriter {
  removeItem(key: string): void;
}

interface ReplayPayloadMap {
  [sessionId: string]: Record<string, unknown>;
}

export function readHighlightedEvidenceIds(storage?: HighlightStorageReader): string[] {
  const resolvedStorage =
    storage ?? (typeof window !== 'undefined' ? (window.sessionStorage as HighlightStorageReader) : undefined);

  if (!resolvedStorage) {
    return [];
  }

  const raw = resolvedStorage.getItem(EVIDENCE_HIGHLIGHT_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

export function prioritizeEvidenceRecords(evidence: EvidenceRecord[], highlightedEvidenceIds?: string[]) {
  const highlightedIds = highlightedEvidenceIds ?? [];

  if (highlightedIds.length === 0) {
    return evidence;
  }

  const highlightedEvidenceIdSet = new Set(highlightedIds);
  const highlighted = evidence.filter(item => highlightedEvidenceIdSet.has(item.id));
  const remaining = evidence.filter(item => !highlightedEvidenceIdSet.has(item.id));
  return [...highlighted, ...remaining];
}

export async function openEvidenceReplay(params: {
  item: EvidenceRecord;
  expandedReplayId?: string;
  replayPayloads?: ReplayPayloadMap;
  loadReplay: (sessionId: string) => Promise<Record<string, unknown>>;
  setExpandedReplayId: (value: string | undefined) => void;
  setReplayPayloads: (updater: (current: ReplayPayloadMap) => ReplayPayloadMap) => void;
  setLoadingReplayId: (value: string | undefined) => void;
}) {
  const { item, expandedReplayId, loadReplay, setExpandedReplayId, setReplayPayloads, setLoadingReplayId } = params;
  const replayPayloads = params.replayPayloads ?? {};
  const sessionId = item.replay?.sessionId;

  if (!sessionId) {
    return;
  }

  if (expandedReplayId === item.id) {
    setExpandedReplayId(undefined);
    return;
  }

  setExpandedReplayId(item.id);
  if (replayPayloads[sessionId]) {
    return;
  }

  try {
    setLoadingReplayId(item.id);
    const payload = await loadReplay(sessionId);
    setReplayPayloads(current => ({
      ...current,
      [sessionId]: payload
    }));
  } finally {
    setLoadingReplayId(undefined);
  }
}

export async function recoverEvidenceCheckpoint(params: {
  item: EvidenceRecord;
  recover: (payload: {
    sessionId: string;
    checkpointId: string;
    checkpointCursor: number;
    reason: string;
  }) => Promise<unknown>;
  setRecoveringEvidenceId: (value: string | undefined) => void;
}) {
  const { item, recover, setRecoveringEvidenceId } = params;

  if (!item.recoverable || !item.checkpointRef) {
    return;
  }

  try {
    setRecoveringEvidenceId(item.id);
    await recover({
      sessionId: item.checkpointRef.sessionId,
      checkpointId: item.checkpointRef.checkpointId,
      checkpointCursor: item.checkpointRef.checkpointCursor,
      reason: `recover_from_evidence:${item.id}`
    });
  } finally {
    setRecoveringEvidenceId(undefined);
  }
}

export function clearHighlightedEvidence(params: {
  setHighlightedEvidenceIds: (ids: string[]) => void;
  storage?: HighlightStorageWriter;
}) {
  params.storage?.removeItem(EVIDENCE_HIGHLIGHT_STORAGE_KEY);
  params.setHighlightedEvidenceIds([]);
}
