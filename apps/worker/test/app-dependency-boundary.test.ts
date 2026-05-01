import { describe, expect, it } from 'vitest';

import { findBoundaryViolations } from '../../../scripts/check-package-boundaries.js';

describe('app dependency boundary', () => {
  it('keeps application code on public @agent package roots only', async () => {
    const violations = findBoundaryViolations(process.cwd(), { scanGroups: ['apps'] }).filter(
      violation => violation.startsWith('apps/') && !violation.startsWith('apps/worker/test/')
    );

    expect(violations).toEqual([]);
  }, 30_000);
});
