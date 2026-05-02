export const KNOWLEDGE_SCHEMA_SQL = `
create table if not exists knowledge_bases (
  id text primary key,
  name text not null,
  description text not null default '',
  created_by_user_id text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists knowledge_base_members (
  knowledge_base_id text not null references knowledge_bases(id) on delete cascade,
  user_id text not null,
  role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (knowledge_base_id, user_id)
);

create table if not exists knowledge_uploads (
  upload_id text primary key,
  knowledge_base_id text not null references knowledge_bases(id) on delete cascade,
  filename text not null,
  size_bytes bigint not null,
  content_type text not null,
  object_key text not null,
  oss_url text not null,
  uploaded_by_user_id text not null,
  uploaded_at timestamptz not null default now()
);

create table if not exists knowledge_documents (
  id text primary key,
  workspace_id text not null,
  knowledge_base_id text not null references knowledge_bases(id) on delete cascade,
  upload_id text not null references knowledge_uploads(upload_id),
  object_key text not null,
  filename text not null,
  title text not null,
  source_type text not null,
  status text not null,
  version text not null,
  chunk_count integer not null default 0,
  embedded_chunk_count integer not null default 0,
  created_by text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists knowledge_document_jobs (
  id text primary key,
  document_id text not null references knowledge_documents(id) on delete cascade,
  status text not null,
  current_stage text not null,
  stages jsonb not null default '[]'::jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists knowledge_document_chunks (
  id text primary key,
  document_id text not null references knowledge_documents(id) on delete cascade,
  ordinal integer not null,
  content text not null,
  token_count integer not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding_status text not null,
  vector_index_status text not null,
  keyword_index_status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, ordinal)
);

alter table knowledge_document_chunks
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $knowledge_pgvector$
begin
  begin
    create extension if not exists vector;
  exception
    when undefined_file or feature_not_supported then
      raise notice 'pgvector extension is not available; skipping knowledge vector RPC contract';
      return;
  end;

  execute 'alter table knowledge_document_chunks add column if not exists embedding vector(1536)';

  execute $rpc$
create or replace function upsert_knowledge_chunks(
  knowledge_base_id text,
  document_id text,
  records jsonb,
  tenant_id text default null
) returns jsonb
language plpgsql
as $function$
declare
  record_item jsonb;
  upserted_count integer := 0;
  affected_count integer := 0;
begin
  for record_item in select value from jsonb_array_elements(records)
  loop
    insert into knowledge_document_chunks (
      id,
      document_id,
      ordinal,
      content,
      token_count,
      metadata,
      embedding,
      embedding_status,
      vector_index_status,
      keyword_index_status,
      created_at,
      updated_at
    )
    select
      record_item ->> 'chunk_id',
      upsert_knowledge_chunks.document_id,
      coalesce((record_item ->> 'ordinal')::integer, 0),
      coalesce(record_item ->> 'text', ''),
      coalesce((record_item ->> 'token_count')::integer, 0),
      coalesce(record_item -> 'metadata', '{}'::jsonb),
      case
        when record_item ? 'embedding' and jsonb_typeof(record_item -> 'embedding') <> 'null'
          then (record_item -> 'embedding')::text::vector
        else null
      end,
      case
        when record_item ? 'embedding' and jsonb_typeof(record_item -> 'embedding') <> 'null'
          then 'embedded'
        else 'pending'
      end,
      case
        when record_item ? 'embedding' and jsonb_typeof(record_item -> 'embedding') <> 'null'
          then 'indexed'
        else 'pending'
      end,
      'indexed',
      now(),
      now()
    where exists (
      select 1
      from knowledge_documents kd
      where kd.id = upsert_knowledge_chunks.document_id
        and kd.knowledge_base_id = upsert_knowledge_chunks.knowledge_base_id
        and (upsert_knowledge_chunks.tenant_id is null or kd.workspace_id = upsert_knowledge_chunks.tenant_id)
    )
    on conflict (id) do update set
      ordinal = excluded.ordinal,
      content = excluded.content,
      token_count = excluded.token_count,
      metadata = excluded.metadata,
      embedding = excluded.embedding,
      embedding_status = excluded.embedding_status,
      vector_index_status = excluded.vector_index_status,
      keyword_index_status = excluded.keyword_index_status,
      updated_at = excluded.updated_at;

    get diagnostics affected_count = row_count;
    upserted_count := upserted_count + affected_count;
  end loop;

  return jsonb_build_object('upserted_count', upserted_count);
end;
$function$;
$rpc$;

  execute $rpc$
create or replace function match_knowledge_chunks(
  knowledge_base_id text,
  embedding vector(1536),
  top_k integer,
  query_text text default null,
  filters jsonb default '{}'::jsonb,
  tenant_id text default null
) returns table (
  chunk_id text,
  document_id text,
  text text,
  score double precision,
  metadata jsonb
)
language sql
stable
as $function$
  select
    kdc.id as chunk_id,
    kdc.document_id,
    kdc.content as text,
    1 - (kdc.embedding <=> match_knowledge_chunks.embedding) as score,
    kdc.metadata
  from knowledge_document_chunks kdc
  join knowledge_documents kd on kd.id = kdc.document_id
  where kd.knowledge_base_id = match_knowledge_chunks.knowledge_base_id
    and (match_knowledge_chunks.tenant_id is null or kd.workspace_id = match_knowledge_chunks.tenant_id)
    and kdc.embedding is not null
    and (
      not (match_knowledge_chunks.filters ? 'documentIds')
      or kdc.document_id in (
        select document_id_filter.value
        from jsonb_array_elements_text(match_knowledge_chunks.filters -> 'documentIds') as document_id_filter(value)
      )
    )
  order by kdc.embedding <=> match_knowledge_chunks.embedding
  limit greatest(match_knowledge_chunks.top_k, 0)
$function$;
$rpc$;

  execute $rpc$
create or replace function delete_knowledge_document_chunks(
  knowledge_base_id text,
  document_id text,
  tenant_id text default null
) returns jsonb
language plpgsql
as $function$
declare
  deleted_count integer := 0;
begin
  delete from knowledge_document_chunks kdc
  using knowledge_documents kd
  where kd.id = kdc.document_id
    and kd.id = delete_knowledge_document_chunks.document_id
    and kd.knowledge_base_id = delete_knowledge_document_chunks.knowledge_base_id
    and (delete_knowledge_document_chunks.tenant_id is null or kd.workspace_id = delete_knowledge_document_chunks.tenant_id);

  get diagnostics deleted_count = row_count;

  return jsonb_build_object('deleted_count', deleted_count);
end;
$function$;
$rpc$;
end;
$knowledge_pgvector$;
`;
