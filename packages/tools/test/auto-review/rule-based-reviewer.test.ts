import { describe, expect, it } from 'vitest';

import { AutoReviewGate, RuleBasedReviewer } from '../../src/auto-review';

describe('RuleBasedReviewer and AutoReviewGate', () => {
  it('blocks blocker findings from being auto-approved', async () => {
    const reviewer = new RuleBasedReviewer({
      rules: [
        {
          id: 'no-hard-reset',
          severity: 'blocker',
          pattern: /git reset --hard/,
          message: 'Destructive git reset requires human review'
        }
      ]
    });
    const gate = new AutoReviewGate({ reviewer, maxAutoApproveSeverity: 'warning' });

    const result = await gate.evaluate({
      subject: 'command-policy',
      content: 'git reset --hard HEAD'
    });

    expect(result).toMatchObject({
      verdict: 'block',
      status: 'blocked',
      findings: [
        {
          ruleId: 'no-hard-reset',
          severity: 'blocker'
        }
      ]
    });
  });

  it('warns when findings exceed the auto-allow threshold', async () => {
    const reviewer = new RuleBasedReviewer({
      rules: [
        {
          id: 'review-warning',
          severity: 'warning',
          pattern: /TODO/,
          message: 'TODO markers should be reviewed before handoff'
        }
      ]
    });
    const gate = new AutoReviewGate({ reviewer, maxAutoApproveSeverity: 'info' });

    await expect(gate.evaluate({ subject: 'source', content: 'TODO: revisit contract' })).resolves.toMatchObject({
      verdict: 'warn',
      status: 'warnings'
    });
  });

  it('allows clean content through the skeleton gate', async () => {
    const gate = new AutoReviewGate({ reviewer: new RuleBasedReviewer(), maxAutoApproveSeverity: 'warning' });

    await expect(gate.evaluate({ subject: 'command-policy', content: 'pnpm test' })).resolves.toMatchObject({
      verdict: 'allow',
      status: 'passed',
      findings: []
    });
  });
});
