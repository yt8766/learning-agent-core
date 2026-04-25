import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { getAdminAuthServiceForRoutes, adminAuthErrorResponse } from '../auth/admin-auth';
import type {
  CreateProviderCredentialRequest,
  ProviderAdminRecord,
  ProviderAdminSummary,
  ProviderCredentialAdminRecord,
  RotateProviderCredentialRequest,
  UpsertProviderRequest,
  UpsertProviderWithCredentialRequest
} from '../contracts/admin-provider';
import {
  CreateProviderCredentialRequestSchema,
  RotateProviderCredentialRequestSchema,
  UpsertProviderWithCredentialRequestSchema
} from '../contracts/admin-provider';
import type { GatewayModelAdminRecord, UpsertGatewayModelRequest } from '../contracts/admin-model';
import {
  buildCreateProviderCredentialResponse,
  buildProviderAdminRecord,
  buildRotateProviderCredentialResponse,
  normalizeProviderAdminUpsert
} from '../providers/provider-admin-service';
import { buildGatewayModelAdminRecord, normalizeGatewayModelAdminUpsert } from '../models/model-admin-service';
import { createPostgresAdminProviderModelStore } from '../repositories/postgres-admin-provider-model-store';
import type { EncryptedProviderSecretPayload } from '../secrets/provider-secret-vault';
import { ProviderSecretVault } from '../secrets/provider-secret-vault';

export type StoredProviderCredential = ProviderCredentialAdminRecord & {
  encryptedSecret: EncryptedProviderSecretPayload;
};

export interface AdminProviderModelStore {
  listProviders(): Promise<ProviderAdminRecord[]>;
  saveProvider(provider: ProviderAdminRecord): Promise<ProviderAdminRecord>;
  findProviderById(id: string): Promise<ProviderAdminRecord | null>;
  listProviderCredentials(providerId: string): Promise<StoredProviderCredential[]>;
  saveProviderCredential(credential: StoredProviderCredential): Promise<StoredProviderCredential>;
  rotateActiveProviderCredentials(providerId: string, rotatedAt: string): Promise<void>;
  listModels(): Promise<GatewayModelAdminRecord[]>;
  saveModel(model: GatewayModelAdminRecord): Promise<GatewayModelAdminRecord>;
  findModelById(id: string): Promise<GatewayModelAdminRecord | null>;
}

export interface AdminProviderModelRouteServiceOptions {
  store: AdminProviderModelStore;
  vault?: ProviderSecretVault;
  now?: () => Date;
}

export interface AdminProviderModelRouteService {
  listProviders(): Promise<{ providers: ProviderAdminSummary[] }>;
  createProvider(input: unknown): Promise<{ provider: ProviderAdminSummary }>;
  updateProvider(id: string, input: unknown): Promise<{ provider: ProviderAdminSummary }>;
  deleteProvider(id: string): Promise<{ provider: ProviderAdminSummary }>;
  createProviderCredential(
    providerId: string,
    input: unknown
  ): Promise<ReturnType<typeof buildCreateProviderCredentialResponse>>;
  rotateProviderCredential(
    providerId: string,
    input: unknown
  ): Promise<ReturnType<typeof buildRotateProviderCredentialResponse>>;
  listModels(): Promise<{ models: GatewayModelAdminRecord[] }>;
  createModel(input: unknown): Promise<{ model: GatewayModelAdminRecord }>;
  updateModel(id: string, input: unknown): Promise<{ model: GatewayModelAdminRecord }>;
  deleteModel(id: string): Promise<{ model: GatewayModelAdminRecord }>;
}

let routeService: AdminProviderModelRouteService | null = null;

export function setAdminProviderModelRouteServiceForRoutes(service: AdminProviderModelRouteService | null): void {
  routeService = service;
}

export function getAdminProviderModelRouteServiceForRoutes(): AdminProviderModelRouteService {
  if (!routeService) {
    routeService = createAdminProviderModelRouteService({
      store: createDefaultAdminProviderModelStore()
    });
  }

  return routeService;
}

