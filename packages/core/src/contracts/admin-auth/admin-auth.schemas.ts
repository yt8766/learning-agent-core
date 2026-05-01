import { z } from 'zod';

export const AdminRoleSchema = z.enum(['super_admin', 'developer']);

export const AdminAccountStatusSchema = z.enum(['enabled', 'disabled', 'locked']);

export const AdminAccountSchema = z.object({
  id: z.string().min(1),
  username: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/),
  displayName: z.string().min(1).max(64),
  roles: z.array(AdminRoleSchema).min(1),
  status: AdminAccountStatusSchema,
  lastLoginAt: z.string().datetime().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional()
});

export const AdminTokenPairSchema = z.object({
  tokenType: z.literal('Bearer'),
  accessToken: z.string().min(1),
  accessTokenExpiresAt: z.string().datetime(),
  refreshToken: z.string().min(1),
  refreshTokenExpiresAt: z.string().datetime()
});

export const AdminLoginRequestSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(8).max(128),
  remember: z.boolean().optional()
});

export const AdminLoginResponseSchema = z.object({
  account: AdminAccountSchema,
  session: z.object({
    id: z.string().min(1),
    expiresAt: z.string().datetime()
  }),
  tokens: AdminTokenPairSchema
});

export const AdminRefreshRequestSchema = z.object({
  refreshToken: z.string().min(1).optional()
});

export const AdminRefreshResponseSchema = z.object({
  tokens: AdminTokenPairSchema
});

export const AdminLogoutRequestSchema = z.object({
  refreshToken: z.string().min(1).optional()
});

export const AdminLogoutResponseSchema = z.object({
  success: z.literal(true)
});

export const AdminMeResponseSchema = z.object({
  account: AdminAccountSchema
});

export const AdminAuthErrorCodeSchema = z.enum([
  'invalid_request',
  'invalid_credentials',
  'account_disabled',
  'account_locked',
  'access_token_missing',
  'access_token_expired',
  'access_token_invalid',
  'refresh_token_missing',
  'refresh_token_expired',
  'refresh_token_invalid',
  'session_revoked',
  'insufficient_role',
  'internal_error'
]);

export const AdminAuthErrorResponseSchema = z.object({
  error: z.object({
    code: AdminAuthErrorCodeSchema,
    message: z.string().min(1),
    requestId: z.string().min(1).optional()
  })
});
