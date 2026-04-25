import { describe, expect, it } from 'vitest';

import AdminPage from '../app/admin/page.js';
import { AdminAuthGate } from '../src/admin/admin-auth-gate.js';

describe('admin page auth gate', () => {
  it('wraps the dashboard shell in the browser token gate', async () => {
    const element = await AdminPage();

    expect(element.type).toBe(AdminAuthGate);
  });
});
