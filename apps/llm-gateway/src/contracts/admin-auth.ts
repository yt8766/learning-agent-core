import { z } from 'zod';

export const AdminPrincipalSchema = z.object({
  id: z.string().min(1),
  role: z.literal('owner'),
  displayName: z.string().min(1),
  status: z.enum(['active', 'disabled']),
  accessTokenVersion: z.number().int().nonnegative(),
  refreshTokenVersion: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastLoginAt: z.string().datetime().nullable()
});

export const AdminCredentialSchema = z.object({
  id: z.string().min(1),
  principalId: z.string().min(1),
  kind: z.literal('password'),
  passwordHash: z.string().min(1),
  passwordUpdatedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const AdminAuthTokenPairSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  accessTokenExpiresAt: z.string().datetime(),
  refreshTokenExpiresAt: z.string().datetime(),
  principal: AdminPrincipalSchema
});

export const AdminAuthLoginRequestSchema = z.object({
  password: z.string().min(1)
});

export const AdminAuthRefreshRequestSchema = z.object({
  refreshToken: z.string().min(1)
});

export const AdminAuthChangePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12)
});

export const AdminAuthLogoutResponseSchema = z.object({
  ok: z.literal(true)
});

export const AdminAuthErrorCodeSchema = z.enum([
  'admin_auth_bad_request',
  'admin_auth_not_configured',
  'admin_login_invalid_password',
  'admin_current_password_invalid',
  'admin_new_password_weak',
  'admin_principal_disabled',
  'admin_access_token_missing',
  'admin_access_token_invalid',
  'admin_access_token_expired',
  'admin_refresh_token_invalid',
  'admin_refresh_token_expired'
]);

export const AdminAuthErrorResponseSchema = z.object({
  error: z.object({
    code: AdminAuthErrorCodeSchema,
    message: z.string(),
    type: z.literal('admin_auth_error')
  })
});

export type AdminPrincipal = z.infer<typeof AdminPrincipalSchema>;
export type AdminCredential = z.infer<typeof AdminCredentialSchema>;
export type AdminTokenPair = z.infer<typeof AdminAuthTokenPairSchema>;
export type AdminAuthErrorCode = z.infer<typeof AdminAuthErrorCodeSchema>;
