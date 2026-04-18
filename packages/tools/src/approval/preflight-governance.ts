import { type RuntimeSettings } from '@agent/config';
import {
  type PermissionCheckResult,
  type PreflightGovernanceDecision,
  type StaticPolicyRule,
  type ToolDefinition
} from '@agent/core';

import type { ApprovalEvaluationInput } from './approval-service';

export interface ToolPermissionChecker {
  supports(tool: Pick<ToolDefinition, 'name' | 'family'>): boolean;
  check(tool: ToolDefinition, input?: ApprovalEvaluationInput): PermissionCheckResult | undefined;
}

export function evaluateStaticPolicy(
  rules: StaticPolicyRule[],
  tool: ToolDefinition | undefined,
  input: ApprovalEvaluationInput | undefined,
  settings: RuntimeSettings
): PermissionCheckResult | undefined {
  const sortedRules = [...rules].sort((left, right) => right.priority - left.priority);
  const matched = sortedRules.find(rule => matchesRule(rule, tool, input, settings));
  if (!matched) {
    return undefined;
  }

  return {
    decision: matched.effect,
    reason: matched.reason,
    reasonCode:
      matched.effect === 'allow'
        ? 'static_policy_allow'
        : matched.effect === 'deny'
          ? 'static_policy_deny'
          : 'static_policy_ask',
    matchedRuleId: matched.id
  };
}

export function evaluatePermissionCheckers(
  checkers: ToolPermissionChecker[],
  tool: ToolDefinition | undefined,
  input?: ApprovalEvaluationInput
): PermissionCheckResult | undefined {
  if (!tool) {
    return undefined;
  }
  for (const checker of checkers) {
    if (!checker.supports(tool)) {
      continue;
    }
    const result = checker.check(tool, input);
    if (result) {
      return result;
    }
  }
  return undefined;
}

export function defaultPreflightStaticRules(): StaticPolicyRule[] {
  return [
    {
      id: 'readonly-tools-allow',
      effect: 'allow',
      priority: 100,
      reason: '只读能力默认通过前置治理。',
      families: ['filesystem', 'knowledge', 'scaffold'],
      executionModes: ['plan', 'planning-readonly', 'execute', 'standard', 'imperial_direct']
    },
    {
      id: 'governance-tools-ask',
      effect: 'ask',
      priority: 150,
      reason: '治理类能力默认进入人工裁决链。',
      families: ['runtime-governance', 'connector-governance', 'scheduling']
    },
    {
      id: 'destructive-terminal-deny',
      effect: 'deny',
      priority: 200,
      reason: '检测到高危终端模式，前置治理直接阻断。',
      toolNames: ['run_terminal'],
      commandPatterns: ['\\brm\\s+-[^\\n]*\\b[rf]', '\\bgit\\s+reset\\s+--hard\\b', '\\bgit\\s+clean\\s+-[^\\n]*f']
    }
  ];
}

export class TerminalToolPermissionChecker implements ToolPermissionChecker {
  supports(tool: Pick<ToolDefinition, 'name' | 'family'>): boolean {
    return tool.name === 'run_terminal';
  }

  check(tool: ToolDefinition, input?: ApprovalEvaluationInput): PermissionCheckResult | undefined {
    const command = String(input?.command ?? '').trim();
    if (!command) {
      return {
        decision: 'ask',
        reason: '终端命令缺少 command 预览，前置治理要求人工确认。',
        reasonCode: 'tool_checker_ask'
      };
    }

    const segments = command
      .split(/&&|\|\||\||;/)
      .map(item => item.trim())
      .filter(Boolean);
    if (segments.some(segment => /\brm\s+-[^\n]*\b[rf]/i.test(segment))) {
      return {
        decision: 'deny',
        reason: `工具 ${tool.name} 命中破坏性命令片段，前置治理已阻断。`,
        reasonCode: 'tool_checker_deny',
        details: { segments }
      };
    }
    return undefined;
  }
}

export class WorkspacePathPermissionChecker implements ToolPermissionChecker {
  private readonly pathFields = ['path', 'fromPath', 'toPath', 'targetRoot'] as const;

  supports(tool: Pick<ToolDefinition, 'name' | 'family'>): boolean {
    return tool.family === 'filesystem' || tool.family === 'scaffold';
  }

  check(tool: ToolDefinition, input?: ApprovalEvaluationInput): PermissionCheckResult | undefined {
    const values = this.pathFields
      .map(field => input?.[field])
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    if (values.length === 0) {
      return undefined;
    }

    const escaped = values.find(value => isEscapedPath(value));
    if (escaped) {
      return {
        decision: 'deny',
        reason: `工具 ${tool.name} 试图访问工作区外路径 ${escaped}，前置治理已阻断。`,
        reasonCode: 'tool_checker_deny',
        details: { path: escaped }
      };
    }
    return undefined;
  }
}

export class HttpMethodPermissionChecker implements ToolPermissionChecker {
  supports(tool: Pick<ToolDefinition, 'name' | 'family'>): boolean {
    return tool.name === 'http_request' || tool.family === 'mcp';
  }

  check(tool: ToolDefinition, input?: ApprovalEvaluationInput): PermissionCheckResult | undefined {
    if (tool.name !== 'http_request') {
      return undefined;
    }
    const method = String(input?.method ?? 'GET').toUpperCase();
    if (['DELETE', 'PATCH', 'POST', 'PUT'].includes(method)) {
      return {
        decision: 'ask',
        reason: `${method} 外部写请求需要进入审批链。`,
        reasonCode: 'tool_checker_ask',
        details: { method, url: input?.url }
      };
    }
    return undefined;
  }
}

function matchesRule(
  rule: StaticPolicyRule,
  tool: ToolDefinition | undefined,
  input: ApprovalEvaluationInput | undefined,
  settings: RuntimeSettings
) {
  if (rule.toolNames?.length && (!tool || !rule.toolNames.includes(tool.name))) {
    return false;
  }
  if (rule.families?.length && (!tool || !rule.families.includes(tool.family))) {
    return false;
  }
  if (rule.intents?.length && (!input?.intent || !rule.intents.includes(String(input.intent)))) {
    return false;
  }
  if (rule.profiles?.length && !rule.profiles.includes(settings.profile)) {
    return false;
  }
  if (rule.executionModes?.length && input?.executionMode && !rule.executionModes.includes(input.executionMode)) {
    return false;
  }
  if (rule.pathPatterns?.length && !matchesAnyPattern(input?.path, rule.pathPatterns)) {
    return false;
  }
  if (rule.commandPatterns?.length && !matchesAnyPattern(input?.command, rule.commandPatterns)) {
    return false;
  }
  return true;
}

function matchesAnyPattern(value: string | undefined, patterns: string[]) {
  if (!value) {
    return false;
  }
  return patterns.some(pattern => new RegExp(pattern, 'i').test(value));
}

function isEscapedPath(path: string) {
  const normalized = path.replace(/\\/g, '/').trim();
  return normalized.startsWith('/') || normalized.startsWith('~') || normalized.split('/').includes('..');
}

export function mergeGovernanceDecisions(
  ...results: Array<PermissionCheckResult | undefined>
): PermissionCheckResult | undefined {
  const decided = results.filter(Boolean) as PermissionCheckResult[];
  if (decided.length === 0) {
    return undefined;
  }
  const priority: Record<PreflightGovernanceDecision, number> = {
    deny: 3,
    ask: 2,
    allow: 1
  };
  return decided.sort((left, right) => priority[right.decision] - priority[left.decision])[0];
}
