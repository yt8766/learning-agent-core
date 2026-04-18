import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const RULES = [
  {
    canonical: '通政司 / EntryRouter',
    aliases: ['entry router', 'entrydecision', 'entry decision'],
    paths: ['packages', 'apps', 'docs'],
    severity: 'warn'
  },
  {
    canonical: '司礼监 / InterruptController',
    aliases: ['interrupt controller', 'activeinterrupt', 'interrupthistory'],
    paths: ['packages', 'apps', 'docs'],
    severity: 'warn'
  },
  {
    canonical: 'executionPlan.mode',
    aliases: ['planning-readonly', 'standard'],
    paths: ['packages', 'apps', 'docs'],
    severity: 'warn'
  },
  {
    canonical: '群辅 / counselor',
    aliases: ['specialist lead', 'supporting specialists'],
    paths: ['packages', 'apps', 'docs'],
    severity: 'error'
  }
];

async function main() {
  const files = await collectFiles(process.cwd(), ['packages', 'apps', 'docs']);
  const warnings = [];
  const errors = [];

  for (const file of files) {
    const content = await readFile(file, 'utf8').catch(() => '');
    const normalized = content.toLowerCase();
    for (const rule of RULES) {
      if (!rule.paths.some(prefix => file.includes(`/${prefix}/`) || file.endsWith(`/${prefix}`))) {
        continue;
      }
      for (const alias of rule.aliases) {
        if (normalized.includes(alias.toLowerCase()) && !normalized.includes(rule.canonical.toLowerCase())) {
          const message = `${file}: found alias "${alias}" without canonical "${rule.canonical}"`;
          if (rule.severity === 'warn') {
            warnings.push(message);
          } else {
            errors.push(message);
          }
        }
      }
    }
  }

  if (!warnings.length && !errors.length) {
    console.log('terminology check passed');
    return;
  }

  if (warnings.length) {
    console.log('terminology legacy warnings:');
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  }
  if (errors.length) {
    console.log('terminology drift errors:');
    for (const error of errors) {
      console.log(`- ${error}`);
    }
    process.exitCode = 1;
  }
}

async function collectFiles(root, targets) {
  const files = [];
  for (const target of targets) {
    await walk(join(root, target), files);
  }
  return files.filter(file => /\.(js|ts|tsx|md)$/.test(file));
}

async function walk(dir, files) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    // `dist` is intentionally skipped because generated, non-tracked build output should not define canonical terminology.
    if (
      entry.name === 'node_modules' ||
      entry.name === 'build' ||
      entry.name === 'dist' ||
      entry.name.startsWith('.')
    ) {
      continue;
    }
    const nextPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(nextPath, files);
      continue;
    }
    files.push(nextPath);
  }
}

void main();
