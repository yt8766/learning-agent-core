import { Injectable } from '@nestjs/common';

import {
  IdentityLoginRequestSchema,
  IdentityLogoutRequestSchema,
  IdentityRefreshRequestSchema
} from '../schemas/identity-auth.schemas';

@Injectable()
export class IdentityAuthService {
  async login(body: unknown) {
    const input = IdentityLoginRequestSchema.parse(body);
    return {
      tokenType: 'Bearer' as const,
      accessToken: `dev-access-${input.username}`,
      refreshToken: `dev-refresh-${input.username}`,
      expiresIn: 3600
    };
  }

  async refresh(body: unknown) {
    const input = IdentityRefreshRequestSchema.parse(body);
    return {
      tokenType: 'Bearer' as const,
      accessToken: `dev-access-refresh-${input.refreshToken.slice(0, 8)}`,
      refreshToken: input.refreshToken,
      expiresIn: 3600
    };
  }

  async logout(body: unknown) {
    IdentityLogoutRequestSchema.parse(body ?? {});
    return { ok: true };
  }

  async me(principal: unknown) {
    return { principal };
  }
}
