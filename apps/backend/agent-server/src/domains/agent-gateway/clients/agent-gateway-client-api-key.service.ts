import { createHash, randomBytes } from 'node:crypto';
import { ConflictException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import type {
  GatewayClientApiKey,
  GatewayClientApiKeyListResponse,
  GatewayCreateClientApiKeyRequest,
  GatewayCreateClientApiKeyResponse,
  GatewayUpdateClientApiKeyRequest
} from '@agent/core';
import type { AgentGatewayClientRepository, StoredGatewayClientApiKey } from './agent-gateway-client.repository';
import { AGENT_GATEWAY_CLIENT_CLOCK, AGENT_GATEWAY_CLIENT_REPOSITORY } from './agent-gateway-client.repository';

type SecretFactory = () => string;
type DateFactory = () => Date;

export const AGENT_GATEWAY_CLIENT_SECRET_FACTORY = Symbol('AGENT_GATEWAY_CLIENT_SECRET_FACTORY');

@Injectable()
export class AgentGatewayClientApiKeyService {
  constructor(
    @Inject(AGENT_GATEWAY_CLIENT_REPOSITORY)
    private readonly repository: AgentGatewayClientRepository,
    @Optional()
    @Inject(AGENT_GATEWAY_CLIENT_SECRET_FACTORY)
    private readonly secretFactory: SecretFactory = () => `agp_live_${randomBytes(24).toString('base64url')}`,
    @Optional()
    @Inject(AGENT_GATEWAY_CLIENT_CLOCK)
    private readonly now: DateFactory = () => new Date()
  ) {}

  async list(clientId: string): Promise<GatewayClientApiKeyListResponse> {
    await this.requireClient(clientId);
    const items = await this.repository.listApiKeys(clientId);
    return { items: items.map(stripSecretHash) };
  }

  async create(
    clientId: string,
    request: GatewayCreateClientApiKeyRequest
  ): Promise<GatewayCreateClientApiKeyResponse> {
    await this.requireClient(clientId);
    const secret = await this.nextUniqueSecret();
    const now = this.now().toISOString();
    const apiKey: StoredGatewayClientApiKey = {
      id: await this.nextApiKeyId(clientId, request.name),
      clientId,
      name: request.name,
      prefix: keyPrefix(secret),
      status: 'active',
      scopes: request.scopes ?? ['models.read', 'chat.completions'],
      createdAt: now,
      expiresAt: request.expiresAt ?? null,
      lastUsedAt: null,
      secretHash: hashSecret(secret)
    };
    return { apiKey: stripSecretHash(await this.createApiKey(apiKey)), secret };
  }

  async update(
    clientId: string,
    apiKeyId: string,
    request: GatewayUpdateClientApiKeyRequest
  ): Promise<GatewayClientApiKey> {
    const current = await this.requireApiKey(clientId, apiKeyId);
    if (current.status === 'revoked' && request.status && request.status !== 'revoked') {
      throw new ConflictException({
        code: 'API_KEY_REVOKED',
        message: 'Revoked Gateway client API keys cannot be reactivated'
      });
    }
    const updated = await this.repository.updateApiKey(clientId, apiKeyId, request);
    if (!updated) throw apiKeyNotFound();
    return stripSecretHash(updated);
  }

  async rotate(clientId: string, apiKeyId: string): Promise<GatewayCreateClientApiKeyResponse> {
    const current = await this.requireApiKey(clientId, apiKeyId);
    if (current.status !== 'active') {
      throw new ConflictException({ code: 'API_KEY_NOT_ACTIVE', message: 'Only active Gateway client API keys can rotate' });
    }
    const secret = await this.nextUniqueSecret();
    const updated = await this.updateApiKeySecret(clientId, apiKeyId, secret);
    if (!updated) throw apiKeyNotFound();
    return { apiKey: stripSecretHash({ ...current, ...updated }), secret };
  }

  async revoke(clientId: string, apiKeyId: string): Promise<GatewayClientApiKey> {
    return this.update(clientId, apiKeyId, { status: 'revoked' });
  }

  async findActiveBySecret(secret: string): Promise<GatewayClientApiKey | null> {
    const apiKey = await this.repository.findApiKeyByHash(hashSecret(secret));
    if (!apiKey || apiKey.status !== 'active') return null;
    if (apiKey.expiresAt && new Date(apiKey.expiresAt).getTime() <= this.now().getTime()) return null;
    const client = await this.repository.findClient(apiKey.clientId);
    if (!client || client.status !== 'active') return null;
    return stripSecretHash(apiKey);
  }

  private async nextUniqueSecret(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const secret = this.secretFactory();
      const secretHash = hashSecret(secret);
      const existing = await this.repository.findApiKeyByHash(secretHash);
      if (!existing) return secret;
    }
    throw new ConflictException({
      code: 'API_KEY_SECRET_COLLISION',
      message: 'Gateway client API key secret generation produced a duplicate secret'
    });
  }

  private async createApiKey(apiKey: StoredGatewayClientApiKey): Promise<StoredGatewayClientApiKey> {
    try {
      return await this.repository.createApiKey(apiKey);
    } catch (error) {
      throw mapSecretCollision(error);
    }
  }

  private async updateApiKeySecret(
    clientId: string,
    apiKeyId: string,
    secret: string
  ): Promise<StoredGatewayClientApiKey | null> {
    try {
      return await this.repository.updateApiKey(clientId, apiKeyId, {
        prefix: keyPrefix(secret),
        secretHash: hashSecret(secret),
        status: 'active'
      });
    } catch (error) {
      throw mapSecretCollision(error);
    }
  }

  private async nextApiKeyId(clientId: string, name: string): Promise<string> {
    const baseId = `key-${slug(clientId)}-${slug(name)}`;
    let candidate = baseId;
    let suffix = 2;
    while (await this.repository.findApiKey(clientId, candidate)) {
      candidate = `${baseId}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  private async requireClient(clientId: string): Promise<void> {
    const client = await this.repository.findClient(clientId);
    if (!client) throw new NotFoundException({ code: 'CLIENT_NOT_FOUND', message: 'Gateway client not found' });
  }

  private async requireApiKey(clientId: string, apiKeyId: string): Promise<StoredGatewayClientApiKey> {
    await this.requireClient(clientId);
    const apiKey = await this.repository.findApiKey(clientId, apiKeyId);
    if (!apiKey) throw apiKeyNotFound();
    return apiKey;
  }
}

function stripSecretHash(apiKey: StoredGatewayClientApiKey): GatewayClientApiKey {
  const { secretHash: _secretHash, ...publicApiKey } = apiKey;
  return { ...publicApiKey, scopes: [...publicApiKey.scopes] };
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

function keyPrefix(secret: string): string {
  const [first, second] = secret.split('_');
  return first && second ? `${first}_${second}` : secret.slice(0, 8);
}

function apiKeyNotFound(): NotFoundException {
  return new NotFoundException({ code: 'API_KEY_NOT_FOUND', message: 'Gateway client API key not found' });
}

function mapSecretCollision(error: unknown): Error {
  if (error instanceof Error && error.message === 'GATEWAY_CLIENT_API_KEY_SECRET_HASH_EXISTS') {
    return new ConflictException({
      code: 'API_KEY_SECRET_COLLISION',
      message: 'Gateway client API key secret generation produced a duplicate secret'
    });
  }
  return error instanceof Error ? error : new Error(String(error));
}

function slug(value: string): string {
  const slugged = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slugged || 'default';
}
