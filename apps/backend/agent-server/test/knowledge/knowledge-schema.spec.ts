import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(
  join(process.cwd(), 'apps/backend/agent-server/src/knowledge/repositories/knowledge-schema.sql'),
  'utf8'
);

function tableDefinition(tableName: string): string {
  const match = schema.match(new RegExp(`create table if not exists ${tableName} \\([\\s\\S]*?\\n\\);`));
  if (!match) {
    throw new Error(`Missing table definition for ${tableName}`);
  }
  return match[0];
}

describe('knowledge database schema', () => {
  it('defines all production knowledge tables', () => {
    for (const table of [
      'knowledge_bases',
      'knowledge_documents',
      'knowledge_chunks',
      'knowledge_chat_messages',
      'knowledge_traces',
      'knowledge_eval_datasets',
      'knowledge_eval_runs',
      'knowledge_eval_results',
      'knowledge_auth_sessions'
    ]) {
      expect(schema).toContain(`create table if not exists ${table}`);
    }
  });

  it('keeps chunks compatible with pgvector retrieval', () => {
    expect(schema).toContain('create extension if not exists vector');
    expect(schema).toContain('embedding vector(1024)');
    expect(schema).toContain('knowledge_chunks_embedding_idx');
    expect(schema).toContain('using ivfflat (embedding vector_cosine_ops)');
  });

  it('uses tenant-scoped primary keys for business records', () => {
    expect(schema).toContain('primary key (tenant_id, id)');
    expect(schema).toContain('primary key (tenant_id, knowledge_base_id, id)');
  });

  it('persists refresh token rotation targets for auth sessions', () => {
    const sessions = tableDefinition('knowledge_auth_sessions');

    expect(sessions).toContain('rotated_to_session_id text');
    expect(sessions).toContain('primary key (id)');
    expect(sessions).not.toContain('tenant_id text not null');
  });

  it('indexes auth session refresh token hashes for refresh lookups', () => {
    expect(schema).toContain('create index if not exists knowledge_auth_sessions_refresh_token_hash_idx');
    expect(schema).toContain('on knowledge_auth_sessions (refresh_token_hash);');
  });

  it('keeps eval results aligned with KnowledgeEvalResultRecord', () => {
    const evalResults = tableDefinition('knowledge_eval_results');

    for (const column of [
      'id text not null',
      'tenant_id text not null',
      'run_id text not null',
      'case_id text not null',
      'status text not null',
      'question text not null',
      'actual_answer text not null',
      'retrieved_chunk_ids jsonb not null',
      'citations jsonb not null',
      'retrieval_metrics jsonb not null',
      'generation_metrics jsonb not null',
      'trace_id text',
      'error_message text',
      'created_at timestamptz not null',
      'updated_at timestamptz not null'
    ]) {
      expect(evalResults).toContain(column);
    }

    expect(evalResults).not.toContain('input jsonb not null');
    expect(evalResults).not.toContain('expected jsonb not null');
    expect(evalResults).not.toContain('actual jsonb not null');
    expect(evalResults).not.toMatch(/^ {2}metrics jsonb not null/m);
  });

  it('keeps eval runs aligned with KnowledgeEvalRunRecord metadata', () => {
    const evalRuns = tableDefinition('knowledge_eval_runs');

    expect(evalRuns).toContain("metadata jsonb not null default '{}'::jsonb");
    expect(evalRuns).toContain('created_by text');
    expect(evalRuns).not.toContain('created_by text not null');
  });
});
