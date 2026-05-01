import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parentPort, workerData } from 'node:worker_threads';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const appRoot = join(__dirname, '..');
  const facadeModule = await loadModule(
    join(appRoot, 'dist', 'runtime', 'core', 'runtime-intel-briefing-facade.js'),
    join(appRoot, 'src', 'runtime', 'core', 'runtime-intel-briefing-facade.ts')
  );

  if (!String(workerData?.jobId ?? '').startsWith('runtime-tech-briefing:')) {
    throw new Error(`Unsupported scheduled job: ${workerData?.jobId ?? 'unknown'}`);
  }

  const { RuntimeIntelBriefingFacade } = facadeModule;
  const service = new RuntimeIntelBriefingFacade(() => ({
    settings: {
      workspaceRoot: workerData.workspaceRoot,
      dailyTechBriefing: workerData.dailyTechBriefing
    }
  }));

  await service.runScheduled(new Date(), workerData?.category ? [workerData.category] : undefined);
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
