import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { buildAgentScaffold, buildPackageScaffold, writeScaffoldBundle } from '../../src';
import { cleanupTempWorkspaces, createTempWorkspace } from '../test-utils/temp-workspace';

describe('@agent/tools scaffold write integration', () => {
  it('writes package and agent scaffold bundles into target roots', async () => {
    const root = await createTempWorkspace('tools-scaffold-write');

    try {
      const packageRoot = `${root}/packages/learning-kit`;
      const agentRoot = `${root}/agents/support-bot`;

      const packageBundle = await buildPackageScaffold({
        name: 'learning-kit',
        mode: 'write',
        targetRoot: packageRoot
      });
      const agentBundle = await buildAgentScaffold({
        name: 'support-bot',
        mode: 'write',
        targetRoot: agentRoot
      });

      const packageWrite = await writeScaffoldBundle({ bundle: packageBundle, targetRoot: packageRoot });
      const agentWrite = await writeScaffoldBundle({ bundle: agentBundle, targetRoot: agentRoot });

      expect(packageWrite).toEqual(
        expect.objectContaining({
          targetRoot: packageRoot,
          totalWritten: packageBundle.files.length
        })
      );
      expect(agentWrite).toEqual(
        expect.objectContaining({
          targetRoot: agentRoot,
          totalWritten: agentBundle.files.length
        })
      );

      await expect(readFile(`${packageRoot}/package.json`, 'utf8')).resolves.toContain('"name": "@agent/learning-kit"');
      await expect(readFile(`${agentRoot}/package.json`, 'utf8')).resolves.toContain(
        '"name": "@agent/agents-support-bot"'
      );
    } finally {
      await cleanupTempWorkspaces([root]);
    }
  });
});
