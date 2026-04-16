import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getFrontendTemplate, listFrontendTemplates, resolveFrontendTemplateDir } from '../src';

function resolveMonorepoRootFromCwd(): string {
  let current = resolve(process.cwd());
  while (true) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      throw new Error('Unable to locate monorepo root from process.cwd().');
    }
    current = parent;
  }
}

const REPO_ROOT = resolveMonorepoRootFromCwd();
const BACKEND_AGENT_SERVER_CWD = join(REPO_ROOT, 'apps', 'backend', 'agent-server');

describe('@agent/templates frontend template registry', () => {
  it('lists stable frontend templates for downstream selection', () => {
    const templates = listFrontendTemplates();

    expect(templates.length).toBeGreaterThan(0);
    expect(templates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'react-ts',
          directoryName: 'react-ts'
        }),
        expect.objectContaining({
          id: 'bonus-center-data',
          directoryName: 'bonus-center-data'
        })
      ])
    );
  });

  it('resolves the react-ts template with expected entry files', () => {
    const template = getFrontendTemplate('react-ts');

    expect(template).toEqual(
      expect.objectContaining({
        id: 'react-ts',
        displayName: 'React TypeScript',
        entryFiles: expect.arrayContaining(['App.tsx', 'index.tsx', 'package.json', 'styles.css'])
      })
    );
  });

  it('resolves the actual react-ts template directory from the package', () => {
    const templateDir = resolveFrontendTemplateDir('react-ts');

    expect(templateDir).toContain('packages/templates/src/react-ts');
  });

  it('resolves the template directory even when cwd is the backend app', () => {
    const previousCwd = process.cwd();
    process.chdir(BACKEND_AGENT_SERVER_CWD);

    try {
      const templateDir = resolveFrontendTemplateDir('react-ts');
      expect(templateDir).toContain('packages/templates/src/react-ts');
    } finally {
      process.chdir(previousCwd);
    }
  });

  it('resolves the bonus-center-data structured template with page, services, types, and routes files', () => {
    const template = getFrontendTemplate('bonus-center-data');
    const templateDir = resolveFrontendTemplateDir('bonus-center-data');

    expect(template).toEqual(
      expect.objectContaining({
        id: 'bonus-center-data',
        displayName: 'Bonus Center Data Report',
        moduleDirectories: ['pages/dataDashboard/bonusCenterData/components'],
        sharedEntryFiles: expect.arrayContaining([
          'pages/dataDashboard/bonusCenterData/index.tsx',
          'pages/dataDashboard/bonusCenterData/components/Search/index.tsx',
          'services/data/bonusCenter.ts',
          'types/data/bonusCenter.ts',
          'routes.ts'
        ]),
        entryFiles: expect.arrayContaining([
          'pages/dataDashboard/bonusCenterData/index.tsx',
          'services/data/bonusCenter.ts',
          'types/data/bonusCenter.ts',
          'routes.ts'
        ])
      })
    );
    expect(templateDir).toContain('packages/templates/src/bonus-center-data');
  });

  it('keeps the react-ts template ready as a minimal runnable frontend scaffold', () => {
    const templateDir = resolveFrontendTemplateDir('react-ts');

    expect(templateDir).toContain('packages/templates/src/react-ts');
    expect(existsSync(join(templateDir!, 'App.tsx'))).toBe(true);
    expect(existsSync(join(templateDir!, 'index.tsx'))).toBe(true);
    expect(existsSync(join(templateDir!, 'styles.css'))).toBe(true);
    expect(existsSync(join(templateDir!, 'package.json'))).toBe(true);
    expect(existsSync(join(templateDir!, 'tsconfig.json'))).toBe(true);
    expect(existsSync(join(templateDir!, 'vite.config.ts'))).toBe(true);
  });
});
