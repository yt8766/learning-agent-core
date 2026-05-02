export type KnowledgeRepositoryProviderConfig = { kind: 'memory' } | { kind: 'postgres'; databaseUrl: string };

export type KnowledgeVectorStoreProviderConfig =
  | { kind: 'memory' }
  | { kind: 'supabase-pgvector'; supabaseUrl: string; serviceRoleKey: string };

export interface KnowledgeProviderConfig {
  repository: KnowledgeRepositoryProviderConfig;
  vectorStore: KnowledgeVectorStoreProviderConfig;
}

export function resolveKnowledgeProviderConfig(env: Record<string, string | undefined>): KnowledgeProviderConfig {
  const normalizedEnv = normalizeKnowledgeProviderEnv(env);
  const repositoryKind = normalizedEnv.KNOWLEDGE_REPOSITORY ?? (normalizedEnv.DATABASE_URL ? 'postgres' : 'memory');
  const vectorStoreKind = normalizedEnv.KNOWLEDGE_VECTOR_STORE ?? 'memory';

  if (repositoryKind !== 'memory' && repositoryKind !== 'postgres') {
    throw new Error(`Unsupported KNOWLEDGE_REPOSITORY=${repositoryKind}`);
  }

  if (vectorStoreKind !== 'memory' && vectorStoreKind !== 'supabase-pgvector') {
    throw new Error(`Unsupported KNOWLEDGE_VECTOR_STORE=${vectorStoreKind}`);
  }

  const repository =
    repositoryKind === 'postgres'
      ? resolvePostgresRepository(normalizedEnv)
      : ({ kind: 'memory' } satisfies KnowledgeRepositoryProviderConfig);
  const vectorStore =
    vectorStoreKind === 'supabase-pgvector'
      ? resolveSupabaseVectorStore(normalizedEnv)
      : ({ kind: 'memory' } satisfies KnowledgeVectorStoreProviderConfig);

  return { repository, vectorStore };
}

function normalizeKnowledgeProviderEnv(env: Record<string, string | undefined>): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(env).map(([key, value]) => [key, normalizeEnvValue(value)]));
}

function normalizeEnvValue(value: string | undefined): string | undefined {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : undefined;
}

function resolvePostgresRepository(env: Record<string, string | undefined>): KnowledgeRepositoryProviderConfig {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required when KNOWLEDGE_REPOSITORY=postgres');
  }

  return { kind: 'postgres', databaseUrl: env.DATABASE_URL };
}

function resolveSupabaseVectorStore(env: Record<string, string | undefined>): KnowledgeVectorStoreProviderConfig {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when KNOWLEDGE_VECTOR_STORE=supabase-pgvector'
    );
  }

  return {
    kind: 'supabase-pgvector',
    supabaseUrl: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY
  };
}
