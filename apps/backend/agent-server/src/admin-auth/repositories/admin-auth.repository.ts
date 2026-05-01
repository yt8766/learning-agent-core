import type {
  AdminAccountRecord,
  AdminAuthAuditEventRecord,
  AdminPasswordCredentialRecord,
  AdminRefreshTokenRecord,
  AdminSessionRecord,
  CreateAdminRefreshTokenInput,
  CreateAdminSessionInput
} from '../interfaces/admin-auth-internal.types';

export abstract class AdminAuthRepository {
  abstract findAccountByUsername(username: string): Promise<AdminAccountRecord | null>;
  abstract findAccountById(accountId: string): Promise<AdminAccountRecord | null>;
  abstract updateAccount(account: AdminAccountRecord): Promise<void>;
  abstract findPasswordCredentialByAccountId(accountId: string): Promise<AdminPasswordCredentialRecord | null>;
  abstract updatePasswordCredential(credential: AdminPasswordCredentialRecord): Promise<void>;
  abstract createSession(input: CreateAdminSessionInput): Promise<AdminSessionRecord>;
  abstract findSessionById(sessionId: string): Promise<AdminSessionRecord | null>;
  abstract updateSession(session: AdminSessionRecord): Promise<void>;
  abstract revokeSession(sessionId: string, reason: string, now: string): Promise<void>;
  abstract createRefreshToken(input: CreateAdminRefreshTokenInput): Promise<AdminRefreshTokenRecord>;
  abstract findRefreshTokenByHash(tokenHash: string): Promise<AdminRefreshTokenRecord | null>;
  abstract markRefreshTokenUsedIfActive(id: string, replacedByTokenId: string, now: string): Promise<boolean>;
  abstract revokeRefreshToken(id: string, now: string): Promise<void>;
  abstract revokeActiveRefreshTokensBySessionId(sessionId: string, now: string): Promise<void>;
  abstract appendAuditEvent(input: AdminAuthAuditEventRecord): Promise<void>;
}
