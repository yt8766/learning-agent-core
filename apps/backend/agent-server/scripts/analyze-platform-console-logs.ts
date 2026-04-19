import { createReadStream } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';

import fs from 'fs-extra';

import {
  analyzePlatformConsoleLogs,
  formatPlatformConsoleLogAnalysis
} from '../src/logger/platform-console-log-analysis';

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const files = await resolveInputFiles(options);
  const lines: string[] = [];

  for (const filePath of files) {
    const stream = createReadStream(filePath, 'utf8');
    const reader = createInterface({
      input: stream,
      crlfDelay: Infinity
    });
    for await (const line of reader) {
      lines.push(line);
    }
  }

  const analysis = analyzePlatformConsoleLogs(lines, {
    latestSampleLimit: options.latestSampleLimit
  });

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ files, analysis }, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${formatPlatformConsoleLogAnalysis(analysis)}\n`);
  process.stdout.write(`Scanned files:\n${files.map(filePath => `  ${filePath}`).join('\n')}\n`);
}

async function resolveInputFiles(options: { filePaths: string[]; logsDir: string }): Promise<string[]> {
  if (options.filePaths.length > 0) {
    return options.filePaths.map(filePath => resolve(filePath));
  }

  const logsDir = resolve(options.logsDir);
  const entries = await fs.readdir(logsDir);
  return entries
    .filter(entry => /^performance-\d{4}-\d{2}-\d{2}\.log$/.test(entry))
    .sort()
    .map(entry => resolve(logsDir, entry));
}

function parseArgs(argv: string[]) {
  const options = {
    filePaths: [] as string[],
    logsDir: resolve(process.cwd(), 'apps/backend/agent-server/logs'),
    latestSampleLimit: 5,
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--file' && argv[index + 1]) {
      options.filePaths.push(argv[index + 1]!);
      index += 1;
      continue;
    }
    if (current === '--dir' && argv[index + 1]) {
      options.logsDir = argv[index + 1]!;
      index += 1;
      continue;
    }
    if (current === '--latest' && argv[index + 1]) {
      options.latestSampleLimit = Math.max(1, Number(argv[index + 1]) || 5);
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
