import { runPlatformConsoleAcceptanceWorkflow } from '../src/logger/platform-console-acceptance-orchestrator';

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await runPlatformConsoleAcceptanceWorkflow({
    baseUrl: options.baseUrl,
    outputDir: options.outputDir,
    baselineJsonPath: options.baselineJsonPath || undefined,
    reviewer: options.reviewer,
    version: options.version,
    goal: options.goal,
    date: options.date,
    environment: options.environment,
    days: options.days,
    iterations: options.iterations,
    warmup: options.warmup,
    requestP95Budget: options.requestP95Budget,
    serverTotalP95Budget: options.serverTotalP95Budget
  });

  process.stdout.write(
    [
      'Platform console acceptance workflow completed.',
      `current: ${result.paths.currentJsonPath}`,
      `comparison: ${result.paths.comparisonJsonPath}`,
      `log-analysis: ${result.paths.logAnalysisJsonPath}`,
      `acceptance: ${result.paths.acceptanceMarkdownPath}`
    ].join('\n') + '\n'
  );

  if (result.currentReport.failedBudgets.length || result.logAnalysis.summary.status !== 'healthy') {
    process.exitCode = 1;
  }
}

function parseArgs(argv: string[]) {
  const options = {
    baseUrl: 'http://127.0.0.1:3000',
    outputDir: '/tmp/platform-console-acceptance',
    baselineJsonPath: '',
    reviewer: 'unknown',
    version: 'unknown',
    goal: '验证 platform console 优化结果',
    date: new Date().toISOString().slice(0, 10),
    environment: 'staging',
    days: 30,
    iterations: 5,
    warmup: 1,
    requestP95Budget: 1000,
    serverTotalP95Budget: 1000
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--base-url' && argv[index + 1]) {
      options.baseUrl = argv[index + 1]!;
      index += 1;
      continue;
    }
    if (current === '--output-dir' && argv[index + 1]) {
      options.outputDir = argv[index + 1]!;
      index += 1;
      continue;
    }
    if (current === '--baseline-json' && argv[index + 1]) {
      options.baselineJsonPath = argv[index + 1]!;
      index += 1;
      continue;
    }
    if (current === '--reviewer' && argv[index + 1]) {
      options.reviewer = argv[index + 1]!;
      index += 1;
      continue;
    }
    if (current === '--version' && argv[index + 1]) {
      options.version = argv[index + 1]!;
      index += 1;
      continue;
    }
    if (current === '--goal' && argv[index + 1]) {
      options.goal = argv[index + 1]!;
      index += 1;
      continue;
    }
    if (current === '--date' && argv[index + 1]) {
      options.date = argv[index + 1]!;
      index += 1;
      continue;
    }
    if (current === '--environment' && argv[index + 1]) {
      options.environment = argv[index + 1]!;
      index += 1;
      continue;
    }
    if (current === '--days' && argv[index + 1]) {
      options.days = Math.max(1, Number(argv[index + 1]) || options.days);
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
    }
  }

  return options;
}

void main().catch(error => {
  process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exitCode = 1;
});
