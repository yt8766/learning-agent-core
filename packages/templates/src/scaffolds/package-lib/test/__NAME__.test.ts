import { describe, expect, it } from 'vitest';

import { __CAMEL_NAME__Schema, create__PASCAL_NAME__ } from '../src';

describe('__PACKAGE_NAME__ unit', () => {
  it('parses valid records through the shared schema', () => {
    expect(create__PASCAL_NAME__({ id: '__NAME__-1', label: '__TITLE__' })).toEqual({
      id: '__NAME__-1',
      label: '__TITLE__'
    });
  });

  it('rejects empty labels at runtime', () => {
    expect(() => __CAMEL_NAME__Schema.parse({ id: '__NAME__-1', label: '' })).toThrow();
  });
});
