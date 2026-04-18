import { ActionIntent, type ToolDefinition } from '@agent/core';

type ActionIntentValue = (typeof ActionIntent)[keyof typeof ActionIntent];

import type { ApprovalEvaluationInput } from './approval-service';

export const GOVERNANCE_INTENTS = new Set<ActionIntentValue>([
  ActionIntent.PROMOTE_SKILL,
  ActionIntent.ENABLE_PLUGIN,
  ActionIntent.MODIFY_RULE
]);

export const DESTRUCTIVE_COMMAND_PATTERNS = [
  /\brm\s+-[^\n]*\b[rf]/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-[^\n]*f/i,
  /\bmv\b.+\s+\/(etc|usr|var|bin|sbin)\b/i
];

export const SAFE_TERMINAL_COMMAND_PATTERNS = [
  /\bpnpm\s+(build|test|exec\s+tsc|exec\s+vitest|lint|check)\b/i,
  /\bnpm\s+(run\s+)?(build|test|lint)\b/i,
  /\byarn\s+(build|test|lint)\b/i,
  /\btsc\b/i,
  /\bvitest\b/i,
  /\bjest\b/i
];

export const HIGH_RISK_TARGET_PATTERNS = [/\bmain\b/i, /\bprod\b/i, /\bproduction\b/i, /\brelease\b/i];

export function isDangerousPath(path: string): boolean {
  const normalized = path.trim().replace(/\\/g, '/');
  if (!normalized) {
    return true;
  }

  if (normalized.startsWith('/')) {
    return true;
  }

  const segments = normalized.split('/').filter(Boolean);
  if (segments.some(segment => segment === '..')) {
    return true;
  }

  return segments.some(segment => segment === '.git' || segment === '.svn' || segment === '.hg');
}

export function matchesAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(value));
}

export function shouldInvokeClassifier(
  intent: ActionIntentValue,
  tool: ToolDefinition,
  input?: ApprovalEvaluationInput
) {
  if (tool.name === 'run_terminal') {
    const command = String(input?.command ?? '').trim();
    return Boolean(command) && !matchesAny(command, SAFE_TERMINAL_COMMAND_PATTERNS);
  }
  if (tool.family === 'filesystem' && (intent === ActionIntent.WRITE_FILE || intent === ActionIntent.DELETE_FILE)) {
    return Boolean(input?.path || input?.fromPath || input?.toPath);
  }
  if (tool.name === 'http_request') {
    const method = String(input?.method ?? 'GET').toUpperCase();
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  }
  return false;
}
