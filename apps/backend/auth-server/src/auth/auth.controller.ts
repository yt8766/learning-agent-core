import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  AuthLoginRequestSchema,
  AuthLogoutRequestSchema,
  AuthRefreshRequestSchema,
  type AuthLoginResponse,
  type AuthMeResponse,
  type AuthRefreshResponse
} from '@agent/core';

import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: unknown): Promise<AuthLoginResponse> {
    return this.authService.login(AuthLoginRequestSchema.parse(body));
  }

  @Post('refresh')
  refresh(@Body() body: unknown): Promise<AuthRefreshResponse> {
    return this.authService.refresh(AuthRefreshRequestSchema.parse(body));
  }

  @Post('logout')
  logout(@Body() body: unknown): { success: true } {
    AuthLogoutRequestSchema.parse(body);
    return { success: true };
  }

  @Get('me')
  me(): AuthMeResponse {
    return {
      account: {
        id: 'user_demo',
        username: 'demo',
        displayName: 'Demo User',
        roles: ['developer'],
        status: 'enabled'
      }
    };
  }
}
