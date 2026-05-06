import type { z } from 'zod';

import type {
  AuthAccountSchema,
  AuthErrorCodeSchema,
  AuthErrorResponseSchema,
  AuthGlobalRoleSchema,
  AuthLoginRequestSchema,
  AuthLoginResponseSchema,
  AuthLogoutRequestSchema,
  AuthMeResponseSchema,
  AuthRefreshRequestSchema,
  AuthRefreshResponseSchema,
  AuthResetPasswordRequestSchema,
  AuthSessionSchema,
  AuthTokenPairSchema,
  AuthUserCreateRequestSchema,
  AuthUsersListResponseSchema,
  AuthUserStatusSchema,
  AuthUserUpdateRequestSchema
} from './auth-service.schemas';

export type AuthGlobalRole = z.infer<typeof AuthGlobalRoleSchema>;
export type AuthUserStatus = z.infer<typeof AuthUserStatusSchema>;
export type AuthAccount = z.infer<typeof AuthAccountSchema>;
export type AuthSession = z.infer<typeof AuthSessionSchema>;
export type AuthTokenPair = z.infer<typeof AuthTokenPairSchema>;
export type AuthLoginRequest = z.infer<typeof AuthLoginRequestSchema>;
export type AuthLoginResponse = z.infer<typeof AuthLoginResponseSchema>;
export type AuthRefreshRequest = z.infer<typeof AuthRefreshRequestSchema>;
export type AuthRefreshResponse = z.infer<typeof AuthRefreshResponseSchema>;
export type AuthLogoutRequest = z.infer<typeof AuthLogoutRequestSchema>;
export type AuthMeResponse = z.infer<typeof AuthMeResponseSchema>;
export type AuthUserCreateRequest = z.infer<typeof AuthUserCreateRequestSchema>;
export type AuthUserUpdateRequest = z.infer<typeof AuthUserUpdateRequestSchema>;
export type AuthResetPasswordRequest = z.infer<typeof AuthResetPasswordRequestSchema>;
export type AuthUsersListResponse = z.infer<typeof AuthUsersListResponseSchema>;
export type AuthErrorCode = z.infer<typeof AuthErrorCodeSchema>;
export type AuthErrorResponse = z.infer<typeof AuthErrorResponseSchema>;
