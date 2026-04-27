import { spawn } from 'node:child_process';

import type { ToolExecutionResult } from '@agent/core';

import { CommandPolicy, type CommandSafetyProfile } from '../command';

export type SandboxProfile = 'readonly' | 'verification' | 'workspace-write' | 'unrestricted';
export type SandboxCapability = 'command' | 'browser' | 'filesystem';

export interface SandboxRunRequest {
  command: string;
  profile: SandboxProfile;
  cwd: string;
  timeoutMs?: number;
}

export interface SandboxProviderResolutionInput {
  profile: SandboxProfile;
  capability: SandboxCapability;
  policy?: SandboxPolicy;
}

export interface SandboxProvider {
  readonly id: string;
  readonly supportedProfiles: SandboxProfile[];
  readonly supportedCapabilities: SandboxCapability[];
  canRun(input: SandboxProviderResolutionInput): boolean;
  run(request: SandboxRunRequest): Promise<ToolExecutionResult>;
}

export interface SandboxProviderPlugin {
  readonly id: string;
  register(registry: SandboxProviderRegistry): void;
}

export class SandboxPolicy {
  private readonly allowedProfiles: SandboxProfile[];

  constructor(options: { allowedProfiles?: SandboxProfile[] } = {}) {
    this.allowedProfiles = options.allowedProfiles ?? ['readonly', 'verification'];
  }

  accepts(input: SandboxProviderResolutionInput, provider: SandboxProvider): boolean {
    return (
      this.allowedProfiles.includes(input.profile) &&
      provider.supportedProfiles.includes(input.profile) &&
      provider.supportedCapabilities.includes(input.capability)
    );
  }
}

export class SandboxProviderRegistry {
  private readonly providers: SandboxProvider[] = [];

  register(provider: SandboxProvider): void {
    this.providers.push(provider);
  }

  install(plugin: SandboxProviderPlugin): void {
    plugin.register(this);
  }

  resolve(input: SandboxProviderResolutionInput): SandboxProvider | undefined {
    const policy = input.policy ?? new SandboxPolicy();
    return this.providers.find(provider => policy.accepts(input, provider) && provider.canRun(input));
  }
}

export class SimulatedSandboxProvider implements SandboxProvider {
  readonly id = 'simulated';
  readonly supportedProfiles: SandboxProfile[] = ['readonly', 'verification'];
  readonly supportedCapabilities: SandboxCapability[] = ['command'];

  canRun(input: SandboxProviderResolutionInput): boolean {
    return this.supportedProfiles.includes(input.profile) && this.supportedCapabilities.includes(input.capability);
  }

  async run(request: SandboxRunRequest): Promise<ToolExecutionResult> {
    const startedAt = Date.now();
    return {
      ok: true,
      outputSummary: `Simulated sandbox accepted ${request.profile} command`,
      rawOutput: { command: request.command, cwd: request.cwd, simulated: true },
      exitCode: 0,
      durationMs: Date.now() - startedAt
    };
  }
}

export class LocalProcessSandboxProvider implements SandboxProvider {
  readonly id = 'local-process';
  readonly supportedProfiles: SandboxProfile[] = ['readonly', 'verification'];
  readonly supportedCapabilities: SandboxCapability[] = ['command'];

  canRun(input: SandboxProviderResolutionInput): boolean {
    return this.supportedProfiles.includes(input.profile) && this.supportedCapabilities.includes(input.capability);
  }

