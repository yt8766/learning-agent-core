import { z } from 'zod';

export const IdentityLoginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export const IdentityRefreshRequestSchema = z.object({
  refreshToken: z.string().min(1)
});

export const IdentityLogoutRequestSchema = z.object({
  refreshToken: z.string().min(1).optional()
});

export type IdentityLoginRequest = z.infer<typeof IdentityLoginRequestSchema>;
export type IdentityRefreshRequest = z.infer<typeof IdentityRefreshRequestSchema>;
export type IdentityLogoutRequest = z.infer<typeof IdentityLogoutRequestSchema>;
