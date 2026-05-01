import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';

import { AdminAuthGuard } from './admin-auth.guard';
import { AdminAuthService } from './admin-auth.service';
import type { AdminPrincipal } from './interfaces/admin-auth-internal.types';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  login(@Body() body: unknown) {
    return this.adminAuthService.login(body as never);
  }

  @Post('refresh')
  refresh(@Body() body: unknown) {
    return this.adminAuthService.refresh(body as never);
  }

  @Post('logout')
  logout(@Body() body: unknown) {
    return this.adminAuthService.logout(body as never, undefined);
  }

  @UseGuards(AdminAuthGuard)
  @Get('me')
  me(@Req() request: { adminPrincipal: AdminPrincipal }) {
    return this.adminAuthService.getMe(request.adminPrincipal);
  }
}