  async run(request: SandboxRunRequest): Promise<ToolExecutionResult> {
    const startedAt = Date.now();
    const profile = toCommandProfile(request.profile);

    if (!profile) {
      return {
        ok: false,
        outputSummary: 'Local process sandbox rejected unsupported profile',
        errorMessage: 'Local process sandbox only supports readonly and verification profiles',
        exitCode: 1,
        durationMs: Date.now() - startedAt
      };
    }

    const policyDecision = new CommandPolicy({ profile }).evaluate({ rawCommand: request.command });
    if (policyDecision.decision !== 'allow') {
      return {
        ok: false,
        outputSummary: 'Local process sandbox rejected command by policy',
        errorMessage: policyDecision.reason,
        rawOutput: { policyDecision },
        exitCode: 1,
        durationMs: Date.now() - startedAt
      };
    }

    const parsedCommand = parseLocalProcessCommand(request.command);
    if (!parsedCommand) {
      return {
        ok: false,
        outputSummary: 'Local process sandbox rejected command by policy',
        errorMessage: 'Local process sandbox only executes parsed argv commands without shell operators',
        rawOutput: { policyDecision },
        exitCode: 1,
        durationMs: Date.now() - startedAt
      };
    }

    const argumentPolicyError = validateLocalProcessArguments(parsedCommand);
    if (argumentPolicyError) {
      return {
        ok: false,
        outputSummary: 'Local process sandbox rejected command by policy',
        errorMessage: argumentPolicyError,
        rawOutput: { policyDecision, command: parsedCommand },
        exitCode: 1,
        durationMs: Date.now() - startedAt
      };
    }

    try {
      const runResult = await spawnAsync(parsedCommand.executable, parsedCommand.args, {
        cwd: request.cwd,
        timeout: request.timeoutMs ?? 30_000
      });

      if (runResult.providerError) {
        return {
          ok: false,
          outputSummary: 'Local process sandbox command failed',
          errorMessage: runResult.providerError.message,
          rawOutput: { error: runResult.providerError.rawOutput },
          exitCode: runResult.providerError.exitCode,
          durationMs: Date.now() - startedAt
        };
      }

      return {
        ok: runResult.exitCode === 0,
        outputSummary:
          runResult.exitCode === 0 ? 'Local process sandbox completed command' : 'Local process sandbox command failed',
        rawOutput: { stdout: runResult.stdout, stderr: runResult.stderr, command: parsedCommand },
        exitCode: runResult.exitCode,
        durationMs: Date.now() - startedAt
      };
    } catch (error) {
      const providerError = normalizeLocalProcessSandboxError(error);
      return {
        ok: false,
        outputSummary: 'Local process sandbox command failed',
        errorMessage: providerError.message,
        rawOutput: { error: providerError.rawOutput },
        exitCode: providerError.exitCode,
        durationMs: Date.now() - startedAt
      };
    }
  }
}

interface ParsedLocalProcessCommand {
  executable: string;
  args: string[];
}

function parseLocalProcessCommand(command: string): ParsedLocalProcessCommand | undefined {
  if (/[|&;<>(){}[\]`$\\\n\r]|(?:^|\s)(?:>|<){1,2}(?:\s|$)/.test(command)) {
    return undefined;
  }

  const tokens = command.match(/"[^"]*"|'[^']*'|\S+/g);
  if (!tokens?.length) {
    return undefined;
  }

  return {
    executable: stripQuotes(tokens[0] ?? ''),
    args: tokens.slice(1).map(stripQuotes)
  };
}

function stripQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function validateLocalProcessArguments(command: ParsedLocalProcessCommand): string | undefined {
  if (command.executable === 'find' && command.args.includes('-delete')) {
    return 'Local process sandbox rejected command by policy';
  }

  if (command.executable === 'sed' && command.args.some(arg => arg === '-i' || arg.startsWith('-i'))) {
    return 'Local process sandbox rejected command by policy';
  }

  return undefined;
}

function spawnAsync(
  executable: string,
  args: string[],
  options: { cwd: string; timeout: number }
): Promise<LocalProcessRunResult> {
  return new Promise(resolve => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      shell: false,
      windowsHide: true
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
    }, options.timeout);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      stdout += chunk;
    });
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });
    child.on('error', error => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      resolve({
        stdout,
        stderr,
        exitCode: 1,
        providerError: normalizeLocalProcessSandboxError(error)
      });
    });
    child.on('close', code => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });
  });
}

interface LocalProcessRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  providerError?: NormalizedSandboxProviderError;
}

interface NormalizedSandboxProviderError {
  message: string;
  exitCode: number;
  rawOutput: {
    code: 'sandbox_provider_error';
    provider: 'local-process';
    reason: 'spawn_failed';
    hostErrorCode?: string | number;
  };
}

function normalizeLocalProcessSandboxError(error: unknown): NormalizedSandboxProviderError {
  const hostErrorCode =
    typeof (error as { code?: unknown }).code === 'string' || typeof (error as { code?: unknown }).code === 'number'
      ? (error as { code: string | number }).code
      : undefined;
  const exitCode = typeof hostErrorCode === 'number' ? hostErrorCode : 1;

  return {
    message: 'Local process sandbox command failed',
    exitCode,
    rawOutput: {
      code: 'sandbox_provider_error',
      provider: 'local-process',
      reason: 'spawn_failed',
      ...(hostErrorCode === undefined ? {} : { hostErrorCode })
    }
  };
}

function toCommandProfile(profile: SandboxProfile): CommandSafetyProfile | undefined {
  if (profile === 'readonly') {
    return 'readonly';
  }

  if (profile === 'verification') {
    return 'verification';
  }

  return undefined;
}
