import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { buildPackageScaffold, writeScaffoldBundle } from '../src/index.js';

async function main() {
  const root = await mkdtemp(join(tmpdir(), 'tools-demo-'));

  try {
    const targetRoot = join(root, 'packages', 'demo-kit');
    const bundle = await buildPackageScaffold({
      name: 'demo-kit',
      mode: 'write',
      targetRoot
    });
    const writeResult = await writeScaffoldBundle({ bundle, targetRoot });
    const packageJson = await readFile(join(targetRoot, 'package.json'), 'utf8');

    console.log(
      JSON.stringify(
        {
          totalWritten: writeResult.totalWritten,
          targetRoot: writeResult.targetRoot,
          packageName: JSON.parse(packageJson).name
        },
        null,
        2
      )
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

void main();
