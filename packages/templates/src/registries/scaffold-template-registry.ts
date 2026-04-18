import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import type { ScaffoldTemplateDefinition } from '../contracts/template-definitions';

function resolveScaffoldTemplatesRootDir(): string {
  const cwdResolved = findScaffoldTemplatesRootFrom(process.cwd());
  if (cwdResolved) {
    return cwdResolved;
  }

  const moduleDir = resolveModuleDir();
  const candidates = moduleDir
    ? [moduleDir, resolve(moduleDir, '..', 'src'), resolve(moduleDir, '..', '..', 'src')]
    : [];

  const resolved = candidates.find(candidate => existsSync(join(candidate, 'scaffolds')));
  return resolved ?? join(resolve(process.cwd()), 'packages', 'templates', 'src');
}

function findScaffoldTemplatesRootFrom(startDir: string): string | undefined {
  let currentDir = resolve(startDir);

  while (true) {
    const candidate = join(currentDir, 'packages', 'templates', 'src');
    if (existsSync(join(candidate, 'scaffolds'))) {
      return candidate;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return undefined;
    }
    currentDir = parentDir;
  }
}

function resolveModuleDir(): string | undefined {
  try {
    return __dirname;
  } catch {
    return undefined;
  }
}

const SCAFFOLD_TEMPLATES: ScaffoldTemplateDefinition[] = [
  {
    id: 'package-lib',
    hostKind: 'package',
    displayName: 'Package Library',
    description: '通用 packages/* 脚手架，默认生成 Type、Spec、Unit、Integration 四层自动化验证。',
    directoryName: 'package-lib',
    entryFiles: [
      'src/index.ts',
      'src/package.json',
      'src/schemas/__NAME__.schema.ts',
      'test/__NAME__.test.ts',
      'test/__NAME__.int-spec.ts',
      'package.json',
      'tsconfig.json',
      'tsconfig.types.json',
      'tsup.config.ts',
      'README.md'
    ]
  },
  {
    id: 'agent-basic',
    hostKind: 'agent',
    displayName: 'Agent Basic',
    description: '通用 agents/* 脚手架，默认生成 graph/flow 入口与 Type、Spec、Unit、Integration 四层验证。',
    directoryName: 'agent-basic',
    entryFiles: [
      'src/index.ts',
      'src/graphs/__NAME__.graph.ts',
      'src/flows/__NAME__/schemas/__NAME__.schema.ts',
      'src/flows/__NAME__/prompts/__NAME__-prompt.ts',
      'test/__NAME__.test.ts',
      'test/__NAME__.int-spec.ts',
      'package.json',
      'tsconfig.json',
      'tsconfig.types.json',
      'tsup.config.ts',
      'README.md'
    ]
  }
];

export function listScaffoldTemplates(): ScaffoldTemplateDefinition[] {
  return SCAFFOLD_TEMPLATES;
}

export function getScaffoldTemplate(templateId: string): ScaffoldTemplateDefinition | undefined {
  return SCAFFOLD_TEMPLATES.find(template => template.id === templateId);
}

export function resolveScaffoldTemplateDir(templateId: string) {
  const template = getScaffoldTemplate(templateId);
  if (!template) {
    return undefined;
  }
  return join(resolveScaffoldTemplatesRootDir(), 'scaffolds', template.directoryName);
}
