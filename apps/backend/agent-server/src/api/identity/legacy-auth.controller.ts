import { Body, Controller, Post } from '@nestjs/common';

import { IdentityAuthService } from '../../domains/identity/services/identity-auth.service';

@Controller('auth')
export class LegacyAuthController {
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
}
