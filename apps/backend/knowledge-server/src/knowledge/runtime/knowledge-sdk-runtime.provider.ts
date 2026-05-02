import type { FactoryProvider } from '@nestjs/common';
import { createDefaultKnowledgeSdkRuntime, type KnowledgeSdkRuntime } from '@agent/knowledge/node';

import { KNOWLEDGE_SDK_RUNTIME } from '../knowledge.tokens';
import type { PostgresKnowledgeClient } from '../repositories/knowledge-postgres.repository';
import { createKnowledgeDatabaseClient } from './knowledge-database.provider';
import { KNOWLEDGE_SCHEMA_SQL } from './knowledge-schema.sql';

const REQUIRED_ENV = [
  'DATABASE_URL',
  'KNOWLEDGE_CHAT_MODEL',
  'KNOWLEDGE_EMBEDDING_MODEL',
  'KNOWLEDGE_LLM_API_KEY'
] as const;

const SDK_ENV = [
  ...REQUIRED_ENV,
  'KNOWLEDGE_LLM_BASE_URL',
  'KNOWLEDGE_CHAT_MAX_TOKENS',
  'KNOWLEDGE_EMBEDDING_DIMENSIONS',
  'KNOWLEDGE_EMBEDDING_BATCH_SIZE'
] as const;

type RequiredEnvName = (typeof REQUIRED_ENV)[number];
type SdkEnvName = (typeof SDK_ENV)[number];
type KnowledgeSdkRuntimeEnv = Partial<Record<SdkEnvName, string | undefined>>;

export interface DisabledKnowledgeSdkRuntimeProviderValue {
  enabled: false;
  reason: 'missing_env';
  missingEnv: RequiredEnvName[];
  runtime: null;
}

export interface EnabledKnowledgeSdkRuntimeProviderValue {
  enabled: true;
  runtime: KnowledgeSdkRuntime;
}

export type KnowledgeSdkRuntimeProviderValue =
  | DisabledKnowledgeSdkRuntimeProviderValue
  | EnabledKnowledgeSdkRuntimeProviderValue;

export interface KnowledgeSdkRuntimeProviderOptions {
  env?: KnowledgeSdkRuntimeEnv;
  createClient?: () => PostgresKnowledgeClient;
}

export type KnowledgeSdkRuntimeProvider = FactoryProvider<KnowledgeSdkRuntimeProviderValue> & {
  useFactory: () => Promise<KnowledgeSdkRuntimeProviderValue>;
};

export class KnowledgeSdkRuntimeProviderConfigError extends Error {
  readonly missingEnv: RequiredEnvName[];

  constructor(message: string, options: { missingEnv?: RequiredEnvName[] } = {}) {
    super(message);
    this.name = 'KnowledgeSdkRuntimeProviderConfigError';
    this.missingEnv = options.missingEnv ?? [];
  }
}

interface PostgresRpcCall {
  sql: string;
  values: unknown[];
  unwrapSingleRow: boolean;
}

