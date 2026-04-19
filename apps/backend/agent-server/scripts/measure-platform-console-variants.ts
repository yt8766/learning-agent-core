import fs from 'fs-extra';

import {
  formatPlatformConsoleEndpointVariantMeasurement,
  measurePlatformConsoleEndpointVariants
} from '../src/logger/platform-console-http-measurement';

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const measurement = await measurePlatformConsoleEndpointVariants({
    baselineLabel: options.baselineLabel,
    baselineUrl: options.baselineUrl,
    currentLabel: options.currentLabel,
    currentUrl: options.currentUrl,
    iterations: options.iterations,
    warmup: options.warmup,
    budgetsMs: {
      requestP95: options.requestP95Budget,
      serverTotalP95: options.serverTotalP95Budget
    }
  });

  if (options.outputPath) {
    await fs.outputJson(options.outputPath, measurement, { spaces: 2 });
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify(measurement, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatPlatformConsoleEndpointVariantMeasurement(measurement)}\n`);
  }

  const budgetFailures = [
    ...measurement.baseline.report.failedBudgets.map(reason => `${measurement.baseline.label}: ${reason}`),
    ...measurement.current.report.failedBudgets.map(reason => `${measurement.current.label}: ${reason}`)
  ];
  if (budgetFailures.length) {
    process.exitCode = 1;
  }
}

function parseArgs(argv: string[]) {
  const options = {
    baselineLabel: 'console',
    baselineUrl: 'http://127.0.0.1:3000/api/platform/console?days=30',
    currentLabel: 'console-shell',
    currentUrl: 'http://127.0.0.1:3000/api/platform/console-shell?days=30',
    iterations: 5,
    warmup: 1,
    requestP95Budget: 1000,
    serverTotalP95Budget: 1000,
    outputPath: '',
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--baseline-label' && argv[index + 1]) {
      options.baselineLabel = argv[index + 1]!;
      index += 1;
      continue;
    }
    if (current === '--baseline-url' && argv[index + 1]) {
      options.baselineUrl = argv[index + 1]!;
      index += 1;
      continue;
    }
    if (current === '--current-label' && argv[index + 1]) {
      options.currentLabel = argv[index + 1]!;
      index += 1;
      continue;
    }
    if (current === '--current-url' && argv[index + 1]) {
      options.currentUrl = argv[index + 1]!;
      index += 1;
      continue;
    }
    if (current === '--iterations' && argv[index + 1]) {
      options.iterations = Math.max(1, Number(argv[index + 1]) || options.iterations);
      index += 1;
      continue;
    }
    if (current === '--warmup' && argv[index + 1]) {
      options.warmup = Math.max(0, Number(argv[index + 1]) || options.warmup);
      index += 1;
      continue;
    }
    if (current === '--request-p95-budget' && argv[index + 1]) {
      options.requestP95Budget = Math.max(1, Number(argv[index + 1]) || options.requestP95Budget);
      index += 1;
      continue;
    }
    if (current === '--server-total-p95-budget' && argv[index + 1]) {
      options.serverTotalP95Budget = Math.max(1, Number(argv[index + 1]) || options.serverTotalP95Budget);
      index += 1;
      continue;
    }
    if (current === '--output' && argv[index + 1]) {
      options.outputPath = argv[index + 1]!;
      index += 1;
      continue;
    }
    if (current === '--json') {
      options.json = true;
    }
  }

  return options;
}

void main().catch(error => {
  process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exitCode = 1;
});
