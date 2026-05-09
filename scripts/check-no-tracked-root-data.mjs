#!/usr/bin/env node
/* global console, process */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const { stdout } = await execFileAsync('git', ['ls-files', 'data']);
const tracked = stdout
  .split('\n')
  .map(line => line.trim())
  .filter(Boolean);

if (tracked.length > 0) {
  console.error('[check-no-tracked-root-data] tracked root data files remain:');
  for (const file of tracked) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log('[check-no-tracked-root-data] OK');
