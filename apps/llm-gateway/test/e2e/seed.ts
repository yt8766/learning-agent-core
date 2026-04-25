import pg from 'pg';

import { createAdminAuthService } from '../../src/auth/admin-auth';
import { createPostgresAdminAuthRepositoryForClient } from '../../src/repositories/postgres-admin-auth';
import { createPostgresGatewayRepository } from '../../src/repositories/postgres-gateway';
import { E2E_ADMIN_JWT_SECRET, E2E_API_KEY_SECRET, E2E_KEYS, E2E_OWNER_PASSWORD } from './fixtures';

export async function seedLlmGatewayE2e(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for llm-gateway E2E seed');
  }

  assertE2eDatabaseUrl(databaseUrl);

  const adminPool = new pg.Pool({ connectionString: databaseUrl });
  const adminRepository = createPostgresAdminAuthRepositoryForClient(adminPool);
  const gatewayRepository = createPostgresGatewayRepository(databaseUrl, { apiKeySecret: E2E_API_KEY_SECRET });

  try {
    const admin = createAdminAuthService({
      repository: adminRepository,
      jwtSecret: process.env.LLM_GATEWAY_ADMIN_JWT_SECRET ?? E2E_ADMIN_JWT_SECRET,
      now: () => new Date('2026-04-25T00:00:00.000Z')
    });

    await admin.ensureOwnerPassword({ password: E2E_OWNER_PASSWORD, displayName: 'E2E Owner' });

    await gatewayRepository.saveModel({
      alias: 'gpt-main',
      provider: 'mock',
      providerModel: 'mock-gpt-main',
      enabled: true,
      contextWindow: 128000,
      inputPricePer1mTokens: 0,
      outputPricePer1mTokens: 0,
      fallbackAliases: [],
      adminOnly: false
    });

    await gatewayRepository.saveModel({
      alias: 'minimax-main',
      provider: 'mock',
      providerModel: 'mock-minimax-main',
      enabled: true,
      contextWindow: 64000,
      inputPricePer1mTokens: 0,
      outputPricePer1mTokens: 0,
      fallbackAliases: [],
      adminOnly: false
    });

    await gatewayRepository.saveSeedApiKey({
      id: 'key-e2e-valid-full',
      name: 'E2E valid full',
      plaintext: E2E_KEYS.validFull,
      status: 'active',
      models: ['gpt-main', 'minimax-main'],
      rpmLimit: 60,
      tpmLimit: 100000,
      dailyTokenLimit: 500000,
      dailyCostLimit: 10,
      expiresAt: null
    });

    await gatewayRepository.saveSeedApiKey({
      id: 'key-e2e-model-limited',
      name: 'E2E model limited',
      plaintext: E2E_KEYS.modelLimited,
      status: 'active',
      models: ['minimax-main'],
      rpmLimit: 60,
      tpmLimit: 100000,
      dailyTokenLimit: 500000,
      dailyCostLimit: 10,
      expiresAt: null
    });

    await gatewayRepository.saveSeedApiKey({
      id: 'key-e2e-budget-low',
      name: 'E2E budget low',
      plaintext: E2E_KEYS.budgetLow,
      status: 'active',
      models: ['gpt-main'],
      rpmLimit: 60,
      tpmLimit: 100000,
      dailyTokenLimit: 1,
      dailyCostLimit: 10,
      expiresAt: null
    });

    await gatewayRepository.saveSeedApiKey({
      id: 'key-e2e-disabled',
      name: 'E2E disabled',
      plaintext: E2E_KEYS.disabled,
      status: 'disabled',
      models: ['gpt-main'],
      rpmLimit: 60,
      tpmLimit: 100000,
      dailyTokenLimit: 500000,
      dailyCostLimit: 10,
      expiresAt: null
    });
  } finally {
    await Promise.all([adminPool.end(), gatewayRepository.dispose()]);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await seedLlmGatewayE2e();
}

function assertE2eDatabaseUrl(databaseUrl: string): void {
  if (process.env.LLM_GATEWAY_ALLOW_E2E_SEED === '1') {
    return;
  }

  const parsed = new URL(databaseUrl);
  const parts = [parsed.hostname, parsed.username, parsed.pathname.replace(/^\//, '')];
  if (parts.every(part => part.toLowerCase().includes('e2e'))) {
    return;
  }

  throw new Error(
    'Refusing to seed llm-gateway E2E data into a non-E2E database. Use an E2E database URL or set LLM_GATEWAY_ALLOW_E2E_SEED=1.'
  );
}
