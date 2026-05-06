import type { ID, ISODateTime } from './common';

export type WorkspaceRole = 'owner' | 'admin' | 'maintainer' | 'evaluator' | 'viewer';

export interface CurrentUser {
  id: ID;
  email: string;
  name?: string;
  avatarUrl?: string;
  currentWorkspaceId?: ID;
  roles: WorkspaceRole[];
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshExpiresIn: number;
  accessTokenExpiresAt?: ISODateTime;
  refreshTokenExpiresAt?: ISODateTime;
}

export interface LoginRequest {
  email: string;
  username?: string;
  password: string;
  remember?: boolean;
}

export interface LoginResponse {
  user: CurrentUser;
  tokens: AuthTokens;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  tokens: AuthTokens;
}

export interface MeResponse {
  user: CurrentUser;
}
