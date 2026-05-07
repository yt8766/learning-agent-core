import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { REQUIRE_PERMISSION_METADATA } from '../decorators/require-permission.decorator';
import { principalHasPermission, type BackendPrincipal } from '../permission-evaluator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRE_PERMISSION_METADATA, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!required?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ principal?: BackendPrincipal }>();
    if (!request.principal) {
      throw new UnauthorizedException('identity access token is required');
    }

    const missing = required.filter(permission => !principalHasPermission(request.principal!, permission));
    if (missing.length > 0) {
      throw new ForbiddenException(`missing permissions: ${missing.join(', ')}`);
    }

    return true;
  }
}
