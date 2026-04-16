import { describe, expect, it } from 'vitest';

import { run__PASCAL_NAME__Graph } from '../src';

describe('__PACKAGE_NAME__ integration', () => {
  it('uses the graph as the minimal runnable loop', () => {
    const result = run__PASCAL_NAME__Graph({ goal: 'ship the first draft' });

    expect(result.output.summary).toContain('__TITLE__');
    expect(result.prompt).toContain('ship the first draft');
  });
});
