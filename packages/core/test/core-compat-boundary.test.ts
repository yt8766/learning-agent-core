import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const packageRoot = path.resolve(import.meta.dirname, '..');
const srcRoot = path.join(packageRoot, 'src');

const compatImportPatterns = [
  /from ['"]\.\.\/spec\/tasking(?:-(?:chat|checkpoint|orchestration|planning|runtime-state|session|task-record|thought-graph))?['"]/,
  /from ['"]\.\.\/\.\.\/spec\/tasking(?:-(?:chat|checkpoint|orchestration|planning|runtime-state|session|task-record|thought-graph))?['"]/,
  /from ['"]\.\.\/types\/tasking(?:-(?:chat|checkpoint|orchestration|planning|runtime-state|session|task-record|thought-graph))?['"]/,
  /from ['"]\.\.\/\.\.\/types\/tasking(?:-(?:chat|checkpoint|orchestration|planning|runtime-state|session|task-record|thought-graph))?['"]/,
  /from ['"]\.\.\/spec\/data-report(?:-json(?:-schema)?)?['"]/,
  /from ['"]\.\.\/\.\.\/spec\/data-report(?:-json(?:-schema)?)?['"]/,
  /from ['"]\.\.\/types\/data-report(?:-json(?:-schema)?)?['"]/,
  /from ['"]\.\.\/\.\.\/types\/data-report(?:-json(?:-schema)?)?['"]/,
  /from ['"]\.\.\/spec\/(?:governance|knowledge-runtime|channels|connectors|workflow-route|delivery|execution-trace|skills-search|platform-console|architecture-records|primitives)['"]/,
  /from ['"]\.\.\/\.\.\/spec\/(?:governance|knowledge-runtime|channels|connectors|workflow-route|delivery|execution-trace|skills-search|platform-console|architecture-records|primitives)['"]/,
  /from ['"]\.\.\/types\/(?:governance|knowledge-runtime|channels|connectors|workflow-route|delivery|execution-trace|skills-search|platform-console|architecture-records|primitives)['"]/,
  /from ['"]\.\.\/\.\.\/types\/(?:governance|knowledge-runtime|channels|connectors|workflow-route|delivery|execution-trace|skills-search|platform-console|architecture-records|primitives)['"]/,
  /from ['"]\.\.\/spec\/skills['"]/,
  /from ['"]\.\.\/\.\.\/spec\/skills['"]/,
  /from ['"]\.\.\/spec\/skills\/(?:capability|safety|catalog|registry)['"]/,
  /from ['"]\.\.\/\.\.\/spec\/skills\/(?:capability|safety|catalog|registry)['"]/,
  /from ['"]\.\.\/types\/skills['"]/,
  /from ['"]\.\.\/\.\.\/types\/skills['"]/,
  /from ['"]\.\.\/spec\/tasking\/(?:session|chat|planning|orchestration|runtime-state|checkpoint|task-record|thought-graph|tasking)['"]/,
  /from ['"]\.\.\/\.\.\/spec\/tasking\/(?:session|chat|planning|orchestration|runtime-state|checkpoint|task-record|thought-graph|tasking)['"]/,
  /from ['"]\.\.\/types\/tasking\/(?:tasking|chat|planning|orchestration|runtime-state|session|checkpoint|task-record|thought-graph)['"]/,
  /from ['"]\.\.\/\.\.\/types\/tasking\/(?:tasking|chat|planning|orchestration|runtime-state|session|checkpoint|task-record|thought-graph)['"]/,
  /from ['"]\.\.\/types\/data-report\/(?:data-report|data-report-json|data-report-json-schema)['"]/,
  /from ['"]\.\.\/\.\.\/types\/data-report\/(?:data-report|data-report-json|data-report-json-schema)['"]/,
  /from ['"]\.\.\/\.\.\/spec\/governance\/matchers['"]/,
  /from ['"]\.\.\/\.\.\/spec\/knowledge\/evidence['"]/,
  /from ['"]\.\.\/\.\.\/spec\/review\/(?:specialist-finding|critique-result)['"]/
] as const;

function collectTypeScriptFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const absolutePath = path.join(dir, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      return collectTypeScriptFiles(absolutePath);
    }

    if (absolutePath.endsWith('.ts')) {
      return [absolutePath];
    }

    return [];
  });
}

describe('@agent/core compat boundary', () => {
  it('keeps packages/core/src implementation files off flat compat entrypoints', () => {
    const implementationFiles = collectTypeScriptFiles(srcRoot).filter(filePath => !filePath.endsWith('/index.ts'));
    const violations: string[] = [];

    for (const filePath of implementationFiles) {
      const source = readFileSync(filePath, 'utf8');

      for (const pattern of compatImportPatterns) {
        if (pattern.test(source)) {
          violations.push(path.relative(packageRoot, filePath));
          break;
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps the root index pointed at migrated domain hosts instead of compat entrypoints', () => {
    const rootIndexSource = readFileSync(path.join(srcRoot, 'index.ts'), 'utf8');

    expect(rootIndexSource).not.toMatch(/export \* from '\.\/spec\/platform-console';/);
    expect(rootIndexSource).not.toMatch(/export \* from '\.\/spec\/architecture-records';/);
    expect(rootIndexSource).not.toMatch(/export \* from '\.\/types\/workflow-route';/);
    expect(rootIndexSource).not.toMatch(/export \* from '\.\/spec\/skills';/);
    expect(rootIndexSource).not.toMatch(/export \* from '\.\/types\/skills';/);
  });
});
