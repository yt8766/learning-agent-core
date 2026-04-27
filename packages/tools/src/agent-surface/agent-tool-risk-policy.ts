import type { AgentToolAlias, ToolRiskLevel } from '@agent/core';

import { RawCommandClassifier } from '../command';

export interface AgentToolRiskInput {
  alias: AgentToolAlias;
  toolRiskClass: ToolRiskLevel;
  input: Record<string, unknown>;
}

export interface AgentToolRiskDecision {
  riskClass: ToolRiskLevel;
  reasonCode?: string;
}

export function classifyAgentToolRisk(input: AgentToolRiskInput): AgentToolRiskDecision {
  if (input.alias === 'delete' && (input.input.recursive === true || isBroadPath(input.input.path))) {
    return { riskClass: 'critical', reasonCode: 'recursive_or_broad_delete' };
  }

  if (input.alias === 'command') {
    const command = typeof input.input.command === 'string' ? input.input.command : '';
    if (hasShellMutationSyntax(command)) {
      return { riskClass: 'high', reasonCode: 'command_shell_mutation_or_compound' };
    }
    const classification = new RawCommandClassifier().classify(command);
    return {
      riskClass: classification.riskClass,
      reasonCode: `command_${classification.intent}`
    };
  }

  return { riskClass: input.toolRiskClass };
}

function isBroadPath(path: unknown): boolean {
  return path === '.' || path === './' || path === '/' || path === '' || path === undefined;
}

function hasShellMutationSyntax(command: string): boolean {
  return /(?:^|[^\\])(?:>>?|<|&&|\|\||;|\||&(?!&)|`|\$\(|[\r\n])/.test(command);
}
