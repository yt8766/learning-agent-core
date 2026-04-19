/* global console, process */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '..');

export function parseCleanupArgs(argv) {
  const args = new Set(argv);
  const retentionDaysArg = argv.find(arg => arg.startsWith('--retention-days='));
  const retentionDays = retentionDaysArg ? Number.parseInt(retentionDaysArg.split('=')[1] ?? '', 10) : 14;

  if (Number.isNaN(retentionDays) || retentionDays < 0) {
    throw new Error(`Invalid --retention-days value: ${retentionDaysArg ?? 'undefined'}`);
  }

  return {
    dryRun: args.has('--dry-run'),
    retentionDays
  };
}

export function getCleanupTargets(rootDir = serverRoot) {
  return [
    {
      label: 'agent-server logs',
      directory: path.join(rootDir, 'logs')
    },
    {
      label: 'legacy app-local data',
      directory: path.join(rootDir, 'data')
    }
  ];
}

export async function collectExpiredEntries(targets, now, retentionDays) {
  const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
  const expiredEntries = [];

  for (const target of targets) {
    if (!(await fs.pathExists(target.directory))) {
      continue;
    }

    expiredEntries.push(...(await collectExpiredEntriesForDirectory(target.label, target.directory, cutoff)));
  }

  return expiredEntries.sort((left, right) => left.path.localeCompare(right.path));
}

async function collectExpiredEntriesForDirectory(label, directory, cutoff) {
  const expiredEntries = [];
  const entries = await fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    const stats = await fs.stat(absolutePath);

    if (entry.isDirectory()) {
      expiredEntries.push(...(await collectExpiredEntriesForDirectory(label, absolutePath, cutoff)));
      const nestedEntries = await fs.readdir(absolutePath);
      if (nestedEntries.length === 0 && stats.mtimeMs < cutoff) {
        expiredEntries.push({
          label,
          path: absolutePath,
          type: 'directory'
        });
      }
      continue;
    }

    if (stats.mtimeMs >= cutoff) {
      continue;
    }

    expiredEntries.push({
      label,
      path: absolutePath,
      type: 'file'
    });
  }

  return expiredEntries;
}

export async function cleanupExpiredEntries(entries, dryRun) {
  if (dryRun) {
    return;
  }

  for (const entry of entries) {
    await fs.remove(entry.path);
  }
}

export function formatCleanupSummary(entries, dryRun, retentionDays) {
  if (entries.length === 0) {
    return `cleanup-agent-server-artifacts: no expired entries found (retention ${retentionDays} days, dryRun=${dryRun})`;
  }

  const header = `cleanup-agent-server-artifacts: ${dryRun ? 'would remove' : 'removed'} ${entries.length} expired entries (retention ${retentionDays} days)`;
  const lines = entries.map(entry => `- [${entry.label}] ${entry.path}`);
  return [header, ...lines].join('\n');
}

export async function runCleanup(argv = process.argv.slice(2), now = Date.now(), rootDir = serverRoot) {
  const { dryRun, retentionDays } = parseCleanupArgs(argv);
  const targets = getCleanupTargets(rootDir);
  const expiredEntries = await collectExpiredEntries(targets, now, retentionDays);
  await cleanupExpiredEntries(expiredEntries, dryRun);
  return formatCleanupSummary(expiredEntries, dryRun, retentionDays);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
  runCleanup()
    .then(summary => {
      console.log(summary);
    })
    .catch(error => {
      console.error(`cleanup-agent-server-artifacts failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    });
}
