import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { ParseOptionalIntPipe } from '../../../src/common/pipes/parse-optional-int.pipe';

describe('ParseOptionalIntPipe', () => {
  it('returns undefined for missing optional values', () => {
    expect(new ParseOptionalIntPipe().transform(undefined)).toBeUndefined();
    expect(new ParseOptionalIntPipe().transform('')).toBeUndefined();
  });

  it('parses integer strings', () => {
    const pipe = new ParseOptionalIntPipe();

    expect(pipe.transform('42')).toBe(42);
    expect(pipe.transform('0')).toBe(0);
    expect(pipe.transform('-1')).toBe(-1);
    expect(pipe.transform('999')).toBe(999);
  });

  it('rejects non-numeric strings with BadRequestException', () => {
    const pipe = new ParseOptionalIntPipe();

    expect(() => pipe.transform('abc')).toThrow(BadRequestException);
    expect(() => pipe.transform('NaN')).toThrow(BadRequestException);
    expect(() => pipe.transform('!@#')).toThrow(BadRequestException);
  });

  it('truncates decimal strings like parseInt does', () => {
    const pipe = new ParseOptionalIntPipe();

    // parseInt('4.2', 10) === 4, so this does NOT throw
    expect(pipe.transform('4.2')).toBe(4);
  });
});
