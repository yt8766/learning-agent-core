import { Injectable, UnauthorizedException } from '@nestjs/common';

import { createKnowledgeAccessToken, createKnowledgeRefreshToken, parseKnowledgeRefreshToken } from './knowledge-jwt';

export interface KnowledgeLoginRequest {
  email: string;
  password: string;
}

export interface KnowledgeRefreshRequest {
  refreshToken: string;
}

@Injectable()
export class KnowledgeService {
  async login(input: KnowledgeLoginRequest) {
    if (!input.email || !input.password) {
      throw new UnauthorizedException({ code: 'auth_invalid_credentials', message: 'Invalid credentials' });
    }
    const user = this.getStubUser(input.email);
    return {
      user,
      tokens: {
        accessToken: createKnowledgeAccessToken(user.id),
        refreshToken: createKnowledgeRefreshToken(user.id),
        tokenType: 'Bearer' as const,
        expiresIn: 7200,
        refreshExpiresIn: 1209600
      }
    };
  }

  async refresh(input: KnowledgeRefreshRequest) {
    const parsed = parseKnowledgeRefreshToken(input.refreshToken);
    if (!parsed) {
      throw new UnauthorizedException({ code: 'auth_refresh_token_invalid', message: 'Invalid refresh token' });
    }
    return {
      tokens: {
        accessToken: createKnowledgeAccessToken(parsed.userId, parsed.version + 1),
        refreshToken: createKnowledgeRefreshToken(parsed.userId, parsed.version + 1),
        tokenType: 'Bearer' as const,
        expiresIn: 7200,
        refreshExpiresIn: 1209600
      }
    };
  }

  async me() {
    return {
      user: this.getStubUser('dev@example.com')
    };
  }

  private getStubUser(email: string) {
    return {
      id: 'user_1',
      email,
      name: 'Knowledge User',
      currentWorkspaceId: 'ws_1',
      roles: ['owner'],
      permissions: ['knowledge:read', 'knowledge:write', 'document:upload', 'chat:write', 'eval:run', 'trace:read']
    };
  }
}
