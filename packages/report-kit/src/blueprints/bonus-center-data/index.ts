import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export interface BonusCenterBlueprintTemplateDefinition {
  id: 'bonus-center-data';
  displayName: string;
  description: string;
  entryFiles: string[];
  sharedEntryFiles: string[];
  moduleDirectories: string[];
  includeAllFiles: true;
  outputRoot: '';
  defaultBaseDir: 'src';
}

export const BONUS_CENTER_BLUEPRINT_TEMPLATE: BonusCenterBlueprintTemplateDefinition = {
  id: 'bonus-center-data',
  displayName: 'Bonus Center Data Report',
  description: 'report-kit 托管的 bonusCenterData 报表蓝图资产，包含 pages、services、types 以及 routes 模板。',
  entryFiles: [
    'pages/dataDashboard/bonusCenterData/index.tsx',
    'pages/dataDashboard/bonusCenterData/config.tsx',
    'pages/dataDashboard/bonusCenterData/components/Search/index.tsx',
    'services/data/bonusCenter.ts',
    'types/data/bonusCenter.ts',
    'routes.ts'
  ],
  sharedEntryFiles: [
    'pages/dataDashboard/bonusCenterData/index.tsx',
    'pages/dataDashboard/bonusCenterData/config.tsx',
    'pages/dataDashboard/bonusCenterData/components/Search/index.tsx',
    'services/data/bonusCenter.ts',
    'types/data/bonusCenter.ts',
    'routes.ts'
  ],
  moduleDirectories: ['pages/dataDashboard/bonusCenterData/components'],
  includeAllFiles: true,
  outputRoot: '',
  defaultBaseDir: 'src'
};

export function resolveBonusCenterBlueprintDir(): string {
  const cwdResolved = findBonusCenterBlueprintDirFrom(process.cwd());
  if (cwdResolved) {
    return cwdResolved;
  }

  const moduleDir = resolveModuleDir();
  const candidates = moduleDir
    ? [moduleDir, resolve(moduleDir, '..', '..', '..', 'src', 'blueprints', 'bonus-center-data')]
    : [];

  const resolved = candidates.find(isBonusCenterBlueprintDir);
  return resolved ?? join(resolve(process.cwd()), 'packages', 'report-kit', 'src', 'blueprints', 'bonus-center-data');
}

function findBonusCenterBlueprintDirFrom(startDir: string): string | undefined {
  let currentDir = resolve(startDir);

  while (true) {
    const candidate = join(currentDir, 'packages', 'report-kit', 'src', 'blueprints', 'bonus-center-data');
    if (isBonusCenterBlueprintDir(candidate)) {
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

function isBonusCenterBlueprintDir(candidate: string): boolean {
  return existsSync(join(candidate, 'routes.ts')) && existsSync(join(candidate, 'services', 'data', 'bonusCenter.ts'));
}
