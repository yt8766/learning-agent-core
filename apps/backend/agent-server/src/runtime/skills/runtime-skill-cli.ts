import shell from 'shelljs';

type SkillsAddParams = { repo: string; skillName?: string };

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

export function buildSkillsCheckCommand() {
  return ['npx', 'skills', 'check'].join(' ');
}

export function buildSkillsUpdateCommand() {
  return ['npx', 'skills', 'update'].join(' ');
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

export function execShellCommand(command: string) {
  assertSafeSkillsShellCommand(command);
  return new Promise<{ stdout: string; stderr: string }>((resolvePromise, rejectPromise) => {
    shell.exec(
      command,
      {
        async: true,
        silent: true,
        env: process.env,
        timeout: 60_000,
        maxBuffer: 1024 * 1024
      } as never,
      (code, stdout, stderr) => {
        if (code === 0) {
          resolvePromise({ stdout, stderr });
          return;
        }
        rejectPromise(new Error(stderr || stdout || `skills command failed with exit code ${code}`));
      }
    );
  });
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
