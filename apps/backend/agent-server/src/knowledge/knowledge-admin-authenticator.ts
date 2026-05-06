import { pbkdf2, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import type { KnowledgeSqlClient } from './repositories/knowledge-sql-client';

const pbkdf2Async = promisify(pbkdf2);
const scryptAsync = promisify(scryptCallback);

export const KNOWLEDGE_ADMIN_AUTHENTICATOR = Symbol('KNOWLEDGE_ADMIN_AUTHENTICATOR');

export interface KnowledgeAdminAccount {
  id: string;
  username: string;
  displayName: string;
  roles: string[];
}

export interface KnowledgeAdminAuthenticator {
  authenticate(input: { username: string; password: string }): Promise<KnowledgeAdminAccount | null>;
  findById?(id: string): Promise<KnowledgeAdminAccount | null>;
}

export class PostgresKnowledgeAdminAuthenticator implements KnowledgeAdminAuthenticator {
  constructor(private readonly sqlClient: KnowledgeSqlClient) {}

  async authenticate(input: { username: string; password: string }): Promise<KnowledgeAdminAccount | null> {
    const account = await this.findCredentialByUsername(input.username.trim());
    if (!account || !(await verifyStoredPassword(input.password, account.passwordHash))) {
      return null;
    }

    return toKnowledgeAdminAccount(account);
  }

  async findById(id: string): Promise<KnowledgeAdminAccount | null> {
    const account = await this.findAccountById(id);
    return account ? toKnowledgeAdminAccount(account) : null;
  }

  private async findCredentialByUsername(username: string): Promise<AdminCredentialProjection | null> {
    return (
      (await ignoreMissingTable(() => this.findAgentServerCredentialByUsername(username))) ??
      (await ignoreMissingTable(() => this.findLlmGatewayCredentialByUsername(username)))
    );
  }

  private async findAccountById(id: string): Promise<AdminAccountProjection | null> {
    return (
      (await ignoreMissingTable(() => this.findAgentServerAccountById(id))) ??
      (await ignoreMissingTable(() => this.findLlmGatewayAccountById(id)))
    );
  }

  private async findAgentServerCredentialByUsername(username: string): Promise<AdminCredentialProjection | null> {
    const result = await this.sqlClient.query<AdminCredentialRow>(
      `select
        account.id,
        account.username,
        account.display_name,
        account.roles,
        account.status,
        credential.password_hash
      from admin_accounts account
      join admin_password_credentials credential on credential.account_id = account.id
      where lower(account.username) = lower($1)
      limit 1`,
      [username]
    );

    return result.rows[0] ? mapAgentServerCredentialRow(result.rows[0]) : null;
  }

  private async findAgentServerAccountById(id: string): Promise<AdminAccountProjection | null> {
    const result = await this.sqlClient.query<AdminAccountRow>(
      `select id, username, display_name, roles, status
      from admin_accounts
      where id = $1
      limit 1`,
      [id]
    );

    return result.rows[0] ? mapAgentServerAccountRow(result.rows[0]) : null;
  }

  private async findLlmGatewayCredentialByUsername(username: string): Promise<AdminCredentialProjection | null> {
    const result = await this.sqlClient.query<AdminCredentialRow>(
      `select
        principal.id,
        principal.display_name as username,
        principal.display_name,
        principal.role,
        principal.status,
        credential.password_hash
      from admin_principals principal
      join admin_credentials credential on credential.principal_id = principal.id and credential.kind = 'password'
      where lower(principal.display_name) = lower($1)
      limit 1`,
      [username]
    );

    return result.rows[0] ? mapLlmGatewayCredentialRow(result.rows[0]) : null;
  }

  private async findLlmGatewayAccountById(id: string): Promise<AdminAccountProjection | null> {
    const result = await this.sqlClient.query<AdminAccountRow>(
      `select id, display_name as username, display_name, role, status
      from admin_principals
      where id = $1
      limit 1`,
      [id]
    );

    return result.rows[0] ? mapLlmGatewayAccountRow(result.rows[0]) : null;
  }
}

interface AdminAccountProjection {
  id: string;
  username: string;
  displayName: string;
  roles: string[];
  status: string;
}

interface AdminCredentialProjection extends AdminAccountProjection {
  passwordHash: string;
}

type AdminAccountRow = Record<string, unknown>;
type AdminCredentialRow = Record<string, unknown>;

async function verifyStoredPassword(password: string, passwordHash: string): Promise<boolean> {
  if (passwordHash.startsWith('scrypt:')) {
    return verifyScryptPassword(password, passwordHash);
  }
  if (passwordHash.startsWith('pbkdf2-sha256$')) {
    return verifyPbkdfPassword(password, passwordHash);
  }
  return false;
}

async function verifyScryptPassword(password: string, passwordHash: string): Promise<boolean> {
  const [algorithm, salt, expectedHex] = passwordHash.split(':');
  if (algorithm !== 'scrypt' || !salt || !expectedHex) {
    return false;
  }

  const expected = Buffer.from(expectedHex, 'hex');
  const actual = (await scryptAsync(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function verifyPbkdfPassword(password: string, passwordHash: string): Promise<boolean> {
  const [prefix, iterationsText, salt, hash] = passwordHash.split('$');
  const iterations = Number(iterationsText);
  if (prefix !== 'pbkdf2-sha256' || !Number.isInteger(iterations) || iterations <= 0 || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, 'base64url');
  const actual = await pbkdf2Async(password, salt, iterations, expected.length, 'sha256');
  const actualBuffer = Buffer.from(actual);
  return expected.length === actualBuffer.length && timingSafeEqual(expected, actualBuffer);
}

async function ignoreMissingTable<T>(action: () => Promise<T>): Promise<T | null> {
  try {
    return await action();
  } catch (error) {
    if (isUndefinedTableError(error)) {
      return null;
    }
    throw error;
  }
}

function isUndefinedTableError(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '42P01');
}

function mapAgentServerCredentialRow(row: AdminCredentialRow): AdminCredentialProjection {
  return { ...mapAgentServerAccountRow(row), passwordHash: String(row.password_hash) };
}

function mapAgentServerAccountRow(row: AdminAccountRow): AdminAccountProjection {
  return {
    id: String(row.id),
    username: String(row.username),
    displayName: String(row.display_name ?? row.username),
    roles: parseRoles(row.roles),
    status: String(row.status)
  };
}

function mapLlmGatewayCredentialRow(row: AdminCredentialRow): AdminCredentialProjection {
  return { ...mapLlmGatewayAccountRow(row), passwordHash: String(row.password_hash) };
}

function mapLlmGatewayAccountRow(row: AdminAccountRow): AdminAccountProjection {
  return {
    id: String(row.id),
    username: String(row.username ?? row.display_name),
    displayName: String(row.display_name ?? row.username),
    roles: row.role === 'owner' ? ['super_admin'] : parseRoles(row.roles),
    status: String(row.status)
  };
}

function parseRoles(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map(String);
  }
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [input];
    } catch {
      return [input];
    }
  }
  return [];
}

function toKnowledgeAdminAccount(account: AdminAccountProjection): KnowledgeAdminAccount | null {
  if (!isActiveStatus(account.status)) {
    return null;
  }

  const roles = account.roles.includes('owner') ? ['super_admin'] : account.roles;
  if (!roles.includes('super_admin')) {
    return null;
  }

  return {
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    roles
  };
}

function isActiveStatus(status: string) {
  return status === 'enabled' || status === 'active';
}
