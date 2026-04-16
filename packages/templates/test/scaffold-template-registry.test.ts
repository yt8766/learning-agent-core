import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getScaffoldTemplate, listScaffoldTemplates, resolveScaffoldTemplateDir } from '../src';

describe('@agent/templates scaffold template registry', () => {
  it('lists stable scaffold templates for packages and agents', () => {
    expect(listScaffoldTemplates()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'package-lib',
          hostKind: 'package',
          directoryName: 'package-lib'
        }),
        expect.objectContaining({
          id: 'agent-basic',
          hostKind: 'agent',
          directoryName: 'agent-basic'
        })
      ])
    );
  });

  it('resolves package-lib with source and test entry files', () => {
    expect(getScaffoldTemplate('package-lib')).toEqual(
      expect.objectContaining({
        id: 'package-lib',
        entryFiles: expect.arrayContaining([
          'src/index.ts',
          'src/package.json',
          'src/schemas/__NAME__.schema.ts',
          'test/__NAME__.test.ts',
          'test/__NAME__.int-spec.ts',
          'package.json'
        ])
      })
    );
  });

  it('resolves agent-basic with graph/flow entry files', () => {
    expect(getScaffoldTemplate('agent-basic')).toEqual(
      expect.objectContaining({
        id: 'agent-basic',
        entryFiles: expect.arrayContaining([
          'src/index.ts',
          'src/graphs/__NAME__.graph.ts',
          'src/flows/__NAME__/schemas/__NAME__.schema.ts',
          'src/flows/__NAME__/prompts/__NAME__-prompt.ts',
          'test/__NAME__.test.ts',
          'test/__NAME__.int-spec.ts',
          'package.json'
        ])
      })
    );
  });

  it('keeps scaffold template directories available from the package', () => {
    const packageDir = resolveScaffoldTemplateDir('package-lib');
    const agentDir = resolveScaffoldTemplateDir('agent-basic');

    expect(packageDir).toContain('packages/templates/src/scaffold/package-lib');
    expect(agentDir).toContain('packages/templates/src/scaffold/agent-basic');
    expect(existsSync(join(packageDir!, 'src/index.ts'))).toBe(true);
    expect(existsSync(join(packageDir!, 'src/package.json'))).toBe(true);
    expect(existsSync(join(agentDir!, 'src/graphs/__NAME__.graph.ts'))).toBe(true);
    expect(existsSync(join(agentDir!, 'src/flows/__NAME__/schemas/__NAME__.schema.ts'))).toBe(true);
  });
});
