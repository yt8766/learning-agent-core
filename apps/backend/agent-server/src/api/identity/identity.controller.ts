import { Body, Controller, Get, Post, Req } from '@nestjs/common';

import { IdentityAuthService } from '../../domains/identity/services/identity-auth.service';

interface IdentityRequest {
  principal?: unknown;
  headers?: Record<string, string | string[] | undefined>;
}

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
  me(@Req() request: IdentityRequest) {
    return this.identityAuthService.me(request.principal ?? readBearerToken(request.headers?.authorization));
  }
}

function readBearerToken(authorization: string | string[] | undefined): string | undefined {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  if (!value?.startsWith('Bearer ')) {
    return undefined;
  }
  return value.slice('Bearer '.length).trim() || undefined;
}
