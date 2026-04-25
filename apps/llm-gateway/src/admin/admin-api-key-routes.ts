import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';

import {
  type ApiKeyAdminListResponse,
  type ApiKeyAdminSummary,
  type CreateApiKeyRequest,
  type CreateApiKeyResponse,
  type UpdateApiKeyRequest
} from '../contracts/admin-api-key';
import {
  assertApiKeyStatusTransition,
  buildCreateApiKeyResponse,
  normalizeApiKeyModelPermissions,
  type ApiKeyAdminRecordInput
} from '../keys/api-key-admin-service';
import { createVirtualApiKey } from '../keys/api-key';
import { createPostgresAdminApiKeyStore } from '../repositories/postgres-admin-api-key-store';

export interface AdminApiKeyStore {
  list(): Promise<ApiKeyAdminRecordInput[]>;
  create(input: CreateApiKeyRequest): Promise<CreateApiKeyResponse>;
  update(id: string, input: UpdateApiKeyRequest): Promise<ApiKeyAdminRecordInput>;
  revoke(id: string): Promise<ApiKeyAdminRecordInput>;
}

export interface CreateMemoryAdminApiKeyStoreOptions {
  secret: string;
  now?: () => Date;
}

let routeService: AdminApiKeyStore | null = null;

export function setAdminApiKeyRouteServiceForRoutes(service: AdminApiKeyStore | null): void {
  routeService = service;
}

export function getAdminApiKeyRouteServiceForRoutes(): AdminApiKeyStore {
  if (!routeService) {
    routeService = createDefaultAdminApiKeyStore();
  }

  return routeService;
}

function createDefaultAdminApiKeyStore(): AdminApiKeyStore {
  const secret = process.env.LLM_GATEWAY_KEY_HASH_SECRET ?? process.env.LLM_GATEWAY_API_KEY_SECRET;

  if (process.env.DATABASE_URL) {
    return createPostgresAdminApiKeyStore(process.env.DATABASE_URL, { keyHashSecret: secret });
  }

  return createMemoryAdminApiKeyStore({
    secret: secret ?? process.env.LLM_GATEWAY_ADMIN_JWT_SECRET ?? 'local-dev-secret'
  });
}

export function createMemoryAdminApiKeyStore(options: CreateMemoryAdminApiKeyStoreOptions): AdminApiKeyStore {
  const now = options.now ?? (() => new Date());
  const records = new Map<string, ApiKeyAdminRecordInput>();

  async function findExisting(id: string): Promise<ApiKeyAdminRecordInput> {
    const record = records.get(id);
    if (!record) {
      throw new AdminApiKeyRouteError('api_key_not_found', 'API key was not found.', 404);
    }

    return record;
  }

  return {
    async list() {
      return Array.from(records.values()).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },
    async create(input) {
      const timestamp = now().toISOString();
      const virtualKey = await createVirtualApiKey(options.secret);
      const record: ApiKeyAdminRecordInput = {
        id: `key_${randomUUID()}`,
        name: input.name,
        keyPrefix: virtualKey.prefix,
        keyHash: virtualKey.hash,
        status: 'active',
        allowAllModels: input.allowAllModels,
        models: normalizeApiKeyModelPermissions(input),
        rpmLimit: input.rpmLimit,
        tpmLimit: input.tpmLimit,
        dailyTokenLimit: input.dailyTokenLimit,
        dailyCostLimit: input.dailyCostLimit,
        usedTokensToday: 0,
        usedCostToday: 0,
        requestCountToday: 0,
        expiresAt: input.expiresAt,
        lastUsedAt: null,
        createdAt: timestamp,
        revokedAt: null
      };

      records.set(record.id, record);
      return buildCreateApiKeyResponse({ plaintext: virtualKey.plaintext, record });
    },
    async update(id, input) {
      const existing = await findExisting(id);
      assertPatchAllowed(existing);

      const allowAllModels = input.allowAllModels ?? existing.allowAllModels;
      const models = input.models ?? existing.models;
      const updated: ApiKeyAdminRecordInput = {
        ...existing,
        name: input.name ?? existing.name,
        allowAllModels,
        models: normalizeApiKeyModelPermissions({ allowAllModels, models }),
        rpmLimit: pickPatchValue(input, 'rpmLimit', existing.rpmLimit),
        tpmLimit: pickPatchValue(input, 'tpmLimit', existing.tpmLimit),
        dailyTokenLimit: pickPatchValue(input, 'dailyTokenLimit', existing.dailyTokenLimit),
        dailyCostLimit: pickPatchValue(input, 'dailyCostLimit', existing.dailyCostLimit),
        expiresAt: pickPatchValue(input, 'expiresAt', existing.expiresAt)
      };

      records.set(id, updated);
      return updated;
    },
    async revoke(id) {
      const existing = await findExisting(id);
      assertApiKeyStatusTransition(existing.status, 'revoked');

      if (existing.status === 'revoked') {
        return existing;
      }

      const revoked: ApiKeyAdminRecordInput = {
        ...existing,
        status: 'revoked',
        revokedAt: now().toISOString()
      };
      records.set(id, revoked);
      return revoked;
    }
  };
}

