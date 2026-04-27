export interface AgentToolAliasDefinition {
  toolName: string;
  aliases?: string[];
  displayName?: string;
}

export interface AgentToolAliasResolution {
  status: 'resolved';
  toolName: string;
  matchedAlias: string;
}

export interface AgentToolAliasExplanation {
  status: 'resolved' | 'ambiguous' | 'not_found';
  candidates: string[];
  matchedAlias?: string;
}

export class AgentToolAliasResolver {
  private readonly aliases = new Map<string, AgentToolAliasEntry[]>();

  constructor(definitions: AgentToolAliasDefinition[] = []) {
    definitions.forEach(definition => this.register(definition));
  }

  register(definition: AgentToolAliasDefinition): void {
    this.registerAlias(definition.toolName, definition, 1);
    this.registerAlias(definition.displayName, definition, 1);
    (definition.aliases ?? []).forEach(alias => this.registerAlias(alias, definition, 0));
  }

  resolve(input: string): AgentToolAliasResolution | undefined {
    const explanation = this.explain(input);
    if (explanation.status !== 'resolved' || !explanation.matchedAlias) {
      return undefined;
    }

    const [toolName] = explanation.candidates;
    if (!toolName) {
      return undefined;
    }

    return {
      status: 'resolved',
      toolName,
      matchedAlias: explanation.matchedAlias
    };
  }

  explain(input: string): AgentToolAliasExplanation {
    const matchedAlias = normalizeAlias(input);
    const entries = this.aliases.get(matchedAlias) ?? [];
    const bestPriority = Math.min(...entries.map(entry => entry.priority));
    const bestEntries = entries.filter(entry => entry.priority === bestPriority);
    const candidates = Array.from(new Set(bestEntries.map(entry => entry.definition.toolName)));

    if (candidates.length === 1) {
      return { status: 'resolved', candidates, matchedAlias };
    }

    if (candidates.length > 1) {
      return { status: 'ambiguous', candidates, matchedAlias };
    }

    return { status: 'not_found', candidates: [], matchedAlias };
  }

  private registerAlias(alias: string | undefined, definition: AgentToolAliasDefinition, priority: number): void {
    if (!alias || alias.trim().length === 0) {
      return;
    }

    const key = normalizeAlias(alias);
    const existing = this.aliases.get(key) ?? [];
    this.aliases.set(key, [...existing, { definition, priority }]);
  }
}

function normalizeAlias(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '.');
}

interface AgentToolAliasEntry {
  definition: AgentToolAliasDefinition;
  priority: number;
}

export { AgentToolSurfaceResolver } from './agent-tool-surface-resolver';
export { decideAgentToolApprovalMode } from './agent-tool-approval-mode-policy';
export { normalizeAgentToolInput } from './agent-tool-input-normalizer';
export { classifyAgentToolRisk } from './agent-tool-risk-policy';
export type { AgentToolApprovalModeDecision, AgentToolApprovalModeInput } from './agent-tool-approval-mode-policy';
export type { NormalizedAgentToolInput } from './agent-tool-input-normalizer';
export type { AgentToolRiskDecision, AgentToolRiskInput } from './agent-tool-risk-policy';
