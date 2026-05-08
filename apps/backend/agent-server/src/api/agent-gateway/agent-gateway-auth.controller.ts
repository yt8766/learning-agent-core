import { BadRequestException, Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { GatewayLoginRequestSchema, GatewayRefreshRequestSchema } from '@agent/core';
import type { GatewayLoginResponse, GatewayRefreshResponse } from '@agent/core';
import {
  AgentGatewayAuthError,
  AgentGatewayAuthService
} from '../../domains/agent-gateway/auth/agent-gateway-auth.service';
@Controller('agent-gateway/auth')
export class AgentGatewayAuthController {
  constructor(private readonly authService: AgentGatewayAuthService) {}
  @Post('login') login(@Body() body: unknown): GatewayLoginResponse {
    const parsed = GatewayLoginRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: '登录参数无效' });
    return this.map(() => this.authService.login(parsed.data));
  }
  @Post('refresh') refresh(@Body() body: unknown): GatewayRefreshResponse {
    const parsed = GatewayRefreshRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: '刷新参数无效' });
    return this.map(() => this.authService.refresh(parsed.data.refreshToken));
  }
  private map<T>(runner: () => T): T {
    try {
      return runner();
    } catch (error) {
      if (error instanceof AgentGatewayAuthError)
        throw new UnauthorizedException({ code: error.code, message: error.message });
      throw error;
    }
  }
}
