import type { z } from 'zod';

import type {
  AdminAccountSchema,
  AdminAccountStatusSchema,
  AdminAuthErrorCodeSchema,
  AdminAuthErrorResponseSchema,
  AdminLoginRequestSchema,
  AdminLoginResponseSchema,
  AdminLogoutRequestSchema,
  AdminLogoutResponseSchema,
  AdminMeResponseSchema,
  AdminRefreshRequestSchema,
  AdminRefreshResponseSchema,
  AdminRoleSchema,
  AdminTokenPairSchema
} from './admin-auth.schemas';

export type AdminRole = z.infer<typeof AdminRoleSchema>;
export type AdminAccountStatus = z.infer<typeof AdminAccountStatusSchema>;
export type AdminAccount = z.infer<typeof AdminAccountSchema>;
export type AdminTokenPair = z.infer<typeof AdminTokenPairSchema>;
export type AdminLoginRequest = z.infer<typeof AdminLoginRequestSchema>;
export type AdminLoginResponse = z.infer<typeof AdminLoginResponseSchema>;
export type AdminRefreshRequest = z.infer<typeof AdminRefreshRequestSchema>;
export type AdminRefreshResponse = z.infer<typeof AdminRefreshResponseSchema>;
export type AdminLogoutRequest = z.infer<typeof AdminLogoutRequestSchema>;
export type AdminLogoutResponse = z.infer<typeof AdminLogoutResponseSchema>;
export type AdminMeResponse = z.infer<typeof AdminMeResponseSchema>;
export type AdminAuthErrorCode = z.infer<typeof AdminAuthErrorCodeSchema>;
export type AdminAuthErrorResponse = z.infer<typeof AdminAuthErrorResponseSchema>;
