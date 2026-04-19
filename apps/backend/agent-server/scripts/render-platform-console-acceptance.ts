import fs from 'fs-extra';

import type { PlatformConsoleLogAnalysis } from '../src/logger/platform-console-log-analysis';
import type {
  PlatformConsoleHttpMeasurementComparison,
  PlatformConsoleHttpMeasurementReport
} from '../src/logger/platform-console-http-measurement';
import { renderPlatformConsoleAcceptanceReport } from '../src/logger/platform-console-acceptance-report';

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const currentReport = (await fs.readJson(options.currentJsonPath)) as PlatformConsoleHttpMeasurementReport;
  const comparison = options.comparisonJsonPath
    ? ((await fs.readJson(options.comparisonJsonPath)) as PlatformConsoleHttpMeasurementComparison)
    : null;
  const logAnalysis = options.logAnalysisJsonPath
    ? ((await fs.readJson(options.logAnalysisJsonPath)) as PlatformConsoleLogAnalysis)
    : null;

  const markdown = renderPlatformConsoleAcceptanceReport({
    metadata: {
      date: options.date,
      reviewer: options.reviewer,
      environment: options.environment,
      version: options.version,
      goal: options.goal,
      backendUrl: options.backendUrl,
      baselineJsonPath: options.baselineJsonPath,
      currentJsonPath: options.currentJsonPath
    },
    currentReport,
    comparison,
    logAnalysis
  });

  if (options.outputPath) {
    await fs.outputFile(options.outputPath, `${markdown}\n`);
  } else {
    process.stdout.write(`${markdown}\n`);
  }
}

function parseArgs(argv: string[]) {
  const options = {
    currentJsonPath: '',
    comparisonJsonPath: '',
    logAnalysisJsonPath: '',
    outputPath: '',
    date: new Date().toISOString().slice(0, 10),
    reviewer: 'unknown',
    environment: 'staging',
    version: 'unknown',
    goal: '验证 platform console 优化结果',
    backendUrl: '',
    baselineJsonPath: ''
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--current-json' && argv[index + 1]) {
      options.currentJsonPath = argv[index + 1]!;
      index += 1;
      continue;
    }
    if (current === '--comparison-json' && argv[index + 1]) {
      options.comparisonJsonPath = argv[index + 1]!;
      index += 1;
      continue;
    }
    if (current === '--log-analysis-json' && argv[index + 1]) {
      options.logAnalysisJsonPath = argv[index + 1]!;
      index += 1;
      continue;
    }
    if (current === '--output' && argv[index + 1]) {
      options.outputPath = argv[index + 1]!;
      index += 1;
      continue;
    }
    if (current === '--date' && argv[index + 1]) {
      options.date = argv[index + 1]!;
      index += 1;
      continue;
    }
    if (current === '--reviewer' && argv[index + 1]) {
      options.reviewer = argv[index + 1]!;
      index += 1;
      continue;
    }
    if (current === '--environment' && argv[index + 1]) {
      options.environment = argv[index + 1]!;
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
    if (current === '--backend-url' && argv[index + 1]) {
      options.backendUrl = argv[index + 1]!;
      index += 1;
      continue;
    }
    if (current === '--baseline-json' && argv[index + 1]) {
      options.baselineJsonPath = argv[index + 1]!;
      index += 1;
    }
  }

  if (!options.currentJsonPath) {
    throw new Error('Missing required --current-json argument');
  }

  return options;
}

void main().catch(error => {
  process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exitCode = 1;
});