function createDefaultAdminProviderModelStore(): AdminProviderModelStore {
  if (process.env.DATABASE_URL) {
    return createPostgresAdminProviderModelStore(process.env.DATABASE_URL);
  }

  return createMemoryAdminProviderModelStore();
}

export function createAdminProviderModelRouteService(
  options: AdminProviderModelRouteServiceOptions
): AdminProviderModelRouteService {
  const now = options.now ?? (() => new Date());

  async function requireProvider(providerId: string): Promise<ProviderAdminRecord> {
    const provider = await options.store.findProviderById(providerId);
    if (!provider) {
      throw new AdminProviderModelRouteError('admin_provider_not_found', 'Provider was not found.', 404);
    }

    return provider;
  }

  function timestamp(): string {
    return now().toISOString();
  }

  return {
    async listProviders() {
      const providers = await options.store.listProviders();
      return {
        providers: await Promise.all(
          providers.map(async provider =>
            buildProviderAdminSummary(
              buildProviderAdminRecord(provider),
              await options.store.listProviderCredentials(provider.id)
            )
          )
        )
      };
    },
    async createProvider(input) {
      const parsed = UpsertProviderWithCredentialRequestSchema.parse(input) as UpsertProviderWithCredentialRequest;
      const body = normalizeProviderAdminUpsert(providerBaseInput(parsed));
      const current = timestamp();
      const provider = buildProviderAdminRecord({
        ...body,
        id: providerIdForName(body.name),
        createdAt: current,
        updatedAt: current
      });
      const credential = parsed.plaintextApiKey?.trim()
        ? await buildProviderCredentialRecord(provider.id, parsed.plaintextApiKey, current)
        : null;
      const savedProvider = await options.store.saveProvider(provider);

      if (credential) {
        await options.store.saveProviderCredential(credential);
      }

      return { provider: buildProviderAdminSummary(savedProvider, credential ? [credential] : []) };
    },
    async updateProvider(id, input) {
      const existing = await requireProvider(id);
      const parsed = UpsertProviderWithCredentialRequestSchema.parse(input) as UpsertProviderWithCredentialRequest;
      const body = normalizeProviderAdminUpsert(providerBaseInput(parsed));
      const current = timestamp();
      const provider = buildProviderAdminRecord({
        ...body,
        id,
        createdAt: existing.createdAt,
        updatedAt: current
      });
      const credential = parsed.plaintextApiKey?.trim()
        ? await buildProviderCredentialRecord(id, parsed.plaintextApiKey, current)
        : null;
      const savedProvider = await options.store.saveProvider(provider);

      if (credential) {
        await options.store.rotateActiveProviderCredentials(id, current);
        await options.store.saveProviderCredential(credential);
      }

      const credentials = credential ? await options.store.listProviderCredentials(id) : [];
      return { provider: buildProviderAdminSummary(savedProvider, credentials) };
    },
    async deleteProvider(id) {
      const existing = await requireProvider(id);
      const disabled = buildProviderAdminRecord({
        ...existing,
        status: 'disabled',
        updatedAt: timestamp()
      });

      const savedProvider = await options.store.saveProvider(disabled);
      return {
        provider: buildProviderAdminSummary(savedProvider, await options.store.listProviderCredentials(id))
      };
    },
    async createProviderCredential(providerId, input) {
      await requireProvider(providerId);
      const body = CreateProviderCredentialRequestSchema.parse(input) as CreateProviderCredentialRequest;
      if (body.providerId !== providerId) {
        throw new AdminProviderModelRouteError('admin_provider_id_mismatch', 'Provider id does not match route.', 400);
      }

      const credential = await options.store.saveProviderCredential(
        await buildProviderCredentialRecord(providerId, body.plaintextApiKey, timestamp())
      );

      return buildCreateProviderCredentialResponse(credential);
    },
    async rotateProviderCredential(providerId, input) {
      await requireProvider(providerId);
      const body = RotateProviderCredentialRequestSchema.parse(input) as RotateProviderCredentialRequest;
      const current = timestamp();
      await options.store.rotateActiveProviderCredentials(providerId, current);

      const credential = await options.store.saveProviderCredential(
        await buildProviderCredentialRecord(providerId, body.plaintextApiKey, current)
      );

      return buildRotateProviderCredentialResponse(credential);
    },
    async listModels() {
      return { models: await options.store.listModels() };
    },
    async createModel(input) {
      const body = normalizeGatewayModelAdminUpsert(input as UpsertGatewayModelRequest);
      const provider = await resolveModelProvider(body.providerId);
      const current = timestamp();
      const model = buildGatewayModelAdminRecord({
        ...body,
        providerId: provider.id,
        id: modelIdForAlias(body.alias),
        createdAt: current,
        updatedAt: current
      });

      return { model: await options.store.saveModel(model) };
    },
    async updateModel(id, input) {
      const existing = await options.store.findModelById(id);
      if (!existing) {
        throw new AdminProviderModelRouteError('admin_model_not_found', 'Model was not found.', 404);
      }

      const body = normalizeGatewayModelAdminUpsert(input as UpsertGatewayModelRequest);
      const provider = await resolveModelProvider(body.providerId);
      const model = buildGatewayModelAdminRecord({
        ...body,
        providerId: provider.id,
        id,
        createdAt: existing.createdAt,
        updatedAt: timestamp()
      });

      return { model: await options.store.saveModel(model) };
    },
    async deleteModel(id) {
      const existing = await options.store.findModelById(id);
      if (!existing) {
        throw new AdminProviderModelRouteError('admin_model_not_found', 'Model was not found.', 404);
      }

      const disabled = buildGatewayModelAdminRecord({
        ...existing,
        enabled: false,
        updatedAt: timestamp()
      });

      return { model: await options.store.saveModel(disabled) };
    }
  };

  async function resolveModelProvider(providerId: string): Promise<ProviderAdminRecord> {
    const directProvider = await options.store.findProviderById(providerId);
    if (directProvider) {
      return directProvider;
    }

    const generatedProviderId = providerIdForName(providerId);
    if (generatedProviderId !== providerId) {
      const generatedProvider = await options.store.findProviderById(generatedProviderId);
      if (generatedProvider) {
        return generatedProvider;
      }
    }

    throw new AdminProviderModelRouteError(
      'admin_model_provider_not_found',
      `Provider ${providerId} was not found. Use an existing provider id such as ${generatedProviderId}.`,
      404
    );
  }

  async function buildProviderCredentialRecord(
    providerId: string,
    plaintextApiKey: string,
    createdAt: string
  ): Promise<StoredProviderCredential> {
    const vault = options.vault ?? createDefaultProviderSecretVault();
    const encryptedSecret = vault.encrypt(plaintextApiKey);

    return {
      id: `credential_${randomUUID()}`,
      providerId,
      keyPrefix: keyPrefix(plaintextApiKey),
      fingerprint: vault.fingerprint(plaintextApiKey),
      keyVersion: encryptedSecret.keyVersion,
      status: 'active',
      createdAt,
      rotatedAt: null,
      encryptedSecret
    };
  }
}

