import type { AdminAuthPolicy } from './interfaces/admin-auth-internal.types';

export const defaultAdminAuthPolicy: AdminAuthPolicy = {
  accessTokenTtlSeconds: 15 * 60,
  refreshTokenTtlSeconds: 24 * 60 * 60,
  rememberedRefreshTokenTtlSeconds: 30 * 24 * 60 * 60,
  maxFailedLoginAttempts: 5,
  lockDurationSeconds: 15 * 60
};
