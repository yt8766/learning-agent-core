import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '../../..');

const CODE_FILES = [
  'scripts/typecheck.js',
  'scripts/check-staged.js',
  'scripts/check-package-boundaries.js',
  'apps/backend/agent-server/src/runtime/architecture/project-architecture.registry.ts',
  'apps/backend/agent-server/test/runtime/architecture/runtime-architecture.service.spec.ts',
  'apps/frontend/agent-admin/test/features/runtime-overview/components/architecture-mermaid-card.test.tsx',
  'apps/frontend/agent-admin/test/features/runtime-overview/components/runtime-architecture-panel.test.tsx',
  'packages/tools/test/approval-service.test.ts'
];

describe('agent-core package removal', () => {
  it('keeps repository runtime references off the retired agent-core package', async () => {
    const violations: string[] = [];

    for (const relativePath of CODE_FILES) {
      const source = await readFile(path.join(ROOT, relativePath), 'utf8');
      if (source.includes('@agent/agent-core') || source.includes('packages/agent-core/')) {
        violations.push(relativePath);
      }
    }

    expect(violations).toEqual([]);
  });
});
