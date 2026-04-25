/* global console, process */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appRoot, '../..');
const runnerArg = process.argv.find(arg => arg.startsWith('--runner='));
const runner = runnerArg?.split('=')[1] ?? 'container';
const keepUp = process.argv.includes('--keep-up');
const projectName = process.env.LLM_GATEWAY_E2E_PROJECT ?? 'llm-gateway-e2e';
const composeArgs = ['compose', '-p', projectName, '-f', 'docker-compose.e2e.yml'];
const e2eSpecGlob = 'apps/llm-gateway/test/e2e/**/*.e2e-spec.ts';

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: appRoot,
    stdio: 'inherit',
    ...options
  });
}

function docker(args) {
  return run('docker', [...composeArgs, ...args]);
}

function dockerWithHostPort(args) {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'llm-gateway-e2e-compose-'));
  const overridePath = path.join(tempDir, 'docker-compose.host-port.yml');
  const port = process.env.LLM_GATEWAY_E2E_PORT ?? '3100';

  try {
    writeFileSync(
      overridePath,
      `services:
  llm-gateway-e2e-app:
    ports:
      - '${port}:3000'
`
    );

    return run('docker', [...composeArgs, '-f', overridePath, ...args]);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function printLogs() {
  docker(['logs', '--no-color', 'llm-gateway-e2e-app']);
  docker(['ps']);
}

function cleanupCommand() {
  return `docker compose -p ${projectName} -f apps/llm-gateway/docker-compose.e2e.yml down -v --remove-orphans --rmi local`;
}

function runVitestE2e(env = process.env) {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'llm-gateway-e2e-vitest-'));
  const configPath = path.join(tempDir, 'vitest.e2e.config.mjs');

  try {
    writeFileSync(
      configPath,
      `import baseConfig from ${JSON.stringify(pathToFileURL(path.join(repoRoot, 'vitest.config.js')).href)};

export default {
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: [${JSON.stringify(e2eSpecGlob)}],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.turbo/**', '**/coverage/**', '**/data/**'],
    passWithNoTests: false
  }
};
`
    );

    return run('pnpm', ['exec', 'vitest', 'run', '--config', configPath], {
      cwd: repoRoot,
      env
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

let status = 1;

try {
  if (runner === 'container') {
    if (keepUp) {
      const up = docker(['up', '--build', '-d', 'llm-gateway-e2e-postgres', 'llm-gateway-e2e-app']);
      if (up.status !== 0) {
        status = up.status ?? 1;
      } else {
        const result = docker(['run', '--rm', 'llm-gateway-e2e-runner']);
        status = typeof result.status === 'number' ? result.status : 1;
      }
    } else {
      const result = docker([
        'up',
        '--build',
        '--abort-on-container-exit',
        '--exit-code-from',
        'llm-gateway-e2e-runner',
        'llm-gateway-e2e-runner'
      ]);
      status = typeof result.status === 'number' ? result.status : 1;
    }
  } else if (runner === 'host') {
    const up = dockerWithHostPort(['up', '--build', '-d', 'llm-gateway-e2e-postgres', 'llm-gateway-e2e-app']);
    if (up.status !== 0) {
      status = up.status ?? 1;
    } else {
      const result = runVitestE2e({
        ...process.env,
        LLM_GATEWAY_E2E_BASE_URL: `http://127.0.0.1:${process.env.LLM_GATEWAY_E2E_PORT ?? '3100'}`
      });
      status = typeof result.status === 'number' ? result.status : 1;
    }
  } else if (runner === 'direct') {
    const result = runVitestE2e();
    status = typeof result.status === 'number' ? result.status : 1;
  } else {
    console.error(`[llm-gateway:e2e] unsupported runner: ${runner}`);
    status = 1;
  }

  if (status !== 0 && runner !== 'direct') {
    printLogs();
  }
} finally {
  if (runner !== 'direct' && !keepUp) {
    docker(['down', '-v', '--remove-orphans', '--rmi', 'local']);
  } else if (runner !== 'direct') {
    console.log(`[llm-gateway:e2e] keeping compose project ${projectName} up for debugging`);
    console.log(`[llm-gateway:e2e] cleanup with: ${cleanupCommand()}`);
    console.log('[llm-gateway:e2e] package cleanup alias: pnpm --dir apps/llm-gateway test:e2e:down');
  }
}

process.exit(status);
