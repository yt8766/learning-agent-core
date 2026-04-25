import { describe, expect, it } from 'vitest';

import { createPostgresAdminAuthRepositoryForClient } from '../src/repositories/postgres-admin-auth.js';
import type { AdminCredential, AdminPrincipal } from '../src/contracts/admin-auth.js';

type QueryCall = { text: string; values?: unknown[] };

class FakePgClient {
  readonly calls: QueryCall[] = [];
  private principalRow: Record<string, unknown> | null = null;
  private credentialRow: Record<string, unknown> | null = null;

  async query(text: string, values?: unknown[]) {
    this.calls.push({ text, values });

    if (text.includes('select * from admin_principals') && text.includes('role =')) {
      return { rows: this.principalRow ? [this.principalRow] : [] };
    }

    if (text.includes('select * from admin_principals') && text.includes('id =')) {
      return { rows: this.principalRow && this.principalRow.id === values?.[0] ? [this.principalRow] : [] };
    }

    if (text.includes('insert into admin_principals')) {
      this.principalRow = {
        id: values?.[0],
        role: values?.[1],
        display_name: values?.[2],
        status: values?.[3],
        access_token_version: values?.[4],
        refresh_token_version: values?.[5],
        created_at: values?.[6],
        updated_at: values?.[7],
        last_login_at: values?.[8]
      };
      return { rows: [] };
    }

    if (text.includes('select * from admin_credentials')) {
      return {
        rows: this.credentialRow && this.credentialRow.principal_id === values?.[0] ? [this.credentialRow] : []
      };
    }

    if (text.includes('insert into admin_credentials')) {
      this.credentialRow = {
        id: values?.[0],
        principal_id: values?.[1],
        kind: values?.[2],
        password_hash: values?.[3],
        password_updated_at: values?.[4],
        created_at: values?.[5],
        updated_at: values?.[6]
      };
      return { rows: [] };
    }

    return { rows: [] };
  }
}

const principal: AdminPrincipal = {
  id: 'owner',
  role: 'owner',
  displayName: 'Owner',
  status: 'active',
  accessTokenVersion: 1,
  refreshTokenVersion: 1,
  createdAt: '2026-04-25T00:00:00.000Z',
  updatedAt: '2026-04-25T00:00:00.000Z',
  lastLoginAt: null
};

const credential: AdminCredential = {
  id: 'cred-owner',
  principalId: 'owner',
  kind: 'password',
  passwordHash: 'hash',
  passwordUpdatedAt: '2026-04-25T00:00:00.000Z',
  createdAt: '2026-04-25T00:00:00.000Z',
  updatedAt: '2026-04-25T00:00:00.000Z'
};

describe('postgres admin auth repository', () => {
  it('ensures schema and maps owner principal and password credential rows', async () => {
    const client = new FakePgClient();
    const repository = createPostgresAdminAuthRepositoryForClient(client);

    await repository.savePrincipal(principal);
    await repository.saveCredential(credential);

    await expect(repository.findOwnerPrincipal()).resolves.toEqual(principal);
    await expect(repository.findPrincipalById('owner')).resolves.toEqual(principal);
    await expect(repository.findPasswordCredential('owner')).resolves.toEqual(credential);
    expect(client.calls.some(call => call.text.includes('create table if not exists admin_principals'))).toBe(true);
    expect(client.calls.some(call => call.text.includes('create table if not exists admin_credentials'))).toBe(true);
    expect(client.calls.every(call => !call.text.includes('admin_sessions'))).toBe(true);
  });
});
