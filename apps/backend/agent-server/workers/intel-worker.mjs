import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parentPort, workerData } from 'node:worker_threads';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const appRoot = join(__dirname, '..');
  const runnerModule = await loadModule(
    join(appRoot, 'dist', 'runtime', 'intel', 'intel-runner.js'),
    join(appRoot, 'src', 'runtime', 'intel', 'intel-runner.ts')
  );

  if (!String(workerData?.jobName ?? '').startsWith('intel-')) {
    throw new Error(`Unsupported intel scheduled job: ${workerData?.jobName ?? 'unknown'}`);
  }

  await runnerModule.runIntelScheduledJob({
    jobName: workerData.jobName,
    workspaceRoot: workerData.workspaceRoot
  });
  parentPort?.postMessage('done');
}

async function loadModule(distPath, srcPath) {
  if (existsSync(distPath)) {
    return import(pathToFileURL(distPath).href);
  }

  await import('ts-node/register/transpile-only');
  await import('tsconfig-paths/register');
  return import(pathToFileURL(srcPath).href);
}

void main().catch(error => {
  throw error;
});
