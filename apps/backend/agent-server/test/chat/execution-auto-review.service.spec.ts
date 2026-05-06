import { describe, expect, it } from 'vitest';

import { ExecutionAutoReviewService } from '../../src/chat/execution-auto-review.service';

const baseInput = {
  sessionId: 'session-1',
  runId: 'run-1',
  requestId: 'request-1',
  userGoal: '验证当前改动',
  policyContext: {
    sandboxProfile: 'workspace-write',
    writableRoots: ['/Users/dev/Desktop/learning-agent-core']
  }
};

describe('ExecutionAutoReviewService', () => {
  it('allows read-only verification commands', () => {
    const service = new ExecutionAutoReviewService();

    const review = service.review({
      ...baseInput,
      proposedAction: {
        subject: 'shell_command',
        summary: 'Run TypeScript typecheck',
        command: 'pnpm exec tsc -p packages/core/tsconfig.json --noEmit',
        expectedSideEffects: []
      },
      riskHints: {
        writesFiles: false,
        destructive: false,
        externalSideEffect: false,
        gitMutation: false
      }
    });

    expect(review).toMatchObject({
      verdict: 'allow',
      riskLevel: 'low',
      autoExecutable: true
    });
    expect(review.reasonCodes).toContain('READ_ONLY_CHECK');
  });

  it('requires confirmation for dependency installs and git pushes', () => {
    const service = new ExecutionAutoReviewService();

    const installReview = service.review({
      ...baseInput,
      requestId: 'request-install',
      proposedAction: {
        subject: 'shell_command',
        summary: 'Install dependency',
        command: 'pnpm add zod',
        expectedSideEffects: ['package.json', 'pnpm-lock.yaml']
      },
      riskHints: {
        writesFiles: true,
        externalSideEffect: true
      }
    });

    const pushReview = service.review({
      ...baseInput,
      requestId: 'request-push',
      proposedAction: {
        subject: 'git_operation',
        summary: 'Push branch',
        command: 'git push origin feature/chat-runtime-v2',
        expectedSideEffects: ['remote git branch update']
      },
      riskHints: {
        gitMutation: true,
        externalSideEffect: true
      }
    });

    expect(installReview).toMatchObject({
      verdict: 'needs_confirmation',
      autoExecutable: false,
      requiredConfirmationPhrase: '确认安装'
    });
    expect(pushReview).toMatchObject({
      verdict: 'needs_confirmation',
      riskLevel: 'high',
      autoExecutable: false,
      requiredConfirmationPhrase: '确认推送'
    });
  });

  it('blocks destructive out-of-scope commands', () => {
    const service = new ExecutionAutoReviewService();

    const review = service.review({
      ...baseInput,
      requestId: 'request-delete',
      userGoal: '查看当前状态',
      proposedAction: {
        subject: 'shell_command',
        summary: 'Delete files',
        command: 'rm -rf /Users/dev/Desktop/learning-agent-core',
        expectedSideEffects: ['delete workspace']
      },
      riskHints: {
        destructive: true,
        writesFiles: true
      }
    });

    expect(review).toMatchObject({
      verdict: 'block',
      riskLevel: 'critical',
      autoExecutable: false
    });
    expect(review.reasonCodes).toContain('DESTRUCTIVE_OUT_OF_SCOPE');
  });
});