export function toApiKeyAdminSummary(record: ApiKeyAdminRecordInput): ApiKeyAdminSummary {
  return {
    id: record.id,
    name: record.name,
    keyPrefix: record.keyPrefix,
    status: record.status,
    allowAllModels: record.allowAllModels,
    models: record.models,
    rpmLimit: record.rpmLimit,
    tpmLimit: record.tpmLimit,
    dailyTokenLimit: record.dailyTokenLimit,
    dailyCostLimit: record.dailyCostLimit,
    usedTokensToday: record.usedTokensToday,
    usedCostToday: record.usedCostToday,
    requestCountToday: record.requestCountToday,
    expiresAt: record.expiresAt,
    lastUsedAt: record.lastUsedAt,
    createdAt: record.createdAt,
    revokedAt: record.revokedAt
  };
}

export async function listAdminApiKeysForRoutes(): Promise<ApiKeyAdminListResponse> {
  const records = await getAdminApiKeyRouteServiceForRoutes().list();
  return {
    items: records.map(toApiKeyAdminSummary),
    nextCursor: null
  };
}

export async function createAdminApiKeyForRoutes(input: CreateApiKeyRequest): Promise<CreateApiKeyResponse> {
  return getAdminApiKeyRouteServiceForRoutes().create(input);
}

export async function updateAdminApiKeyForRoutes(id: string, input: UpdateApiKeyRequest): Promise<ApiKeyAdminSummary> {
  const record = await getAdminApiKeyRouteServiceForRoutes().update(id, input);
  return toApiKeyAdminSummary(record);
}

export async function revokeAdminApiKeyForRoutes(id: string): Promise<ApiKeyAdminSummary> {
  const record = await getAdminApiKeyRouteServiceForRoutes().revoke(id);
  return toApiKeyAdminSummary(record);
}

export class AdminApiKeyRouteError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'AdminApiKeyRouteError';
    this.code = code;
    this.status = status;
  }
}

export function adminApiKeyRouteErrorResponse(error: unknown): Response {
  if (error instanceof AdminApiKeyRouteError) {
    return errorResponse(error.code, error.message, error.status);
  }

  if (error instanceof ZodError) {
    return errorResponse('api_key_bad_request', 'API key request body is invalid.', 400);
  }

  return errorResponse('api_key_request_failed', 'API key admin request failed.', 500);
}

function assertPatchAllowed(record: ApiKeyAdminRecordInput): void {
  if (record.status === 'revoked') {
    throw new AdminApiKeyRouteError('api_key_revoked_terminal', 'Revoked API keys cannot be updated.', 409);
  }
}

function errorResponse(code: string, message: string, status: number): Response {
  return Response.json(
    {
      error: {
        code,
        message,
        type: 'admin_api_key_error'
      }
    },
    { status }
  );
}

function pickPatchValue<Key extends NullableUpdateApiKeyRequestKey>(
  input: UpdateApiKeyRequest,
  key: Key,
  fallback: ApiKeyAdminRecordInput[Key]
): ApiKeyAdminRecordInput[Key] {
  return Object.prototype.hasOwnProperty.call(input, key) ? (input[key] as ApiKeyAdminRecordInput[Key]) : fallback;
}

type NullableUpdateApiKeyRequestKey = 'rpmLimit' | 'tpmLimit' | 'dailyTokenLimit' | 'dailyCostLimit' | 'expiresAt';
