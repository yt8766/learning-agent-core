import { Body, Controller, Get, Post, Req } from '@nestjs/common';

import { IdentityAuthService } from '../../domains/identity/services/identity-auth.service';

@Controller('identity')
export class IdentityController {
  constructor(private readonly identityAuthService: IdentityAuthService) {}

  @Post('login')
  login(@Body() body: unknown) {
    return this.identityAuthService.login(body);
  }

  @Post('refresh')
  refresh(@Body() body: unknown) {
    return this.identityAuthService.refresh(body);
  }

  @Post('logout')
  logout(@Body() body: unknown) {
    return this.identityAuthService.logout(body);
  }

  @Get('me')
  me(@Req() request: { principal?: unknown }) {
    return this.identityAuthService.me(request.principal);
  }
}
