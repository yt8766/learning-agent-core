import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { GatewaySession } from '@agent/core';
import { AgentGatewayAuthError, AgentGatewayAuthService } from './agent-gateway-auth.service';
export interface AgentGatewayAuthenticatedRequest extends Request {
  gatewaySession: GatewaySession;
}
@Injectable()
export class AgentGatewayAuthGuard implements CanActivate {
  constructor(private readonly authService: AgentGatewayAuthService) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AgentGatewayAuthenticatedRequest>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
    if (!token) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: '缺少访问令牌' });
    try {
      request.gatewaySession = this.authService.verifyAccessToken(token);
      return true;
    } catch (error) {
      if (error instanceof AgentGatewayAuthError)
        throw new UnauthorizedException({ code: error.code, message: error.message });
      throw error;
    }
  }
}
