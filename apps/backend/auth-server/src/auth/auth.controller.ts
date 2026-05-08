import { Body, Controller, Get, Inject, Post, Req, UseGuards } from '@nestjs/common';
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
import { AuthLocalGuard } from './guards/auth-local.guard';
import type { AuthUserRecord } from './repositories/auth.repository';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @UseGuards(AuthLocalGuard)
  @Post('login')
  login(@Body() body: unknown, @Req() request: { user: AuthUserRecord }): Promise<AuthLoginResponse> {
    const input = AuthLoginRequestSchema.parse(body);
    return this.authService.loginValidatedUser(request.user, input.remember ?? false);
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
