import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { buildAgentScaffold, buildPackageScaffold, inspectScaffoldTarget, listScaffoldTemplates } from '../../src';

describe('@agent/tools scaffold preview generation', () => {
  it('re-exports stable scaffold template metadata from the tool host package', () => {
    expect(listScaffoldTemplates()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'package-lib', hostKind: 'package' }),
        expect.objectContaining({ id: 'agent-basic', hostKind: 'agent' })
      ])
    );
  });

  it('builds a package scaffold preview with type/spec/unit/integration files', async () => {
    const bundle = await buildPackageScaffold({
      name: 'learning-kit',
      mode: 'preview'
    });

    expect(bundle).toMatchObject({
      hostKind: 'package',
      name: 'learning-kit',
      packageName: '@agent/learning-kit',
      templateId: 'package-lib',
      mode: 'preview'
    });
    expect(bundle.files.map(file => file.path)).toEqual(
      expect.arrayContaining([
        'src/index.ts',
        'src/package.json',
        'src/schemas/learning-kit.schema.ts',
        'test/learning-kit.test.ts',
        'test/learning-kit.int-spec.ts',
        'package.json',
        'README.md'
      ])
    );

    const packageJson = bundle.files.find(file => file.path === 'package.json')?.content ?? '';
    const sourceEntry = bundle.files.find(file => file.path === 'src/index.ts')?.content ?? '';
    const tsconfigJson = bundle.files.find(file => file.path === 'tsconfig.json')?.content ?? '';

    expect(packageJson).toContain('"name": "@agent/learning-kit"');
    expect(packageJson).toContain('"test:spec": "node');
    expect(packageJson).toContain('"test:integration": "node');
    expect(packageJson).not.toContain('"demo":');
    expect(packageJson).toContain(
      '"verify": "pnpm typecheck && pnpm test:spec && pnpm test && pnpm test:integration && pnpm build:lib"'
    );
    expect(sourceEntry).toContain('./schemas/learning-kit.schema.ts');
    expect(tsconfigJson).toContain('node_modules/zod');
    expect(tsconfigJson).not.toContain('.pnpm/zod@');
  });

  it('builds an agent scaffold preview with graph/flow validation files and no demo directory', async () => {
    const bundle = await buildAgentScaffold({
      name: 'support-bot',
      mode: 'preview'
    });

    expect(bundle).toMatchObject({
      hostKind: 'agent',
      name: 'support-bot',
      packageName: '@agent/agents-support-bot',
      templateId: 'agent-basic',
      mode: 'preview'
    });
    expect(bundle.files.map(file => file.path)).toEqual(
      expect.arrayContaining([
        'src/index.ts',
        'src/graphs/support-bot.graph.ts',
        'src/flows/support-bot/schemas/support-bot.schema.ts',
        'src/flows/support-bot/prompts/support-bot-prompt.ts',
        'test/support-bot.test.ts',
        'test/support-bot.int-spec.ts',
        'package.json',
        'README.md'
      ])
    );
    expect(bundle.files.map(file => file.path).some(path => path.startsWith('demo/'))).toBe(false);

    const packageJson = bundle.files.find(file => file.path === 'package.json')?.content ?? '';
    expect(packageJson).toContain('"name": "@agent/agents-support-bot"');
    expect(packageJson).toContain('"test:spec": "node');
    expect(packageJson).not.toContain('"demo":');
    expect(packageJson).toContain(
      '"verify": "pnpm typecheck && pnpm test:spec && pnpm test && pnpm test:integration && pnpm build:lib"'
    );
  });

  it('inspects empty and conflicting target roots without mutating scaffold output', async () => {
    const bundle = await buildPackageScaffold({
      name: 'inspection-kit',
      mode: 'write'
    });
    const root = await mkdtemp(join(tmpdir(), 'scaffold-tools-inspect-'));
    const emptyTarget = join(root, 'packages', 'inspection-kit');
    const conflictingTarget = join(root, 'packages', 'existing-kit');

    const emptyInspection = await inspectScaffoldTarget({
      bundle,
      targetRoot: emptyTarget
    });

    await mkdir(join(conflictingTarget, 'src'), { recursive: true });
    await writeFile(join(conflictingTarget, 'src', 'index.ts'), 'export const existing = true;\n', 'utf8');
    await writeFile(join(conflictingTarget, 'README.md'), '# existing\n', 'utf8');

    const conflictingInspection = await inspectScaffoldTarget({
      bundle,
      targetRoot: conflictingTarget
    });

    expect(emptyInspection).toEqual(
      expect.objectContaining({
        isEmpty: true,
        canWriteSafely: true,
        conflictingFiles: []
      })
    );
    expect(conflictingInspection).toEqual(
      expect.objectContaining({
        isEmpty: false,
        canWriteSafely: false,
        conflictingFiles: expect.arrayContaining(['src/index.ts', 'README.md'])
      })
    );
  });
});
