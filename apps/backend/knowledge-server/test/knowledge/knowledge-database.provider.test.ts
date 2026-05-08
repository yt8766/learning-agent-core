import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { KNOWLEDGE_SCHEMA_SQL } from '../../src/knowledge/runtime/knowledge-schema.sql';

describe('createKnowledgeDatabaseClient', () => {
  it('loads pg Pool under CommonJS without relying on a default export', () => {
    class Pool {
      readonly connectionString: string;

      constructor(options: { connectionString: string }) {
        this.connectionString = options.connectionString;
      }
    }

    const { createKnowledgeDatabaseClient } = loadProviderModule(
      resolve(__dirname, '../../src/knowledge/runtime/knowledge-database.provider.ts'),
      { pg: { Pool } }
    );

    const client = createKnowledgeDatabaseClient({ databaseUrl: 'postgres://local/knowledge' });

    expect(client).toBeInstanceOf(Pool);
    expect(client).toMatchObject({ connectionString: 'postgres://local/knowledge' });
  });

  it('defines pgvector extension, embedding column, and vector RPC functions', () => {
    expect(KNOWLEDGE_SCHEMA_SQL).toContain('create extension if not exists vector');
    expect(KNOWLEDGE_SCHEMA_SQL).toContain('embedding vector(');
    expect(KNOWLEDGE_SCHEMA_SQL).toContain('create or replace function upsert_knowledge_chunks');
    expect(KNOWLEDGE_SCHEMA_SQL).toContain('create or replace function match_knowledge_chunks');
    expect(KNOWLEDGE_SCHEMA_SQL).toContain('create or replace function delete_knowledge_document_chunks');
    expect(KNOWLEDGE_SCHEMA_SQL).not.toContain('skipping knowledge vector RPC contract');
  });

  it('guards pgvector chunk upserts against cross-document chunk id conflicts', () => {
    expect(KNOWLEDGE_SCHEMA_SQL).toContain('where knowledge_document_chunks.document_id = excluded.document_id');
    expect(KNOWLEDGE_SCHEMA_SQL).toContain('get diagnostics affected_rows = row_count');
    expect(KNOWLEDGE_SCHEMA_SQL).toContain(
      "raise exception 'knowledge chunk upsert conflict for chunk_id=% document_id=%'"
    );
  });

  it('uses snake_case document_ids as the primary match_knowledge_chunks filter contract', () => {
    expect(KNOWLEDGE_SCHEMA_SQL).toContain("filters ? 'document_ids'");
    expect(KNOWLEDGE_SCHEMA_SQL).toContain("jsonb_array_elements_text(coalesce(normalized_filters -> 'document_ids'");
  });

  it('keeps camelCase documentIds only as a compatibility fallback for chunk matching', () => {
    expect(KNOWLEDGE_SCHEMA_SQL).toContain("filters ? 'document_ids'");
    expect(KNOWLEDGE_SCHEMA_SQL).toContain("filters ? 'documentIds'");
    expect(KNOWLEDGE_SCHEMA_SQL).toContain("not (normalized_filters ? 'document_ids')");
  });

  it('rejects missing tenant_id inside vector RPC functions instead of allowing a null wildcard', () => {
    expect(KNOWLEDGE_SCHEMA_SQL).toContain('tenant_id text default null');
    expect(KNOWLEDGE_SCHEMA_SQL).not.toContain(
      'tenant_id is null or kd.workspace_id = upsert_knowledge_chunks.tenant_id'
    );
    expect(KNOWLEDGE_SCHEMA_SQL).not.toContain(
      'tenant_id is null or kd.workspace_id = match_knowledge_chunks.tenant_id'
    );
    expect(KNOWLEDGE_SCHEMA_SQL).not.toContain(
      'tenant_id is null or kd.workspace_id = delete_knowledge_document_chunks.tenant_id'
    );
    expect(KNOWLEDGE_SCHEMA_SQL).toContain("raise exception 'tenant_id is required for upsert_knowledge_chunks'");
    expect(KNOWLEDGE_SCHEMA_SQL).toContain("raise exception 'tenant_id is required for match_knowledge_chunks'");
    expect(KNOWLEDGE_SCHEMA_SQL).toContain(
      "raise exception 'tenant_id is required for delete_knowledge_document_chunks'"
    );
    expect(KNOWLEDGE_SCHEMA_SQL).toContain('and kd.workspace_id = upsert_knowledge_chunks.tenant_id');
    expect(KNOWLEDGE_SCHEMA_SQL).toContain('and kd.workspace_id = match_knowledge_chunks.tenant_id');
    expect(KNOWLEDGE_SCHEMA_SQL).toContain('and kd.workspace_id = delete_knowledge_document_chunks.tenant_id');
  });

  it('pushes tags and metadata filters into match_knowledge_chunks', () => {
    expect(KNOWLEDGE_SCHEMA_SQL).toContain("filters ? 'tags'");
    expect(KNOWLEDGE_SCHEMA_SQL).toContain("kdc.metadata -> 'tags'");
    expect(KNOWLEDGE_SCHEMA_SQL).toContain("jsonb_array_elements_text(coalesce(normalized_filters -> 'tags'");
    expect(KNOWLEDGE_SCHEMA_SQL).toContain("filters ? 'metadata'");
    expect(KNOWLEDGE_SCHEMA_SQL).toContain("kdc.metadata @> (normalized_filters -> 'metadata')");
  });

  it('treats empty array and empty metadata filters as disabled pushdown filters', () => {
    expect(KNOWLEDGE_SCHEMA_SQL).toContain(
      "jsonb_array_length(coalesce(normalized_filters -> 'document_ids', '[]'::jsonb)) = 0"
    );
    expect(KNOWLEDGE_SCHEMA_SQL).toContain(
      "jsonb_array_length(coalesce(normalized_filters -> 'documentIds', '[]'::jsonb)) = 0"
    );
    expect(KNOWLEDGE_SCHEMA_SQL).toContain(
      "jsonb_array_length(coalesce(normalized_filters -> 'tags', '[]'::jsonb)) = 0"
    );
    expect(KNOWLEDGE_SCHEMA_SQL).toContain("coalesce(normalized_filters -> 'metadata', '{}'::jsonb) = '{}'::jsonb");
  });
});

function loadProviderModule(filePath: string, modules: Record<string, unknown>) {
  const source = readFileSync(filePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      allowSyntheticDefaultImports: true,
      esModuleInterop: false,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  }).outputText;
  const exports: Record<string, unknown> = {};
  const context = {
    exports,
    require: (specifier: string) => {
      if (specifier in modules) {
        return modules[specifier];
      }
      throw new Error(`Unexpected require: ${specifier}`);
    }
  };

  vm.runInNewContext(output, context, { filename: filePath });
  return exports as {
    createKnowledgeDatabaseClient(options: { databaseUrl: string }): unknown;
  };
}
