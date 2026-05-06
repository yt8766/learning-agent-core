import type { ExecutionAutoReviewRecord } from '@agent/core';

export type ExecutionReviewInput = {
  sessionId: string;
  runId: string;
  requestId: string;
  userGoal: string;
  proposedAction: {
    subject: ExecutionAutoReviewRecord['subject'];
    summary: string;
    command?: string;
    toolName?: string;
    args?: Record<string, unknown>;
    touchedPaths?: string[];
    expectedSideEffects?: string[];
  };
  policyContext?: {
    sandboxProfile?: string;
    permissionScope?: string;
    networkAllowed?: boolean;
    writableRoots?: string[];
  };
  riskHints?: {
    destructive?: boolean;
    writesFiles?: boolean;
    externalSideEffect?: boolean;
    credentialExposureRisk?: boolean;
    gitMutation?: boolean;
    longRunning?: boolean;
  };
};

export type ExecutionAutoReviewDecision = Pick<
  ExecutionAutoReviewRecord,
  'verdict' | 'riskLevel' | 'autoExecutable' | 'reasonCodes' | 'reasons' | 'requiredConfirmationPhrase'
>;

const READ_ONLY_COMMAND_PATTERNS = [
  /^rg\b/,
  /^sed\b/,
  /^ls\b/,
  /^git\s+(diff|status|log|show)\b/,
  /^pnpm\s+exec\s+tsc\b/,
  /^pnpm\s+exec\s+vitest\b/,
  /^pnpm\s+test\b/,
  /^pnpm\s+lint\b/
];

export function reviewExecutionAction(input: ExecutionReviewInput): ExecutionAutoReviewDecision {
  const command = input.proposedAction.command?.trim() ?? '';
  if (input.riskHints?.credentialExposureRisk) {
    return block('CREDENTIAL_EXPOSURE_RISK', '可能读取或暴露敏感凭据。');
  }
  if (input.riskHints?.destructive || /\brm\s+-rf\b/.test(command) || /\bgit\s+reset\s+--hard\b/.test(command)) {
    return block('DESTRUCTIVE_OUT_OF_SCOPE', '操作具有破坏性，且不应自动执行。');
  }
  if (input.riskHints?.gitMutation || /^git\s+push\b/.test(command)) {
    return needsConfirmation('high', 'GIT_PUSH', '会修改远端 Git 状态。', '确认推送');
  }
  if (/^git\s+commit\b/.test(command)) {
    return needsConfirmation('high', 'GIT_COMMIT', '会创建本地提交。', '确认提交');
  }
  if (/^pnpm\s+add\b/.test(command) || /^pnpm\s+remove\b/.test(command)) {
    return needsConfirmation('medium', 'DEPENDENCY_MUTATION', '会修改依赖声明或 lockfile。', '确认安装');
  }
  if (input.riskHints?.writesFiles || input.proposedAction.subject === 'file_edit') {
    return needsConfirmation('medium', 'FILE_WRITE', '会写入工作区文件。', '确认执行');
  }
  if (input.riskHints?.externalSideEffect || input.proposedAction.subject === 'network_request') {
    return needsConfirmation('medium', 'EXTERNAL_SIDE_EFFECT', '可能产生外部副作用。', '确认执行');
  }
  if (input.riskHints?.longRunning) {
    return needsConfirmation('medium', 'LONG_RUNNING', '可能启动长期运行进程。', '确认执行');
  }
  if (isReadOnlyCommand(command)) {
    return {
      verdict: 'allow',
      riskLevel: 'low',
      autoExecutable: true,
      reasonCodes: ['READ_ONLY_CHECK'],
      reasons: ['只读验证或查询命令。']
    };
  }
  return needsConfirmation('medium', 'UNKNOWN_SIDE_EFFECTS', '无法证明该操作没有副作用。', '确认执行');
}

function isReadOnlyCommand(command: string) {
  return READ_ONLY_COMMAND_PATTERNS.some(pattern => pattern.test(command));
}

function needsConfirmation(
  riskLevel: ExecutionAutoReviewRecord['riskLevel'],
  reasonCode: string,
  reason: string,
  requiredConfirmationPhrase: string
): ExecutionAutoReviewDecision {
  return {
    verdict: 'needs_confirmation',
    riskLevel,
    autoExecutable: false,
    reasonCodes: [reasonCode],
    reasons: [reason],
    requiredConfirmationPhrase
  };
}

function block(reasonCode: string, reason: string): ExecutionAutoReviewDecision {
  return {
    verdict: 'block',
    riskLevel: 'critical',
    autoExecutable: false,
    reasonCodes: [reasonCode],
    reasons: [reason]
  };
}
