import { describe, expect, it } from 'vitest';

import { run__PASCAL_NAME__Graph } from '../src';

describe('__PACKAGE_NAME__ unit', () => {
  it('builds a validated graph result', () => {
    const result = run__PASCAL_NAME__Graph({ goal: 'draft a response' });

    expect(result.output.nextAction).toBe('review-generated-plan');
    expect(result.prompt).toContain('draft a response');
  });
});
