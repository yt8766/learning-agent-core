import { request } from './admin-api-core';

export async function invalidateMemory(memoryId: string, reason: string) {
  return request(`/memory/${memoryId}/invalidate`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
}

export async function supersedeMemory(memoryId: string, replacementId: string, reason: string) {
  return request(`/memory/${memoryId}/supersede`, {
    method: 'POST',
    body: JSON.stringify({ replacementId, reason })
  });
}

export async function restoreMemory(memoryId: string) {
  return request(`/memory/${memoryId}/restore`, { method: 'POST' });
}

export async function retireMemory(memoryId: string, reason: string) {
  return request(`/memory/${memoryId}/retire`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
}

export async function searchMemories(params: {
  query: string;
  limit?: number;
  scopeContext?: {
    actorRole?: string;
    scopeType?: string;
    allowedScopeTypes?: string[];
    userId?: string;
    workspaceId?: string;
    teamId?: string;
    orgId?: string;
  };
  entityContext?: Array<{
    entityType: 'user' | 'project' | 'repo' | 'workspace' | 'tool' | 'connector';
    entityId: string;
  }>;
  memoryTypes?: Array<
    | 'fact'
    | 'preference'
    | 'constraint'
    | 'procedure'
    | 'reflection'
    | 'summary'
    | 'skill-experience'
    | 'failure-pattern'
  >;
  includeRules?: boolean;
  includeReflections?: boolean;
}) {
  return request<{
    coreMemories: Array<{
      id: string;
      summary: string;
      status?: string;
      memoryType?: string;
      scopeType?: string;
      verificationStatus?: 'unverified' | 'verified' | 'disputed';
      sourceEvidenceIds?: string[];
      lastVerifiedAt?: string;
      usageMetrics?: {
        retrievedCount: number;
        injectedCount: number;
        adoptedCount: number;
        dismissedCount: number;
        correctedCount?: number;
      };
    }>;
    archivalMemories: Array<{
      id: string;
      summary: string;
      status?: string;
      memoryType?: string;
      scopeType?: string;
      verificationStatus?: 'unverified' | 'verified' | 'disputed';
      sourceEvidenceIds?: string[];
      lastVerifiedAt?: string;
      usageMetrics?: {
        retrievedCount: number;
        injectedCount: number;
        adoptedCount: number;
        dismissedCount: number;
        correctedCount?: number;
      };
    }>;
    rules: Array<{ id: string; summary: string; name?: string }>;
    reflections: Array<{ id: string; summary: string; kind?: string }>;
    reasons: Array<{
      id: string;
      kind: 'memory' | 'rule' | 'reflection';
      summary: string;
      score: number;
      reason: string;
    }>;
  }>('/memory/search', {
    method: 'POST',
    body: JSON.stringify(params)
  });
}

export async function getMemoryHistory(memoryId: string) {
  return request<{
    memory?: {
      id: string;
      summary: string;
      status?: string;
      memoryType?: string;
      scopeType?: string;
      version?: number;
      updatedAt?: string;
      createdAt?: string;
      verificationStatus?: 'unverified' | 'verified' | 'disputed';
      lastVerifiedAt?: string;
      sourceEvidenceIds?: string[];
      usageMetrics?: {
        retrievedCount: number;
        injectedCount: number;
        adoptedCount: number;
        dismissedCount: number;
        correctedCount?: number;
        lastRetrievedAt?: string;
        lastAdoptedAt?: string;
        lastDismissedAt?: string;
        lastCorrectedAt?: string;
      };
    };
    events: Array<{
      id: string;
      eventType: string;
      memoryId: string;
      version: number;
      payload?: Record<string, unknown>;
      actor?: string;
      createdAt: string;
    }>;
  }>(`/memory/${memoryId}/history`);
}

export async function getMemoryEvidenceLinks(memoryId: string) {
  return request<
    Array<{
      id: string;
      memoryId: string;
      evidenceId: string;
      sourceType?: string;
      confidence?: number;
      createdAt: string;
    }>
  >(`/memory/${memoryId}/evidence-links`);
}

export async function getMemoryUsageInsights() {
  return request<{
    totalMemories: number;
    totalRetrieved: number;
    totalInjected: number;
    totalAdopted: number;
    totalDismissed: number;
    totalCorrected: number;
    adoptionRate: number;
    topAdoptedMemories: Array<{ id: string; summary: string; memoryType?: string; status?: string; value: number }>;
    topDismissedMemories: Array<{ id: string; summary: string; memoryType?: string; status?: string; value: number }>;
    topCorrectedMemories: Array<{ id: string; summary: string; memoryType?: string; status?: string; value: number }>;
    adoptionByMemoryType: Array<{ memoryType: string; adoptedCount: number }>;
    countByStatus: Array<{ status: string; count: number }>;
  }>('/memory/insights/usage');
}

export async function compareMemoryVersions(memoryId: string, leftVersion: number, rightVersion: number) {
  return request<{
    memoryId: string;
    currentVersion: number;
    leftVersion: number;
    rightVersion: number;
    left: {
      summary: string;
      content: string;
      status?: string;
      scopeType?: string;
      memoryType?: string;
      usageMetrics?: {
        retrievedCount: number;
        injectedCount: number;
        adoptedCount: number;
        dismissedCount: number;
        correctedCount?: number;
      };
      sourceEvidenceIds: string[];
    };
    right: {
      summary: string;
      content: string;
      status?: string;
      scopeType?: string;
      memoryType?: string;
      usageMetrics?: {
        retrievedCount: number;
        injectedCount: number;
        adoptedCount: number;
        dismissedCount: number;
        correctedCount?: number;
      };
      sourceEvidenceIds: string[];
    };
    latestEventType?: string;
  }>(`/memory/${memoryId}/compare/${leftVersion}/${rightVersion}`);
}

export async function overrideMemory(
  memoryId: string,
  params: {
    summary: string;
    content: string;
    tags?: string[];
    reason: string;
    actor?: string;
    memoryType?:
      | 'fact'
      | 'preference'
      | 'constraint'
      | 'procedure'
      | 'reflection'
      | 'summary'
      | 'skill-experience'
      | 'failure-pattern';
    scopeType?: 'session' | 'user' | 'task' | 'workspace' | 'team' | 'org' | 'global';
  }
) {
  return request(`/memory/${memoryId}/override`, {
    method: 'POST',
    body: JSON.stringify(params)
  });
}

export async function rollbackMemory(memoryId: string, version: number, actor?: string) {
  return request(`/memory/${memoryId}/rollback`, {
    method: 'POST',
    body: JSON.stringify({ version, actor })
  });
}

export async function recordMemoryFeedback(
  memoryId: string,
  kind: 'retrieved' | 'injected' | 'adopted' | 'dismissed' | 'corrected',
  at?: string
) {
  return request(`/memory/${memoryId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ kind, at })
  });
}

export async function getProfile(userId: string) {
  return request<
    | {
        userId: string;
        updatedAt?: string;
        communicationStyle?: string;
        executionStyle?: string;
        approvalStyle?: string;
        riskTolerance?: string;
        codingPreferences?: string[];
        toolPreferences?: string[];
        productFocus?: string[];
        doNotDo?: string[];
        privacyFlags?: string[];
      }
    | undefined
  >(`/memory/profiles/${userId}`);
}

export async function patchProfile(
  userId: string,
  patch: {
    communicationStyle?: string;
    executionStyle?: string;
    approvalStyle?: string;
    riskTolerance?: string;
    codingPreferences?: string[];
    toolPreferences?: string[];
    productFocus?: string[];
    doNotDo?: string[];
    privacyFlags?: string[];
    actor?: string;
  }
) {
  return request(`/memory/profiles/${userId}`, {
    method: 'POST',
    body: JSON.stringify(patch)
  });
}

export async function listMemoryResolutionCandidates() {
  return request<unknown[]>('/memory/resolution-candidates');
}

export async function resolveMemoryResolutionCandidate(
  resolutionCandidateId: string,
  resolution: 'accepted' | 'rejected'
) {
  return request(`/memory/resolution-candidates/${resolutionCandidateId}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ resolution })
  });
}
