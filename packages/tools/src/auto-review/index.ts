export type AutoReviewSeverity = 'info' | 'warning' | 'error' | 'blocker';
export type AutoReviewVerdict = 'allow' | 'warn' | 'block';
export type AutoReviewGateDecision = AutoReviewVerdict;
export type AutoReviewStatus = 'passed' | 'warnings' | 'blocked';

export interface RuleBasedReviewRule {
  id: string;
  severity: AutoReviewSeverity;
  pattern: RegExp;
  message: string;
}

export interface AutoReviewInput {
  subject: string;
  content: string;
}

export interface AutoReviewFinding {
  ruleId: string;
  severity: AutoReviewSeverity;
  message: string;
  subject: string;
}

export interface AutoReviewResult {
  status: AutoReviewStatus;
  verdict: AutoReviewVerdict;
  findings: AutoReviewFinding[];
}

export class RuleBasedReviewer {
  private readonly rules: RuleBasedReviewRule[];

  constructor(options: { rules?: RuleBasedReviewRule[] } = {}) {
    this.rules = options.rules ?? [];
  }

  async review(input: AutoReviewInput): Promise<AutoReviewFinding[]> {
    return this.rules
      .filter(rule => rule.pattern.test(input.content))
      .map(rule => ({
        ruleId: rule.id,
        severity: rule.severity,
        message: rule.message,
        subject: input.subject
      }));
  }
}

export class AutoReviewGate {
  private readonly reviewer: RuleBasedReviewer;
  private readonly maxAutoApproveSeverity: AutoReviewSeverity;

  constructor(options: { reviewer: RuleBasedReviewer; maxAutoApproveSeverity: AutoReviewSeverity }) {
    this.reviewer = options.reviewer;
    this.maxAutoApproveSeverity = options.maxAutoApproveSeverity;
  }

  async evaluate(input: AutoReviewInput): Promise<AutoReviewResult> {
    const findings = await this.reviewer.review(input);
    const worstSeverity = findings.reduce<AutoReviewSeverity>(
      (current, finding) => (severityRank[finding.severity] > severityRank[current] ? finding.severity : current),
      'info'
    );

    if (worstSeverity === 'blocker') {
      return { status: 'blocked', verdict: 'block', findings };
    }

    if (severityRank[worstSeverity] > severityRank[this.maxAutoApproveSeverity]) {
      return { status: 'warnings', verdict: 'warn', findings };
    }

    return { status: 'passed', verdict: 'allow', findings };
  }
}

const severityRank: Record<AutoReviewSeverity, number> = {
  info: 0,
  warning: 1,
  error: 2,
  blocker: 3
};
