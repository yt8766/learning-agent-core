import { describe, expect, it } from 'vitest';

import { PAGE_TITLES } from '../../../apps/frontend/agent-admin/src/hooks/use-admin-dashboard';
import type { DashboardPageKey } from '../../../apps/frontend/agent-admin/src/types/admin';

describe('agent-admin dashboard smoke', () => {
  it('keeps the six governance centers addressable from the admin dashboard contract', () => {
    const requiredCenters: DashboardPageKey[] = [
      'runtime',
      'approvals',
      'learning',
      'skills',
      'evidence',
      'connectors'
    ];

    for (const page of requiredCenters) {
      expect(PAGE_TITLES[page]).toEqual(expect.any(String));
      expect(PAGE_TITLES[page].length).toBeGreaterThan(0);
    }
    expect(new Set(requiredCenters.map(page => PAGE_TITLES[page])).size).toBe(requiredCenters.length);
  });
});
