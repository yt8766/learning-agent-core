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
          directoryName: 'starters/react-ts'
        })
      ])
    );
    expect(templates).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ directoryName: expect.stringMatching(/^reports\//) })])
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
    expect(template?.defaultBaseDir).toBe('artifacts/report-kit/data-report');
    expect(JSON.stringify(template)).not.toContain('data/generated');
  });

  it('resolves the actual react-ts template directory from the package', () => {
    const templateDir = resolveFrontendTemplateDir('react-ts');

    expect(templateDir).toContain('packages/templates/src/starters/react-ts');
  });

  it('resolves the template directory even when cwd is the backend app', () => {
    const previousCwd = process.cwd();
    process.chdir(BACKEND_AGENT_SERVER_CWD);

    try {
      const templateDir = resolveFrontendTemplateDir('react-ts');
      expect(templateDir).toContain('packages/templates/src/starters/react-ts');
    } finally {
      process.chdir(previousCwd);
    }
  });

  it('does not expose report blueprints from the templates package root', () => {
    expect(getFrontendTemplate('bonus-center-data')).toBeUndefined();
    expect(getFrontendTemplate('single-report-table')).toBeUndefined();
    expect(resolveFrontendTemplateDir('bonus-center-data')).toBeUndefined();
    expect(resolveFrontendTemplateDir('single-report-table')).toBeUndefined();
  });

  it('keeps the react-ts template ready as a minimal runnable frontend scaffold', () => {
    const templateDir = resolveFrontendTemplateDir('react-ts');

    expect(templateDir).toContain('packages/templates/src/starters/react-ts');
    expect(existsSync(join(templateDir!, 'App.tsx'))).toBe(true);
    expect(existsSync(join(templateDir!, 'index.tsx'))).toBe(true);
    expect(existsSync(join(templateDir!, 'styles.css'))).toBe(true);
    expect(existsSync(join(templateDir!, 'package.json'))).toBe(true);
    expect(existsSync(join(templateDir!, 'tsconfig.json'))).toBe(true);
    expect(existsSync(join(templateDir!, 'vite.config.ts'))).toBe(true);
  });
});