export function createMemoryAdminProviderModelStore(): AdminProviderModelStore {
  const providers = new Map<string, ProviderAdminRecord>();
  const credentials = new Map<string, StoredProviderCredential>();
  const models = new Map<string, GatewayModelAdminRecord>();

  return {
    async listProviders() {
      return Array.from(providers.values());
    },
    async saveProvider(provider) {
      const record = buildProviderAdminRecord(provider);
      providers.set(record.id, record);
      return record;
    },
    async findProviderById(id) {
      return providers.get(id) ?? null;
    },
    async listProviderCredentials(providerId) {
      return Array.from(credentials.values()).filter(credential => credential.providerId === providerId);
    },
    async saveProviderCredential(credential) {
      credentials.set(credential.id, credential);
      return credential;
    },
    async rotateActiveProviderCredentials(providerId, rotatedAt) {
      for (const credential of credentials.values()) {
        if (credential.providerId === providerId && credential.status === 'active') {
          credentials.set(credential.id, {
            ...credential,
            status: 'rotated',
            rotatedAt
          });
        }
      }
    },
    async listModels() {
      return Array.from(models.values());
    },
    async saveModel(model) {
      const record = buildGatewayModelAdminRecord(model);
      models.set(record.id, record);
      return record;
    },
    async findModelById(id) {
      return models.get(id) ?? null;
    }
  };
}

