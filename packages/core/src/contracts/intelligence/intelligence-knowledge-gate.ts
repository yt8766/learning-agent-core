import type {
  IntelligenceCandidateType,
  IntelligenceChannel,
  IntelligenceConfidence,
  IntelligenceKnowledgeDecision,
  IntelligencePriority,
  IntelligenceReviewStatus,
  IntelligenceSourceGroup,
  IntelligenceStatus
} from './intelligence.types';

interface IntelligenceKnowledgeGateSignal {
  id: string;
  channel: IntelligenceChannel;
  title: string;
  summary: string;
  priority: IntelligencePriority;
  confidence: IntelligenceConfidence;
  status: IntelligenceStatus;
}

export interface IntelligenceKnowledgeGateInput {
  signal: IntelligenceKnowledgeGateSignal;
  sourceGroups: IntelligenceSourceGroup[];
}

export interface IntelligenceKnowledgeGateDecision {
  candidateType: IntelligenceCandidateType;
  decision: IntelligenceKnowledgeDecision;
  decisionReason: string;
  ttlDays: number;
  reviewStatus: IntelligenceReviewStatus;
}

const SECURITY_PATTERN = /\b(cve|ghsa|advisory|incident|leak|vulnerability|compromise|泄露|漏洞)\b/;
const PLATFORM_PATTERN = /\b(model|pricing|context|api|deprecation|migration|rate limit|enterprise)\b/;
const FRONTEND_PATTERN = /\b(breaking|migration|major|release|compatibility|stable|baseline)\b/;

export function decideIntelligenceKnowledgeCandidate(
  input: IntelligenceKnowledgeGateInput
): IntelligenceKnowledgeGateDecision {
  const text = `${input.signal.title} ${input.signal.summary}`.toLowerCase();
  const hasOfficial = input.sourceGroups.includes('official');
  const hasAuthority = input.sourceGroups.includes('authority');

  if (input.signal.channel === 'skills-agent-tools') {
    return {
      candidateType: 'skill_card',
      decision: 'needs_review',
      decisionReason: 'Agent tool candidates require Admin approval before installation or reuse.',
      ttlDays: 180,
      reviewStatus: 'pending'
    };
  }

  if (input.signal.channel === 'frontend-security' || input.signal.channel === 'ai-security') {
    if (hasOfficial || (hasAuthority && SECURITY_PATTERN.test(text))) {
      return {
        candidateType: 'knowledge',
        decision: hasOfficial ? 'candidate' : 'needs_review',
        decisionReason: 'Security signal has official or high-confidence evidence.',
        ttlDays: 365,
        reviewStatus: 'pending'
      };
    }
  }

  if (input.signal.channel === 'llm-releases' || input.signal.channel === 'ai-product-platform') {
    if (hasOfficial && PLATFORM_PATTERN.test(text)) {
      return {
        candidateType: 'knowledge',
        decision: 'candidate',
        decisionReason: 'Official platform/model change affects model routing, cost, or migration strategy.',
        ttlDays: 180,
        reviewStatus: 'pending'
      };
    }
  }

  if (input.signal.channel === 'frontend-tech') {
    if (hasOfficial && FRONTEND_PATTERN.test(text)) {
      return {
        candidateType: 'knowledge',
        decision: 'candidate',
        decisionReason: 'Official frontend change has migration or compatibility impact.',
        ttlDays: 365,
        reviewStatus: 'pending'
      };
    }
  }

  return {
    candidateType: 'evidence_only',
    decision: hasAuthority ? 'needs_review' : 'rejected',
    decisionReason: hasAuthority
      ? 'Authority source requires human review before Knowledge promotion.'
      : 'Community or low-confidence signal stays as evidence only.',
    ttlDays: 90,
    reviewStatus: hasAuthority ? 'pending' : 'rejected'
  };
}
