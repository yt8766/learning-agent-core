import fs from 'fs-extra';

import {
  comparePlatformConsoleHttpMeasurementReports,
  formatPlatformConsoleHttpMeasurementComparison,
  formatPlatformConsoleHttpMeasurementReport,
  type PlatformConsoleHttpMeasurementReport,
  measurePlatformConsoleEndpoint
} from '../src/logger/platform-console-http-measurement';

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = await measurePlatformConsoleEndpoint({
    url: options.url,
    iterations: options.iterations,
    warmup: options.warmup,
    budgetsMs: {
      requestP95: options.requestP95Budget,
      serverTotalP95: options.serverTotalP95Budget
    }
  });

  const baselineReport = options.baselineJsonPath
    ? ((await fs.readJson(options.baselineJsonPath)) as PlatformConsoleHttpMeasurementReport)
    : null;
  const comparison = baselineReport ? comparePlatformConsoleHttpMeasurementReports(baselineReport, report) : null;

  if (options.reportOutputPath) {
    await fs.outputJson(options.reportOutputPath, report, { spaces: 2 });
  }
  if (options.compareOutputPath) {
    if (!comparison) {
      throw new Error('The --compare-output option requires --baseline-json');
    }
    await fs.outputJson(options.compareOutputPath, comparison, { spaces: 2 });
  }

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify(
        comparison
          ? {
              report,
              comparison
            }
          : report,
        null,
        2
      )}\n`
    );
  } else {
    process.stdout.write(`${formatPlatformConsoleHttpMeasurementReport(report)}\n`);
    if (comparison) {
      process.stdout.write(`\n${formatPlatformConsoleHttpMeasurementComparison(comparison)}\n`);
    }
  }

  if (report.failedBudgets.length) {
    process.exitCode = 1;
  }
}

function parseArgs(argv: string[]) {
  const options = {
    url: 'http://127.0.0.1:3000/api/platform/console?days=30',
    iterations: 5,
    warmup: 1,
    requestP95Budget: 1000,
    serverTotalP95Budget: 1000,
    baselineJsonPath: '',
    reportOutputPath: '',
    compareOutputPath: '',
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--url' && argv[index + 1]) {
      options.url = argv[index + 1]!;
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
    if (current === '--baseline-json' && argv[index + 1]) {
      options.baselineJsonPath = argv[index + 1]!;
      index += 1;
      continue;
    }
    if (current === '--report-output' && argv[index + 1]) {
      options.reportOutputPath = argv[index + 1]!;
      index += 1;
      continue;
    }
    if (current === '--compare-output' && argv[index + 1]) {
      options.compareOutputPath = argv[index + 1]!;
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