export async function requireAdminAccess(authorization: string | null): Promise<void> {
  await getAdminAuthServiceForRoutes().requireAccessToken(authorization);
}

export async function routeParamsId(context: { params: { id: string } | Promise<{ id: string }> }): Promise<string> {
  return (await context.params).id;
}

export function adminProviderModelErrorResponse(error: unknown): Response {
  if (isAdminAuthErrorResponseCandidate(error)) {
    return adminAuthErrorResponse(error);
  }

  const routeError = toAdminProviderModelRouteError(error);
  return Response.json(
    {
      error: {
        code: routeError.code,
        message: routeError.message,
        type: 'admin_provider_model_error'
      }
    },
    { status: routeError.status }
  );
}

export class AdminProviderModelRouteError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'AdminProviderModelRouteError';
    this.code = code;
    this.status = status;
  }
}

function toAdminProviderModelRouteError(error: unknown): AdminProviderModelRouteError {
  if (error instanceof AdminProviderModelRouteError) {
    return error;
  }

  if (error instanceof z.ZodError) {
    return new AdminProviderModelRouteError('admin_provider_model_bad_request', 'Request payload is invalid.', 400);
  }

  return new AdminProviderModelRouteError(
    'admin_provider_model_request_failed',
    'Admin provider/model request failed.',
    400
  );
}

function providerBaseInput(input: UpsertProviderWithCredentialRequest): UpsertProviderRequest {
  return {
    name: input.name,
    kind: input.kind,
    status: input.status,
    baseUrl: input.baseUrl,
    timeoutMs: input.timeoutMs
  };
}

function buildProviderAdminSummary(
  provider: ProviderAdminRecord,
  credentials: StoredProviderCredential[]
): ProviderAdminSummary {
  const credential = selectProviderDisplayCredential(credentials);

  return {
    ...provider,
    credentialId: credential?.id ?? null,
    credentialKeyPrefix: credential?.keyPrefix ?? null,
    credentialFingerprint: credential?.fingerprint ?? null,
    credentialKeyVersion: credential?.keyVersion ?? null,
    credentialStatus: credential?.status ?? null,
    credentialCreatedAt: credential?.createdAt ?? null,
    credentialRotatedAt: credential?.rotatedAt ?? null
  };
}

function selectProviderDisplayCredential(credentials: StoredProviderCredential[]): StoredProviderCredential | null {
  const activeCredential = credentials.find(credential => credential.status === 'active');
  if (activeCredential) {
    return activeCredential;
  }

  return [...credentials].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
}

function isAdminAuthErrorResponseCandidate(error: unknown): boolean {
  return error instanceof Error && error.name === 'AdminAuthError';
}

function providerIdForName(name: string): string {
  return `provider_${slug(name).replace(/-/g, '_')}`;
}

function modelIdForAlias(alias: string): string {
  return `model_${alias.replace(/-/g, '_')}`;
}

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function keyPrefix(value: string): string {
  return value.slice(0, 7);
}

function createDefaultProviderSecretVault(): ProviderSecretVault {
  const key = process.env.LLM_GATEWAY_PROVIDER_SECRET_KEY;
  if (!key) {
    throw new AdminProviderModelRouteError(
      'admin_provider_secret_not_configured',
      'Set LLM_GATEWAY_PROVIDER_SECRET_KEY.',
      503
    );
  }

  return new ProviderSecretVault({
    key,
    keyVersion: process.env.LLM_GATEWAY_PROVIDER_SECRET_KEY_VERSION ?? 'env-v1'
  });
}
