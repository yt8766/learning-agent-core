import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { REQUIRE_PERMISSION_METADATA } from '../../../src/infrastructure/auth/decorators/require-permission.decorator';
import { PermissionGuard } from '../../../src/infrastructure/auth/guards/permission.guard';
import { principalHasPermission } from '../../../src/infrastructure/auth/permission-evaluator';
import { ZodValidationPipe } from '../../../src/shared/pipes/zod-validation.pipe';

function createContext(principal?: { permissions: string[] }) {
  const handler = () => undefined;
  Reflect.defineMetadata(REQUIRE_PERMISSION_METADATA, ['platform:write'], handler);

  return {
    getHandler: () => handler,
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => ({ principal })
    })
  } as never;
}

describe('PermissionGuard', () => {
  it('rejects missing principals', () => {
    const guard = new PermissionGuard(new Reflector());

    expect(() => guard.canActivate(createContext())).toThrow(UnauthorizedException);
  });

  it('rejects principals without the required permission', () => {
    const guard = new PermissionGuard(new Reflector());

    expect(() => guard.canActivate(createContext({ permissions: ['platform:read'] }))).toThrow(ForbiddenException);
  });

  it('allows principals with the required permission', () => {
    const guard = new PermissionGuard(new Reflector());

    expect(guard.canActivate(createContext({ permissions: ['platform:write'] }))).toBe(true);
  });

  it('allows domain and global wildcard permissions', () => {
    const principal = { userId: 'u1', roles: [], authSource: 'identity' as const };

    expect(principalHasPermission({ ...principal, permissions: ['platform:*'] }, 'platform:write')).toBe(true);
    expect(principalHasPermission({ ...principal, permissions: ['*:*'] }, 'knowledge:write')).toBe(true);
  });
});

describe('ZodValidationPipe', () => {
  it('returns parsed data and reports schema issues as bad requests', () => {
    const pipe = new ZodValidationPipe(z.object({ name: z.string().min(1) }));

    expect(pipe.transform({ name: 'agent' })).toEqual({ name: 'agent' });
    expect(() => pipe.transform({ name: '' })).toThrow(BadRequestException);
  });
});
