import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const TURBO_RUNTIME_DIRNAME = 'learning-agent-core-turbo';

export function resolveTurboRuntimeRoot(env = process.env) {
  const configuredRoot = env.TURBO_RUNTIME_ROOT?.trim();
  return configuredRoot || path.join(os.tmpdir(), TURBO_RUNTIME_DIRNAME);
}

export function shouldDisableTurboCache(env = process.env) {
  return env.CI === 'true';
}

export function buildTurboRunArgs(tasks, options = {}) {
  const env = options.env ?? process.env;
  const runtimeRoot = options.runtimeRoot ?? resolveTurboRuntimeRoot(env);
  const cacheDir = path.join(runtimeRoot, 'cache');
  const args = ['exec', 'turbo', 'run', ...tasks, `--cache-dir=${cacheDir}`];

  if (options.filter) {
    args.push(`--filter=${options.filter}`);
  }

  if (shouldDisableTurboCache(env)) {
    args.push('--cache=local:r,remote:r');
  }

  return {
    args,
    cacheDir,
    tempDir: path.join(runtimeRoot, 'tmp')
  };
}

export function runTurboTasks(tasks, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const { args, cacheDir, tempDir } = buildTurboRunArgs(tasks, options);

  fs.mkdirSync(cacheDir, { recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });

  return spawnSync('pnpm', args, {
    cwd,
    stdio: 'inherit',
    env: {
      ...env,
      TMPDIR: tempDir,
      TMP: tempDir,
      TEMP: tempDir
    }
  });
}
