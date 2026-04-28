import { AutoReviewFindingSchema } from '@agent/tools';
import { AutoReviewGate, RuleBasedReviewer, type RuleBasedReviewRule } from '@agent/tools';
import type { z } from 'zod/v4';

type AutoReviewFinding = z.infer<typeof AutoReviewFindingSchema>;

type RuleBasedReviewVerdict = 'allow' | 'warn' | 'block';
type RuleBasedReviewStatus = 'passed' | 'warnings' | 'blocked';

interface BackendAutoReviewRule extends RuleBasedReviewRule {
  title: string;
  recommendation: string;
}

interface BackendRuleGateReview {
  status: RuleBasedReviewStatus;
  verdict: RuleBasedReviewVerdict;
  findings: AutoReviewFinding[];
}

const RULE_BASED_REVIEW_RULES: BackendAutoReviewRule[] = [
  {
    id: 'warning-marker',
    severity: 'warning',
    pattern: /\b(WARNING|TODO)\b/i,
    message: 'The target preview contains a warning marker that should remain visible to the operator.',
    title: 'Warning marker detected',
    recommendation: 'Review the warning before relying on the result.'
  },
  {
    id: 'blocking-marker',
    severity: 'blocker',
    pattern: /\b(BLOCKER|SECRET|DANGEROUS)\b/i,
    message: 'The target preview contains a blocking marker that requires review before continuing.',
    title: 'Blocking marker detected',
    recommendation: 'Remove the risky content or approve the risk through the review interrupt.'
  }
];

const severityRank: Record<BackendAutoReviewRule['severity'], number> = {
  info: 0,
  warning: 1,
  error: 2,
  blocker: 3
};

export function runRuleBasedReviewGate(subject: string, content: string): BackendRuleGateReview {
  const reviewer = new RuleBasedReviewer({ rules: RULE_BASED_REVIEW_RULES });
  const gate = new AutoReviewGate({ reviewer, maxAutoApproveSeverity: 'info' });
  const matchedRules = RULE_BASED_REVIEW_RULES.filter(rule => rule.pattern.test(content));
  const findings = matchedRules.map(rule => mapRuleToFinding(rule));

  return {
    ...resolveGateDecision(gate, matchedRules),
    findings
  };
}

function resolveGateDecision(
  _gate: AutoReviewGate,
  matchedRules: BackendAutoReviewRule[]
): Pick<BackendRuleGateReview, 'status' | 'verdict'> {
  const worstSeverity = matchedRules.reduce<BackendAutoReviewRule['severity']>(
    (current, rule) => (severityRank[rule.severity] > severityRank[current] ? rule.severity : current),
    'info'
  );

  if (worstSeverity === 'blocker') {
    return { status: 'blocked', verdict: 'block' };
  }
  if (severityRank[worstSeverity] > severityRank.info) {
    return { status: 'warnings', verdict: 'warn' };
  }
  return { status: 'passed', verdict: 'allow' };
}

function mapRuleToFinding(rule: BackendAutoReviewRule): AutoReviewFinding {
  return {
    findingId: `finding_${rule.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    severity: rule.severity,
    category: 'rule_based_auto_review',
    title: rule.title,
    message: rule.message,
    evidenceIds: [],
    recommendation: rule.recommendation
  };
}
