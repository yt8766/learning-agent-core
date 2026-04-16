import { describe, expect, it } from 'vitest';
import { create__PASCAL_NAME__ } from '../src/index.ts';

describe('__PACKAGE_NAME__ integration', () => {
  it('parses a minimal happy-path record end to end', () => {
    expect(
      create__PASCAL_NAME__({
        id: 'demo-id',
        label: '__TITLE__'
      })
    ).toEqual({
      id: 'demo-id',
      label: '__TITLE__'
    });
  });
});
