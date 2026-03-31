import { startWorkerProcess } from './runtime/worker-runtime';

async function main(): Promise<void> {
  const handle = await startWorkerProcess();

  const shutdown = async (signal: string) => {
    console.info(`[worker] received ${signal}, shutting down background runner`);
    await handle.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  console.info('[worker] ready', {
    profile: handle.runtime.settings.profile,
    tasksStateFilePath: handle.runtime.settings.tasksStateFilePath,
    runnerId: handle.context.runnerId,
    workerPoolSize: handle.context.workerPoolSize,
    leaseTtlMs: handle.context.leaseTtlMs,
    heartbeatMs: handle.context.heartbeatMs,
    pollMs: handle.context.pollMs
  });
}

void main();
