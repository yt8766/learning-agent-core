import { describe, expect, it } from 'vitest';

import { resolveKnowledgeProviderConfig } from '../../src/knowledge/knowledge-provider.config';

describe('resolveKnowledgeProviderConfig', () => {
  it('defaults to memory providers for local development and tests', () => {
    expect(resolveKnowledgeProviderConfig({})).toEqual({
      repository: { kind: 'memory' },
      vectorStore: { kind: 'memory' }
    });
  });

  it('uses postgres repository by default when DATABASE_URL is configured', () => {
    expect(
      resolveKnowledgeProviderConfig({
        DATABASE_URL: 'postgres://user:pass@localhost:5432/knowledge'
      })
    ).toEqual({
      repository: {
        kind: 'postgres',
        databaseUrl: 'postgres://user:pass@localhost:5432/knowledge'
      },
      vectorStore: { kind: 'memory' }
    });
  });

  it('requires DATABASE_URL when postgres repository mode is selected', () => {
    expect(() => resolveKnowledgeProviderConfig({ KNOWLEDGE_REPOSITORY: 'postgres' })).toThrow(
      'DATABASE_URL is required when KNOWLEDGE_REPOSITORY=postgres'
    );
  });

  it('requires Supabase credentials when supabase pgvector mode is selected', () => {
    expect(() => resolveKnowledgeProviderConfig({ KNOWLEDGE_VECTOR_STORE: 'supabase-pgvector' })).toThrow(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when KNOWLEDGE_VECTOR_STORE=supabase-pgvector'
    );
  });

  it('returns production providers when all env values are present', () => {
    expect(
      resolveKnowledgeProviderConfig({
        KNOWLEDGE_REPOSITORY: 'postgres',
        KNOWLEDGE_VECTOR_STORE: 'supabase-pgvector',
        DATABASE_URL: 'postgres://user:pass@localhost:5432/knowledge',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
      })
    ).toEqual({
      repository: {
        kind: 'postgres',
        databaseUrl: 'postgres://user:pass@localhost:5432/knowledge'
      },
      vectorStore: {
        kind: 'supabase-pgvector',
        supabaseUrl: 'https://example.supabase.co',
        serviceRoleKey: 'service-role-key'
      }
    });
  });

  it('normalizes selector values before resolving production providers', () => {
    expect(
      resolveKnowledgeProviderConfig({
        KNOWLEDGE_REPOSITORY: ' postgres ',
        KNOWLEDGE_VECTOR_STORE: ' supabase-pgvector ',
        DATABASE_URL: 'postgres://user:pass@localhost:5432/knowledge',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
      })
    ).toEqual({
      repository: {
        kind: 'postgres',
        databaseUrl: 'postgres://user:pass@localhost:5432/knowledge'
      },
      vectorStore: {
        kind: 'supabase-pgvector',
        supabaseUrl: 'https://example.supabase.co',
        serviceRoleKey: 'service-role-key'
      }
    });
  });

  it('treats blank DATABASE_URL as missing in postgres repository mode', () => {
    expect(() =>
      resolveKnowledgeProviderConfig({
        KNOWLEDGE_REPOSITORY: 'postgres',
        DATABASE_URL: '   '
      })
    ).toThrow('DATABASE_URL is required when KNOWLEDGE_REPOSITORY=postgres');
  });

  it('treats blank Supabase credentials as missing in supabase pgvector mode', () => {
    expect(() =>
      resolveKnowledgeProviderConfig({
        KNOWLEDGE_VECTOR_STORE: 'supabase-pgvector',
        SUPABASE_URL: '   ',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
      })
    ).toThrow('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when KNOWLEDGE_VECTOR_STORE=supabase-pgvector');

    expect(() =>
      resolveKnowledgeProviderConfig({
        KNOWLEDGE_VECTOR_STORE: 'supabase-pgvector',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: '   '
      })
    ).toThrow('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when KNOWLEDGE_VECTOR_STORE=supabase-pgvector');
  });
});