export function createKnowledgeSdkRuntimeProvider(
  options: KnowledgeSdkRuntimeProviderOptions = {}
): KnowledgeSdkRuntimeProvider {
  return {
    provide: KNOWLEDGE_SDK_RUNTIME,
    useFactory: async (): Promise<KnowledgeSdkRuntimeProviderValue> => {
      const env = readKnowledgeSdkRuntimeEnv(options.env ?? process.env);
      const missingEnv = REQUIRED_ENV.filter(name => !env[name]);

      if (!env.DATABASE_URL) {
        return { enabled: false as const, reason: 'missing_env' as const, missingEnv, runtime: null };
      }

      if (missingEnv.length > 0) {
        throw new KnowledgeSdkRuntimeProviderConfigError(
          `Knowledge SDK runtime env is incomplete: ${missingEnv.join(', ')}`,
          { missingEnv }
        );
      }

      const client = options.createClient?.() ?? createKnowledgeDatabaseClient({ databaseUrl: env.DATABASE_URL });
      await client.query(KNOWLEDGE_SCHEMA_SQL);

      return {
        enabled: true as const,
        runtime: createDefaultKnowledgeSdkRuntime({
          chat: {
            provider: 'openai-compatible',
            apiKey: env.KNOWLEDGE_LLM_API_KEY,
            model: env.KNOWLEDGE_CHAT_MODEL,
            baseURL: emptyToUndefined(env.KNOWLEDGE_LLM_BASE_URL),
            maxTokens: readOptionalInteger(env.KNOWLEDGE_CHAT_MAX_TOKENS, 'KNOWLEDGE_CHAT_MAX_TOKENS')
          },
          embedding: {
            provider: 'openai-compatible',
            apiKey: env.KNOWLEDGE_LLM_API_KEY,
            model: env.KNOWLEDGE_EMBEDDING_MODEL,
            baseURL: emptyToUndefined(env.KNOWLEDGE_LLM_BASE_URL),
            dimensions: readOptionalInteger(env.KNOWLEDGE_EMBEDDING_DIMENSIONS, 'KNOWLEDGE_EMBEDDING_DIMENSIONS'),
            batchSize: readOptionalInteger(env.KNOWLEDGE_EMBEDDING_BATCH_SIZE, 'KNOWLEDGE_EMBEDDING_BATCH_SIZE')
          },
          vectorStore: { client: createPostgresKnowledgeSdkRpcClient(client) }
        })
      };
    }
  };
}

export function createPostgresKnowledgeSdkRpcClient(client: PostgresKnowledgeClient) {
  return {
    async rpc(name: string, args: Record<string, unknown>) {
      try {
        const call = mapRpcCall(name, args);
        const result = await client.query(call.sql, call.values);
        return { data: call.unwrapSingleRow ? (result.rows[0] ?? null) : result.rows, error: null };
      } catch (error) {
        return { data: null, error };
      }
    }
  };
}

function readKnowledgeSdkRuntimeEnv(source: NodeJS.ProcessEnv | KnowledgeSdkRuntimeEnv): KnowledgeSdkRuntimeEnv {
  return Object.fromEntries(SDK_ENV.map(name => [name, emptyToUndefined(source[name])])) as KnowledgeSdkRuntimeEnv;
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readOptionalInteger(value: string | undefined, name: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new KnowledgeSdkRuntimeProviderConfigError(`${name} must be a positive integer.`);
  }
  return parsed;
}

function mapRpcCall(name: string, args: Record<string, unknown>): PostgresRpcCall {
  if (name === 'upsert_knowledge_chunks') {
    return {
      sql: 'select * from upsert_knowledge_chunks($1, $2, $3, $4::jsonb)',
      values: [
        args.tenant_id ?? null,
        requiredString(args, 'knowledge_base_id', name),
        requiredString(args, 'document_id', name),
        JSON.stringify(args.records ?? [])
      ],
      unwrapSingleRow: true
    };
  }

  if (name === 'match_knowledge_chunks') {
    return {
      sql: 'select * from match_knowledge_chunks($1, $2, $3, $4::vector, $5, $6::jsonb)',
      values: [
        args.tenant_id ?? null,
        requiredString(args, 'knowledge_base_id', name),
        args.query_text ?? null,
        toPgVector(args.embedding, name),
        args.top_k,
        JSON.stringify(args.filters ?? {})
      ],
      unwrapSingleRow: false
    };
  }

  if (name === 'delete_knowledge_document_chunks') {
    return {
      sql: 'select * from delete_knowledge_document_chunks($1, $2, $3)',
      values: [
        args.tenant_id ?? null,
        requiredString(args, 'knowledge_base_id', name),
        requiredString(args, 'document_id', name)
      ],
      unwrapSingleRow: true
    };
  }

  throw new Error(`Unsupported knowledge SDK RPC: ${name}`);
}

function requiredString(args: Record<string, unknown>, key: string, rpcName: string): string {
  const value = args[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${rpcName} requires ${key}`);
  }
  return value;
}

function toPgVector(value: unknown, rpcName: string): string {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'number' || !Number.isFinite(item))) {
    throw new Error(`${rpcName} requires a numeric embedding array`);
  }
  return `[${value.join(',')}]`;
}
