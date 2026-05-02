import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  AuthLoginRequestSchema,
  AuthLogoutRequestSchema,
  AuthRefreshRequestSchema,
  type AuthLoginResponse,
  type AuthMeResponse,
  type AuthRefreshResponse
} from '@agent/core';

import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { AuthUser } from './decorators/auth-user.decorator';
import type { AuthJwtPayload } from './jwt.provider';

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
  logout(@Body() body: unknown): Promise<{ success: true }> {
    return this.authService.logout(AuthLogoutRequestSchema.parse(body));
  }

  @UseGuards(AuthGuard)
  @Get('me')
  me(@AuthUser() user: AuthJwtPayload): Promise<AuthMeResponse> {
    return this.authService.getCurrentUserFromPayload(user);
  }
}
