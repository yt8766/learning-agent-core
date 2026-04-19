import fs from 'fs-extra';

import { fetchPlatformConsoleLogAnalysis } from '../src/logger/platform-console-log-analysis-client';

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const analysis = await fetchPlatformConsoleLogAnalysis({
    baseUrl: options.baseUrl,
    days: options.days
  });

  if (options.outputPath) {
    await fs.outputJson(options.outputPath, analysis, { spaces: 2 });
  }

  if (options.json || options.outputPath) {
    process.stdout.write(`${JSON.stringify(analysis, null, 2)}\n`);
    return;
  }

  process.stdout.write(
    `Fetched platform console log analysis: samples=${analysis.sampleCount} status=${analysis.summary.status}\n`
  );
}

function parseArgs(argv: string[]) {
  const options = {
    baseUrl: 'http://127.0.0.1:3000',
    days: 7,
    outputPath: '',
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--base-url' && argv[index + 1]) {
      options.baseUrl = argv[index + 1]!;
      index += 1;
      continue;
    }
    if (current === '--days' && argv[index + 1]) {
      options.days = Math.max(1, Number(argv[index + 1]) || options.days);
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
