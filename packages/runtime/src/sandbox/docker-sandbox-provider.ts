import { spawn } from 'node:child_process';

import type { ToolExecutionResult } from '../contracts/governance';

import { CommandPolicy, RawCommandClassifier } from '@agent/tools';
import type {
  SandboxProvider,
  SandboxProviderPlugin,
  SandboxProviderRegistry,
  SandboxProviderResolutionInput,
  SandboxCapability,
  SandboxProfile,
  SandboxRunRequest
} from './sandbox-provider';

const DEFAULT_DOCKER_IMAGE = 'node:20-alpine';
const DEFAULT_CONTAINER_WORKSPACE_PATH = '/workspace';
const DEFAULT_TIMEOUT_MS = 30_000;

export interface DockerSandboxProviderOptions {
  image?: string;
  dockerBinary?: string;
  containerWorkspacePath?: string;
  runner?: DockerSandboxRunner;
  dryRun?: boolean;
  defaultTimeoutMs?: number;
}

export interface DockerSandboxCommandPlan {
  executable: string;
  args: string[];
  cwd: string;
  command: string;
  profile: 'readonly' | 'verification' | 'workspace-write';
  image: string;
  workspacePath: string;
  readonlyMount: boolean;
  timeoutMs: number;
}

export interface DockerSandboxRunnerResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type DockerSandboxRunner = (plan: DockerSandboxCommandPlan) => Promise<DockerSandboxRunnerResult>;

export class DockerSandboxProvider implements SandboxProvider {
  readonly id = 'docker';
  readonly supportedProfiles: SandboxProfile[] = ['readonly', 'verification', 'workspace-write'];
  readonly supportedCapabilities: SandboxCapability[] = ['command'];

  private readonly options: Required<Omit<DockerSandboxProviderOptions, 'runner'>> & {
    runner: DockerSandboxRunner;
  };

  constructor(options: DockerSandboxProviderOptions = {}) {
    this.options = {
      image: options.image ?? DEFAULT_DOCKER_IMAGE,
      dockerBinary: options.dockerBinary ?? 'docker',
      containerWorkspacePath: options.containerWorkspacePath ?? DEFAULT_CONTAINER_WORKSPACE_PATH,
      dryRun: options.dryRun ?? false,
      defaultTimeoutMs: options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS,
      runner: options.runner ?? runDockerSandboxCommand
    };
  }

  canRun(input: SandboxProviderResolutionInput): boolean {
    return (
      input.capability === 'command' &&
      (input.profile === 'readonly' || input.profile === 'verification' || input.profile === 'workspace-write')
    );
  }

  async run(request: SandboxRunRequest): Promise<ToolExecutionResult> {
    const startedAt = Date.now();

    if (request.profile === 'unrestricted') {
      return {
        ok: false,
        outputSummary: 'Docker sandbox rejected unsupported profile',
        errorMessage: 'Docker sandbox does not support unrestricted profile',
        exitCode: 1,
        durationMs: Date.now() - startedAt
      };
    }

    const policyError = evaluateDockerCommandPolicy(request);
    if (policyError) {
      return {
        ok: false,
        outputSummary: 'Docker sandbox rejected command by policy',
        errorMessage: policyError,
        exitCode: 1,
        durationMs: Date.now() - startedAt
      };
    }

    const plan = buildDockerSandboxCommandPlan(request, this.options);

    if (this.options.dryRun) {
      return {
        ok: true,
        outputSummary: 'Docker sandbox planned command',
        rawOutput: { plan, dryRun: true },
        exitCode: 0,
        durationMs: Date.now() - startedAt
      };
    }

    try {
      const result = await this.options.runner(plan);
      return {
        ok: result.exitCode === 0,
        outputSummary: result.exitCode === 0 ? 'Docker sandbox completed command' : 'Docker sandbox command failed',
        rawOutput: { stdout: result.stdout, stderr: result.stderr, plan },
        exitCode: result.exitCode,
        durationMs: Date.now() - startedAt
      };
    } catch (error) {
      const sandboxError = normalizeDockerSandboxError(error);
      return {
        ok: false,
        outputSummary: 'Docker sandbox command failed',
        errorMessage: sandboxError.message,
        rawOutput: { error: sandboxError.rawOutput },
        exitCode: sandboxError.exitCode,
        durationMs: Date.now() - startedAt
      };
    }
  }
}

