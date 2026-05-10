import { describe, expect, it, vi } from 'vitest';
import { PATH_METADATA } from '@nestjs/common/constants';

import { IdentityUsersController } from '../../src/api/identity/identity-users.controller';

describe('identity users controller', () => {
  const createService = () => ({
    listUsers: vi.fn(async () => ({ users: [{ id: 'user_1', username: 'admin' }] })),
    createUser: vi.fn(async (body: unknown) => ({ id: 'user_2', ...(body as object) })),
    disableUser: vi.fn(async (userId: string) => ({ id: userId, status: 'disabled' })),
    enableUser: vi.fn(async (userId: string) => ({ id: userId, status: 'enabled' }))
  });

  it('mounts under the canonical identity users prefix', () => {
    expect(Reflect.getMetadata(PATH_METADATA, IdentityUsersController)).toBe('identity/users');
  });

  it('delegates user management operations to the identity user service', async () => {
    const service = createService();
    const controller = new IdentityUsersController(service as never);

    await expect(controller.listUsers()).resolves.toMatchObject({ users: [{ id: 'user_1' }] });
    await expect(controller.createUser({ username: 'editor' })).resolves.toMatchObject({ id: 'user_2' });
    await expect(controller.disableUser('user_1')).resolves.toMatchObject({ status: 'disabled' });
    await expect(controller.enableUser('user_1')).resolves.toMatchObject({ status: 'enabled' });

    expect(service.listUsers).toHaveBeenCalledTimes(1);
    expect(service.createUser).toHaveBeenCalledWith({ username: 'editor' });
    expect(service.disableUser).toHaveBeenCalledWith('user_1');
    expect(service.enableUser).toHaveBeenCalledWith('user_1');
  });
});
