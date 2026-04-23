import { WorkerRegistry, createDefaultWorkerRegistry } from '../src/index.js';

const registry = createDefaultWorkerRegistry();
const workers = registry.list();
const isRegistryInstance = registry instanceof WorkerRegistry;

console.log(
  JSON.stringify(
    {
      workerRegistryCreated: isRegistryInstance,
      workerCount: workers.length
    },
    null,
    2
  )
);
