import { z } from 'zod';

export const AuthGlobalRoleSchema = z.enum(['super_admin', 'admin', 'developer', 'knowledge_user']);

export const AuthUserStatusSchema = z.enum(['enabled', 'disabled']);

export const AuthAccountSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  displayName: z.string().min(1),
  roles: z.array(AuthGlobalRoleSchema).min(1),
  status: AuthUserStatusSchema
});

export const AuthSessionSchema = z.object({
  id: z.string().min(1),
  expiresAt: z.string().datetime()
});

export const AuthTokenPairSchema = z.object({
  tokenType: z.literal('Bearer'),
  accessToken: z.string().min(1),
  accessTokenExpiresAt: z.string().datetime(),
  refreshToken: z.string().min(1),
  refreshTokenExpiresAt: z.string().datetime()
});

export const AuthLoginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  remember: z.boolean().optional().default(false)
});

export const AuthLoginResponseSchema = z.object({
  account: AuthAccountSchema,
  session: AuthSessionSchema,
  tokens: AuthTokenPairSchema
});

export const AuthRefreshRequestSchema = z.object({
  refreshToken: z.string().min(1)
});

export const AuthRefreshResponseSchema = z.object({
  tokens: AuthTokenPairSchema
});

export const AuthLogoutRequestSchema = z.object({
  refreshToken: z.string().min(1)
});

export const AuthMeResponseSchema = z.object({
  account: AuthAccountSchema
});

export const AuthUserCreateRequestSchema = z.object({
  username: z.string().min(1),
  displayName: z.string().min(1),
  password: z.string().min(8),
  roles: z.array(AuthGlobalRoleSchema).min(1)
});

export const AuthUserUpdateRequestSchema = z.object({
  displayName: z.string().min(1).optional(),
  roles: z.array(AuthGlobalRoleSchema).min(1).optional()
});

export const AuthResetPasswordRequestSchema = z.object({
  password: z.string().min(8),
  mustChangePassword: z.boolean().optional().default(true)
});

export const AuthUsersListResponseSchema = z.object({
  users: z.array(AuthAccountSchema)
});

export const AuthErrorCodeSchema = z.enum([
  'invalid_request',
  'invalid_credentials',
  'account_disabled',
  'access_token_missing',
  'access_token_expired',
  'access_token_invalid',
  'refresh_token_missing',
  'refresh_token_expired',
  'refresh_token_invalid',
  'refresh_token_reused',
  'session_revoked',
  'insufficient_role',
  'internal_error'
]);

export const AuthErrorResponseSchema = z.object({
  error: z.object({
    code: AuthErrorCodeSchema,
    message: z.string().min(1),
    requestId: z.string().min(1)
  })
});
