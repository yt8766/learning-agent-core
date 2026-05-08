import type { z } from 'zod';
import type {
  GatewayAccountingRequestSchema,
  GatewayAccountingResponseSchema,
  GatewayAuthErrorCodeSchema,
  GatewayAuthErrorSchema,
  GatewayCredentialFileSchema,
  GatewayLogEntrySchema,
  GatewayLogListResponseSchema,
  GatewayLoginRequestSchema,
  GatewayLoginResponseSchema,
  GatewayPreprocessRequestSchema,
  GatewayPreprocessResponseSchema,
  GatewayProbeRequestSchema,
  GatewayProbeResponseSchema,
  GatewayProviderCredentialSetSchema,
  GatewayQuotaSchema,
  GatewayRefreshRequestSchema,
  GatewayRefreshResponseSchema,
  GatewaySessionSchema,
  GatewaySnapshotSchema,
  GatewayTokenCountRequestSchema,
  GatewayTokenCountResponseSchema,
  GatewayUsageListResponseSchema,
  GatewayUsageRecordSchema,
  GatewayUserSchema
} from './agent-gateway.schemas';
export type GatewayUser = z.infer<typeof GatewayUserSchema>;
export type GatewaySession = z.infer<typeof GatewaySessionSchema>;
export type GatewayAuthErrorCode = z.infer<typeof GatewayAuthErrorCodeSchema>;
export type GatewayAuthError = z.infer<typeof GatewayAuthErrorSchema>;
export type GatewayLoginRequest = z.infer<typeof GatewayLoginRequestSchema>;
export type GatewayLoginResponse = z.infer<typeof GatewayLoginResponseSchema>;
export type GatewayRefreshRequest = z.infer<typeof GatewayRefreshRequestSchema>;
export type GatewayRefreshResponse = z.infer<typeof GatewayRefreshResponseSchema>;
export type GatewayProviderCredentialSet = z.infer<typeof GatewayProviderCredentialSetSchema>;
export type GatewayCredentialFile = z.infer<typeof GatewayCredentialFileSchema>;
export type GatewayQuota = z.infer<typeof GatewayQuotaSchema>;
export type GatewaySnapshot = z.infer<typeof GatewaySnapshotSchema>;
export type GatewayLogEntry = z.infer<typeof GatewayLogEntrySchema>;
export type GatewayUsageRecord = z.infer<typeof GatewayUsageRecordSchema>;
export type GatewayLogListResponse = z.infer<typeof GatewayLogListResponseSchema>;
export type GatewayUsageListResponse = z.infer<typeof GatewayUsageListResponseSchema>;
export type GatewayProbeRequest = z.infer<typeof GatewayProbeRequestSchema>;
export type GatewayProbeResponse = z.infer<typeof GatewayProbeResponseSchema>;
export type GatewayTokenCountRequest = z.infer<typeof GatewayTokenCountRequestSchema>;
export type GatewayTokenCountResponse = z.infer<typeof GatewayTokenCountResponseSchema>;
export type GatewayPreprocessRequest = z.infer<typeof GatewayPreprocessRequestSchema>;
export type GatewayPreprocessResponse = z.infer<typeof GatewayPreprocessResponseSchema>;
export type GatewayAccountingRequest = z.infer<typeof GatewayAccountingRequestSchema>;
export type GatewayAccountingResponse = z.infer<typeof GatewayAccountingResponseSchema>;
