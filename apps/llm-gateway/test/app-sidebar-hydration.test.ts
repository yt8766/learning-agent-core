import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const appSidebarSource = resolve(import.meta.dirname, '../src/components/app-sidebar.tsx');
const uiSidebarSource = resolve(import.meta.dirname, '../src/components/ui/sidebar.tsx');

describe('llm gateway app sidebar hydration boundary', () => {
  it('keeps the Radix Slot based sidebar menu inside a client component boundary', () => {
    const source = readFileSync(appSidebarSource, 'utf8').trimStart();

    expect(source.startsWith("'use client';") || source.startsWith('"use client"')).toBe(true);
  });

  it('keeps desktop sidebar spacing compatible with Tailwind v4 CSS variables', () => {
    const source = readFileSync(uiSidebarSource, 'utf8');

    expect(source).toContain('w-[var(--sidebar-width)]');
    expect(source).toContain('w-[var(--sidebar-width-icon)]');
    expect(source).toContain('max-w-[var(--skeleton-width)]');
    expect(source).not.toContain('w-[--sidebar-width]');
    expect(source).not.toContain('w-[--sidebar-width-icon]');
    expect(source).not.toContain('max-w-[--skeleton-width]');
  });
});
