import type { ExecutionPolicyDecision, ExecutionRiskClass } from '@agent/core';

export type PlatformName = 'posix' | 'windows';
export type CommandIntent = 'readonly' | 'verification' | 'mutation' | 'destructive' | 'unknown';
export type CommandSafetyProfile = 'safe-local-readonly' | 'readonly' | 'verification';

export interface ResolvedCommand {
  executable: string;
  args: string[];
  shell: false;
}

export interface PlatformCommandProvider {
  readonly platform: PlatformName;
  resolve(commandId: string, args?: string[]): ResolvedCommand | undefined;
}

export interface PlatformCommandResolverInput {
  commandId: string;
  platform: PlatformName;
  args?: string[];
}

export interface RawCommandClassification {
  rawCommand: string;
  executable: string;
  intent: CommandIntent;
  riskClass: ExecutionRiskClass;
  isReadOnly: boolean;
  isDestructive: boolean;
}

export interface CommandPolicyEvaluation {
  decision: ExecutionPolicyDecision;
  reasonCode: string;
  reason: string;
  requiresApproval: boolean;
  classification: RawCommandClassification;
}

export class PosixPlatformCommandProvider implements PlatformCommandProvider {
  readonly platform = 'posix' as const;

  resolve(commandId: string, args: string[] = []): ResolvedCommand | undefined {
    switch (commandId) {
      case 'list-directory':
        return { executable: 'ls', args: ['-la', ...args], shell: false };
      case 'print-working-directory':
        return { executable: 'pwd', args, shell: false };
      case 'read-file':
        return { executable: 'cat', args, shell: false };
      default:
        return undefined;
    }
  }
}

export class WindowsPlatformCommandProvider implements PlatformCommandProvider {
  readonly platform = 'windows' as const;

  resolve(commandId: string, args: string[] = []): ResolvedCommand | undefined {
    switch (commandId) {
      case 'list-directory':
        return { executable: 'cmd.exe', args: ['/d', '/s', '/c', 'dir', ...args], shell: false };
      case 'print-working-directory':
        return { executable: 'cmd.exe', args: ['/d', '/s', '/c', 'cd', ...args], shell: false };
      case 'read-file':
        return { executable: 'cmd.exe', args: ['/d', '/s', '/c', 'type', ...args], shell: false };
      default:
        return undefined;
    }
  }
}

export class PlatformCommandResolver {
  private readonly providers: PlatformCommandProvider[];

  constructor(options: { providers: PlatformCommandProvider[] }) {
    this.providers = options.providers;
  }

  resolve(input: PlatformCommandResolverInput): ResolvedCommand | undefined {
    return this.providers.find(provider => provider.platform === input.platform)?.resolve(input.commandId, input.args);
  }
}

export class RawCommandClassifier {
  classify(rawCommand: string): RawCommandClassification {
    const executable = rawCommand.trim().split(/\s+/)[0] ?? '';
    const normalized = rawCommand.trim().toLowerCase();

    if (
      /\brm\s+-rf\b|\bgit\s+reset\s+--hard\b|\bdd\s+if=|\bmkfs\b|\bfind\b.*\s-delete\b|\bsed\b.*\s-i\b/.test(normalized)
    ) {
      return buildClassification(rawCommand, executable, 'destructive', 'critical', false, true);
    }

    if (/^(pnpm|npm|yarn)\s+(add|remove|install)\b|\bgit\s+(push|commit|merge|rebase)\b/.test(normalized)) {
      return buildClassification(rawCommand, executable, 'mutation', 'high', false, false);
    }

    if (/^(pnpm|npm|yarn)\s+(test|exec\s+vitest|exec\s+tsc|build|verify)\b/.test(normalized)) {
      return buildClassification(rawCommand, executable, 'verification', 'low', true, false);
    }

    if (/^(ls|pwd|cat|sed|rg|find|git\s+(status|diff|show|log))\b/.test(normalized)) {
      return buildClassification(rawCommand, executable, 'readonly', 'low', true, false);
    }

    return buildClassification(rawCommand, executable, 'unknown', 'medium', false, false);
  }
}

export class CommandPolicy {
  private readonly classifier: RawCommandClassifier;
  private readonly profile: CommandSafetyProfile;

  constructor(options: { classifier?: RawCommandClassifier; profile: CommandSafetyProfile }) {
    this.classifier = options.classifier ?? new RawCommandClassifier();
    this.profile = options.profile;
  }

  evaluate(input: { rawCommand: string }): CommandPolicyEvaluation {
    const classification = this.classifier.classify(input.rawCommand);

    if (classification.isDestructive) {
      return buildPolicyEvaluation('deny', 'destructive_command', 'Destructive commands are denied.', classification);
    }

    if (!isProfileAllowed(this.profile, classification)) {
      return buildPolicyEvaluation(
        'deny',
        'profile_disallows_mutation',
        'The selected command profile only allows readonly and verification commands.',
        classification
      );
    }

    if (classification.intent === 'unknown') {
      return buildPolicyEvaluation(
        'require_approval',
        'unknown_command',
        'Unknown commands require approval before execution.',
        classification
      );
    }

    return buildPolicyEvaluation(
      'allow',
      'safe_profile_allow',
      'Command is allowed by the safe profile.',
      classification
    );
  }
}

function buildClassification(
  rawCommand: string,
  executable: string,
  intent: CommandIntent,
  riskClass: ExecutionRiskClass,
  isReadOnly: boolean,
  isDestructive: boolean
): RawCommandClassification {
  return { rawCommand, executable, intent, riskClass, isReadOnly, isDestructive };
}

function isProfileAllowed(profile: CommandSafetyProfile, classification: RawCommandClassification): boolean {
  if (profile === 'safe-local-readonly' || profile === 'readonly') {
    return classification.intent === 'readonly' || classification.intent === 'verification';
  }

  return profile === 'verification' && classification.intent === 'verification';
}

function buildPolicyEvaluation(
  decision: ExecutionPolicyDecision,
  reasonCode: string,
  reason: string,
  classification: RawCommandClassification
): CommandPolicyEvaluation {
  return {
    decision,
    reasonCode,
    reason,
    requiresApproval: decision === 'require_approval',
    classification
  };
}