export function createDockerSandboxProviderPlugin(options: DockerSandboxProviderOptions = {}): SandboxProviderPlugin {
  return {
    id: 'docker-sandbox-provider',
    register(registry: SandboxProviderRegistry): void {
      registry.register(new DockerSandboxProvider(options));
    }
  };
}

export function buildDockerSandboxCommandPlan(
  request: SandboxRunRequest,
  options: DockerSandboxProviderOptions = {}
): DockerSandboxCommandPlan {
  if (request.profile === 'unrestricted') {
    throw new Error('Docker sandbox does not support unrestricted profile');
  }

  const image = options.image ?? DEFAULT_DOCKER_IMAGE;
  const executable = options.dockerBinary ?? 'docker';
  const workspacePath = options.containerWorkspacePath ?? DEFAULT_CONTAINER_WORKSPACE_PATH;
  const readonlyMount = request.profile === 'readonly' || request.profile === 'verification';
  const mount = readonlyMount ? `${request.cwd}:${workspacePath}:ro` : `${request.cwd}:${workspacePath}`;

  return {
    executable,
    args: ['run', '--rm', '--network', 'none', '-w', workspacePath, '-v', mount, image, 'sh', '-lc', request.command],
    cwd: request.cwd,
    command: request.command,
    profile: request.profile,
    image,
    workspacePath,
    readonlyMount,
    timeoutMs: request.timeoutMs ?? options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS
  };
}

function evaluateDockerCommandPolicy(request: SandboxRunRequest): string | undefined {
  if (request.profile === 'readonly' || request.profile === 'verification') {
    const decision = new CommandPolicy({ profile: request.profile }).evaluate({ rawCommand: request.command });
    return decision.decision === 'allow' ? undefined : decision.reason;
  }

  const classification = new RawCommandClassifier().classify(request.command);
  return classification.isDestructive ? 'Destructive commands are denied.' : undefined;
}

function runDockerSandboxCommand(plan: DockerSandboxCommandPlan): Promise<DockerSandboxRunnerResult> {
  return new Promise(resolve => {
    const child = spawn(plan.executable, plan.args, {
      cwd: plan.cwd,
      shell: false,
      windowsHide: true
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      if (settled) {
        return;
      }
      settled = true;
      resolve({
        stdout,
        stderr: stderr || 'Docker sandbox command timed out',
        exitCode: 124
      });
    }, plan.timeoutMs);

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
      resolve({ stdout, stderr: stderr || error.message, exitCode: 1 });
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

function normalizeDockerSandboxError(error: unknown): {
  message: string;
  exitCode: number;
  rawOutput: {
    code: 'sandbox_provider_error';
    provider: 'docker';
    reason: 'runner_failed';
    hostErrorCode?: string | number;
  };
} {
  const hostErrorCode =
    typeof (error as { code?: unknown }).code === 'string' || typeof (error as { code?: unknown }).code === 'number'
      ? (error as { code: string | number }).code
      : undefined;
  const exitCode = typeof hostErrorCode === 'number' ? hostErrorCode : 1;
  const message = exitCode === 124 ? 'Docker sandbox command timed out' : 'Docker sandbox command failed';

  return {
    message,
    exitCode,
    rawOutput: {
      code: 'sandbox_provider_error',
      provider: 'docker',
      reason: 'runner_failed',
      ...(hostErrorCode === undefined ? {} : { hostErrorCode })
    }
  };
}
