import { useEffect, useState } from 'react';
import type { AuthAccount, AuthUsersListResponse } from '@agent/core';

export interface UsersPageClient {
  listUsers(): Promise<AuthUsersListResponse>;
}

export function UsersPage({ client, initialUsers = [] }: { client: UsersPageClient; initialUsers?: AuthAccount[] }) {
  const [users, setUsers] = useState<AuthAccount[]>(initialUsers);

  useEffect(() => {
    void client.listUsers().then(result => setUsers(result.users));
  }, [client]);

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">用户管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">统一登录账号由 agent-server Identity 域管理。</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border bg-background">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted/60 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">显示名</th>
              <th className="px-4 py-3 font-medium">账号</th>
              <th className="px-4 py-3 font-medium">角色</th>
              <th className="px-4 py-3 font-medium">状态</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr className="border-t" key={user.id}>
                <td className="px-4 py-3">{user.displayName}</td>
                <td className="px-4 py-3">{user.username}</td>
                <td className="px-4 py-3">{user.roles.join(', ')}</td>
                <td className="px-4 py-3">{user.status === 'enabled' ? '启用' : '禁用'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
