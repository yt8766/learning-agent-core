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
const projectName = `llm-gateway-e2e-${Date.now()}`;
const composeArgs = ['compose', '-p', projectName, '-f', 'docker-compose.e2e.yml'];

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

function printLogs() {
  docker(['logs', '--no-color', 'llm-gateway-e2e-app']);
  docker(['ps']);
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
    include: ['apps/llm-gateway/test/e2e/llm-gateway-http.e2e-spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.turbo/**', '**/coverage/**', '**/data/**'],
    passWithNoTests: false
  }
};
`
    );

    return run(
      'pnpm',
      ['exec', 'vitest', 'run', '--config', configPath, 'apps/llm-gateway/test/e2e/llm-gateway-http.e2e-spec.ts'],
      {
        cwd: repoRoot,
        env
      }
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

let status = 1;

try {
  if (runner === 'container') {
    const result = docker([
      'up',
      '--build',
      '--abort-on-container-exit',
      '--exit-code-from',
      'llm-gateway-e2e-runner',
      'llm-gateway-e2e-runner'
    ]);
    status = typeof result.status === 'number' ? result.status : 1;
  } else if (runner === 'host') {
    const up = docker(['up', '--build', '-d', 'llm-gateway-e2e-postgres', 'llm-gateway-e2e-app']);
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
    docker(['down', '-v', '--remove-orphans']);
  } else if (runner !== 'direct') {
    console.log(`[llm-gateway:e2e] keeping compose project ${projectName} up for debugging`);
  }
}

process.exit(status);
