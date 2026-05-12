import type { IntelligenceKnowledgeCandidate, IntelligenceSignal } from '@agent/core';

import type {
  IntelligenceKnowledgeCandidateInput,
  IntelligenceQueryInput,
  IntelligenceRawEventInput,
  IntelligenceRepository,
  IntelligenceRunInput,
  IntelligenceSignalInput,
  IntelligenceSourceInput
} from './intelligence.repository';

export function createIntelligenceMemoryRepository(): IntelligenceRepository {
  return new IntelligenceMemoryRepository();
}

export class IntelligenceMemoryRepository implements IntelligenceRepository {
  private readonly runs = new Map<string, IntelligenceRunInput>();
  private readonly queries = new Map<string, IntelligenceQueryInput>();
  private readonly rawEvents = new Map<string, IntelligenceRawEventInput>();
  private readonly signals = new Map<string, IntelligenceSignalInput>();
  private readonly sources = new Map<string, IntelligenceSourceInput>();
  private readonly candidates = new Map<string, IntelligenceKnowledgeCandidateInput>();

  async saveRun(input: IntelligenceRunInput): Promise<void> {
    this.runs.set(input.id, input);
  }

  async saveQuery(input: IntelligenceQueryInput): Promise<void> {
    this.queries.set(input.id, input);
  }

  async saveRawEvent(input: IntelligenceRawEventInput): Promise<void> {
    this.rawEvents.set(input.id, input);
  }

  async upsertSignal(input: IntelligenceSignalInput): Promise<void> {
    const existing = [...this.signals.values()].find(
      signal => signal.workspaceId === input.workspaceId && signal.stableTopicKey === input.stableTopicKey
    );
    this.signals.set(existing?.id ?? input.id, input);
  }

  async saveSource(input: IntelligenceSourceInput): Promise<void> {
    this.sources.set(input.id, input);
  }

  async saveCandidate(input: IntelligenceKnowledgeCandidateInput): Promise<void> {
    this.candidates.set(input.id, input);
  }

  async listRecentSignals(input: {
    limit: number;
    channel?: IntelligenceSignal['channel'];
  }): Promise<IntelligenceSignal[]> {
    return [...this.signals.values()]
      .filter(signal => !input.channel || signal.channel === input.channel)
      .sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt))
      .slice(0, input.limit)
      .map(signal => ({
        id: signal.id,
        channel: signal.channel,
        title: signal.title,
        summary: signal.summary,
        priority: signal.priority,
        confidence: signal.confidence,
        status: signal.status,
        firstSeenAt: signal.firstSeenAt,
        lastSeenAt: signal.lastSeenAt,
        sourceCount: [...this.sources.values()].filter(source => source.signalId === signal.id).length,
        knowledgeDecision: selectKnowledgeDecision(
          [...this.candidates.values()].filter(candidate => candidate.signalId === signal.id)
        )
      }));
  }

  async listPendingCandidates(input: { limit: number }): Promise<IntelligenceKnowledgeCandidate[]> {
    return [...this.candidates.values()]
      .filter(candidate => candidate.reviewStatus === 'pending')
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, input.limit)
      .map(candidate => ({
        id: candidate.id,
        signalId: candidate.signalId,
        candidateType: candidate.candidateType,
        decision: candidate.decision,
        decisionReason: candidate.decisionReason,
        ttlDays: candidate.ttlDays,
        reviewStatus: candidate.reviewStatus,
        createdAt: candidate.createdAt
      }));
  }
}

function selectKnowledgeDecision(
  candidates: IntelligenceKnowledgeCandidateInput[]
): IntelligenceKnowledgeCandidate['decision'] | undefined {
  return candidates
    .map(candidate => candidate.decision)
    .sort((left, right) => decisionPriority(right) - decisionPriority(left))[0];
}

function decisionPriority(decision: IntelligenceKnowledgeCandidate['decision']): number {
  switch (decision) {
    case 'ingested':
      return 4;
    case 'candidate':
      return 3;
    case 'needs_review':
      return 2;
    case 'rejected':
      return 1;
  }
}
