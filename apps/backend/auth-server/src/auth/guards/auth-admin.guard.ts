import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import type { AuthenticatedRequest } from '../auth.guard';
import { AuthServiceError } from '../auth.errors';

@Injectable()
export class AuthAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const roles = request.user?.roles ?? [];
    if (roles.includes('super_admin') || roles.includes('admin')) {
      return true;
    }

    throw new AuthServiceError('insufficient_role', '需要管理员权限');
  }
}
