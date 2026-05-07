import {
  runSkillsCliCommand,
  type SkillsCliCommandPlan
} from '../../infrastructure/external-process/skills-cli-runner';

type SkillsAddParams = { repo: string; skillName?: string };
export type SkillsCommandPlan = SkillsCliCommandPlan;

export function normalizeRepoForInstall(repo: string) {
  if (repo.startsWith('http://') || repo.startsWith('https://')) {
    return repo;
  }
  return `https://github.com/${repo}`;
}

export function buildSkillsAddArgs(params: SkillsAddParams) {
  if (!isRemoteUrl(params.repo) && params.skillName) {
    return ['skills', 'add', `${params.repo}@${params.skillName}`, '-g', '-y'];
  }

  const parts = ['skills', 'add', normalizeRepoForInstall(params.repo), '-g', '-y'];
  if (params.skillName) {
    parts.push('--skill', params.skillName);
  }
  return parts;
}

export function buildSkillsAddCommand(params: SkillsAddParams) {
  const parts = ['npx', ...buildSkillsAddArgs(params)];
  return parts.map(quoteShellArg).join(' ');
}

export function buildSkillsAddCommandPlan(params: SkillsAddParams): SkillsCommandPlan {
  return {
    command: 'npx',
    args: buildSkillsAddArgs(params)
  };
}

export function buildSkillsCheckCommand() {
  return ['npx', 'skills', 'check'].join(' ');
}

export function buildSkillsCheckCommandPlan(): SkillsCommandPlan {
  return {
    command: 'npx',
    args: ['skills', 'check']
  };
}

export function buildSkillsUpdateCommand() {
  return ['npx', 'skills', 'update'].join(' ');
}

export function buildSkillsUpdateCommandPlan(): SkillsCommandPlan {
  return {
    command: 'npx',
    args: ['skills', 'update']
  };
}

export function assertSafeSkillsShellCommand(command: string) {
  const normalized = command.trim();
  if (!normalized) {
    throw new Error('skills shell command is empty');
  }

  const dangerousFragments = ['&&', '||', ';', '|', '>', '<', '$(', '`', '\n', '\r'];
  if (dangerousFragments.some(fragment => normalized.includes(fragment))) {
    throw new Error(`unsafe skills shell command: ${normalized}`);
  }

  const tokens = normalized.split(/\s+/);
  if (tokens[0] !== 'npx' || tokens[1] !== 'skills') {
    throw new Error(`unsafe skills shell command: ${normalized}`);
  }

  const subcommand = tokens[2];
  if (!subcommand || !['add', 'check', 'update'].includes(subcommand)) {
    throw new Error(`unsafe skills shell command: ${normalized}`);
  }

  if (/\brm\s+-rf\b/i.test(normalized) || /\bdel\s+\/[sq]\b/i.test(normalized)) {
    throw new Error(`unsafe skills shell command: ${normalized}`);
  }
}

export function assertSafeSkillsArgs(args: string[]) {
  if (args.length < 2 || args[0] !== 'skills') {
    throw new Error(`unsafe skills args: ${args.join(' ')}`);
  }

  const subcommand = args[1];
  if (!['add', 'check', 'update'].includes(subcommand)) {
    throw new Error(`unsafe skills args: ${args.join(' ')}`);
  }

  const dangerousFragments = ['&&', '||', ';', '|', '>', '<', '$(', '`', '\n', '\r'];
  if (args.some(arg => dangerousFragments.some(fragment => arg.includes(fragment)))) {
    throw new Error(`unsafe skills args: ${args.join(' ')}`);
  }

  if (args.some(arg => /\brm\s+-rf\b/i.test(arg) || /\bdel\s+\/[sq]\b/i.test(arg))) {
    throw new Error(`unsafe skills args: ${args.join(' ')}`);
  }
}

export function execSkillsCommand(plan: SkillsCommandPlan) {
  if (plan.command !== 'npx') {
    throw new Error(`unsafe skills command: ${plan.command}`);
  }
  assertSafeSkillsArgs(plan.args);
  return runSkillsCliCommand(plan);
}

export function execShellCommand(command: string) {
  assertSafeSkillsShellCommand(command);
  const tokens = command.trim().split(/\s+/);
  return execSkillsCommand({ command: 'npx', args: tokens.slice(1) });
}

function quoteShellArg(value: string) {
  if (/^[a-zA-Z0-9_./:@-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function isRemoteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}
