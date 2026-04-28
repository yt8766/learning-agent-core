import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const FORBIDDEN_RUNTIME_IMPORT_PATTERNS = [
  /packages\/runtime\/src/,
  /@agent\/runtime\//,
  /runtime\/agent-bridges/,
  /from ['"]@agent\/runtime['"]/
];
const FORBIDDEN_CORE_DATA_REPORT_IMPORT_PATTERNS = [
  /import[^;]*(DataReport|ReportBundle|ReportDocument|ReportPatchOperation)[^;]*from ['"]@agent\/core['"]/s,
  /from ['"]@agent\/core\/data-report/,
  /packages\/core\/src\/data-report/,
  /packages\/core\/src\/contracts\/data-report/
];
const FORBIDDEN_REPORT_KIT_CORE_DATA_REPORT_PATTERNS = [
  /from ['"]@agent\/core['"]/,
  /from ['"]@agent\/core\/data-report/,
  /packages\/core\/src\/data-report/,
  /packages\/core\/src\/contracts\/data-report/
];

async function collectTsFiles(rootDir: string): Promise<string[]> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async entry => {
      const fullPath = join(rootDir, entry.name);
      if (entry.isDirectory()) {
        return collectTsFiles(fullPath);
      }
      if (entry.isFile() && fullPath.endsWith('.ts')) {
        return [fullPath];
      }
      return [];
    })
  );

  return files.flat();
}

async function collectExistingTsFiles(rootDir: string): Promise<string[]> {
  try {
    return await collectTsFiles(rootDir);
  } catch {
    return [];
  }
}

describe('@agent/agents-data-report shared agent foundation boundary', () => {
  it('does not depend on runtime internals or a direct @agent/runtime root import', async () => {
    const srcRoot = join(process.cwd(), 'agents', 'data-report', 'src');
    const files = await collectTsFiles(srcRoot);
    const violations: string[] = [];

    for (const file of files) {
      const content = await readFile(file, 'utf8');
      if (FORBIDDEN_RUNTIME_IMPORT_PATTERNS.some(pattern => pattern.test(content))) {
        violations.push(relative(srcRoot, file));
      }
    }

    expect(violations).toEqual([]);
  });
});

describe('@agent/agents-data-report contract ownership boundary', () => {
  it('keeps data-report schemas and contracts inside the data-report agent package', async () => {
    const srcRoot = join(process.cwd(), 'agents', 'data-report', 'src');
    const files = await collectTsFiles(srcRoot);
    const violations: string[] = [];

    for (const file of files) {
      const content = await readFile(file, 'utf8');
      if (FORBIDDEN_CORE_DATA_REPORT_IMPORT_PATTERNS.some(pattern => pattern.test(content))) {
        violations.push(relative(srcRoot, file));
      }
    }

    expect(violations).toEqual([]);
  });

  it('does not keep legacy data-report contract source files in @agent/core', async () => {
    const coreRoot = join(process.cwd(), 'packages', 'core', 'src');

    await expect(collectExistingTsFiles(join(coreRoot, 'data-report'))).resolves.toEqual([]);
    await expect(collectExistingTsFiles(join(coreRoot, 'contracts', 'data-report'))).resolves.toEqual([]);
  });

  it('keeps report-kit independent from core data-report contracts', async () => {
    const srcRoot = join(process.cwd(), 'packages', 'report-kit', 'src');
    const files = await collectTsFiles(srcRoot);
    const violations: string[] = [];

    for (const file of files) {
      const content = await readFile(file, 'utf8');
      if (FORBIDDEN_REPORT_KIT_CORE_DATA_REPORT_PATTERNS.some(pattern => pattern.test(content))) {
        violations.push(relative(srcRoot, file));
      }
    }

    expect(violations).toEqual([]);
  });
});
