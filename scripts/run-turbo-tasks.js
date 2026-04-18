import { runTurboTasks } from './turbo-runner.js';

const tasks = process.argv.slice(2);

if (tasks.length === 0) {
  console.error('[turbo-runner] expected at least one Turbo task name');
  process.exit(1);
}

console.log(`[turbo-runner] running ${tasks.join(', ')}`);

const result = runTurboTasks(tasks);

process.exit(result.status ?? 1);
