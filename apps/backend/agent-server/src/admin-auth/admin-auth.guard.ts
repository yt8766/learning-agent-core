import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { adminAuthError } from './admin-auth.errors';
import { AdminAuthService } from './admin-auth.service';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers?.authorization;
    if (!authorization || typeof authorization !== 'string') {
      throw adminAuthError.accessTokenMissing();
    }
    const [type, token] = authorization.split(' ');
    if (type !== 'Bearer' || !token) {
      throw adminAuthError.accessTokenInvalid();
    }
    request.adminPrincipal = await this.adminAuthService.verifyAccessToken(token);
    return true;
  }
}
