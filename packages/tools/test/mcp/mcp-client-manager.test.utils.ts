import { expect } from 'vitest';

export function expectDefined<T>(value: T | undefined, label: string): T {
  expect(value, `${label} should be defined`).toBeDefined();
  return value as T;
}
