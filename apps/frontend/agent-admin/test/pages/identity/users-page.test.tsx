import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { UsersPage } from '../../../src/pages/identity/pages/users-page';

describe('UsersPage', () => {
  it('renders unified identity users', () => {
    const html = renderToStaticMarkup(
      <UsersPage
        initialUsers={[
          {
            id: 'user_1',
            username: 'admin',
            displayName: 'Admin',
            roles: ['admin'],
            status: 'enabled'
          }
        ]}
        client={{
          listUsers: async () => ({ users: [] })
        }}
      />
    );

    expect(html).toContain('Admin');
    expect(html).toContain('admin');
    expect(html).toContain('用户管理');
  });
});
