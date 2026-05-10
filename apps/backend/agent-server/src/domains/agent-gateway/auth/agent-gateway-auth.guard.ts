import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthAccount, GatewaySession, GatewayUser } from '@agent/core';
import { IdentityServiceError } from '../../identity/services/identity-service.error';
import { IdentityAuthService } from '../../identity/services/identity-auth.service';
export interface AgentGatewayAuthenticatedRequest extends Request {
  gatewaySession: GatewaySession;
}
@Injectable()
export class AgentGatewayAuthGuard implements CanActivate {
  constructor(private readonly identityAuthService: IdentityAuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AgentGatewayAuthenticatedRequest>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
    if (!token) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: '缺少访问令牌' });
    try {
      const current = await this.identityAuthService.getCurrentUser(token);
      request.gatewaySession = {
        user: toGatewayUser(current.account),
        issuedAt: new Date().toISOString()
      };
      return true;
    } catch (error) {
      if (error instanceof IdentityServiceError)
        throw new UnauthorizedException({ code: mapIdentityErrorCode(error.code), message: error.message });
      throw error;
    }
  }
}

function toGatewayUser(account: AuthAccount): GatewayUser {
  return {
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    role: toGatewayRole(account.roles)
  };
}

function toGatewayRole(roles: AuthAccount['roles']): GatewayUser['role'] {
  if (roles.includes('super_admin') || roles.includes('admin')) return 'admin';
  if (roles.includes('developer')) return 'operator';
  return 'viewer';
}

function mapIdentityErrorCode(code: IdentityServiceError['code']): string {
  if (code === 'access_token_expired') return 'ACCESS_TOKEN_EXPIRED';
  if (code === 'insufficient_role') return 'FORBIDDEN';
  return 'UNAUTHENTICATED';
}
