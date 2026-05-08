create extension if not exists vector;

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
  stage text not null default 'uploaded',
  current_stage text not null,
  stages jsonb not null default '[]'::jsonb,
  progress jsonb not null default '{"percent":0}'::jsonb,
  error jsonb,
  error_code text,
  error_message text,
  attempts integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table knowledge_document_jobs
  add column if not exists stage text not null default 'uploaded';

alter table knowledge_document_jobs
  add column if not exists progress jsonb not null default '{"percent":0}'::jsonb;

alter table knowledge_document_jobs
  add column if not exists error jsonb;

alter table knowledge_document_jobs
  add column if not exists attempts integer not null default 1;

create table if not exists knowledge_document_chunks (
  id text primary key,
  document_id text not null references knowledge_documents(id) on delete cascade,
  ordinal integer not null,
  content text not null,
  token_count integer not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1024),
  embedding_status text not null,
  vector_index_status text not null,
  keyword_index_status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, ordinal)
);

alter table knowledge_document_chunks
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table knowledge_document_chunks
  add column if not exists embedding vector(1024);

create table if not exists knowledge_chat_conversations (
  id text primary key,
  user_id text not null,
  title text not null,
  active_model_profile_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists knowledge_chat_messages (
  id text primary key,
  conversation_id text not null references knowledge_chat_conversations(id) on delete cascade,
  user_id text not null,
  role text not null,
  content text not null,
  model_profile_id text,
  trace_id text,
  citations jsonb not null default '[]'::jsonb,
  route jsonb,
  diagnostics jsonb,
  feedback jsonb,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_chat_conversations_user_updated_idx
  on knowledge_chat_conversations (user_id, updated_at desc);

create index if not exists knowledge_chat_messages_conversation_created_idx
  on knowledge_chat_messages (conversation_id, created_at asc, id asc);

create table if not exists knowledge_eval_datasets (
  id text primary key,
  workspace_id text not null,
  name text not null,
  description text,
  tags jsonb not null default '[]'::jsonb,
  case_count integer not null default 0,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists knowledge_eval_cases (
  id text primary key,
  dataset_id text not null references knowledge_eval_datasets(id) on delete cascade,
  question text not null,
  expected_answer text,
  expected_document_ids jsonb not null default '[]'::jsonb,
  expected_chunk_ids jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  difficulty text not null default 'medium',
  source_trace_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists knowledge_eval_runs (
  id text primary key,
  workspace_id text not null,
  dataset_id text not null references knowledge_eval_datasets(id) on delete cascade,
  knowledge_base_ids jsonb not null default '[]'::jsonb,
  status text not null,
  retrieval_config_id text,
  prompt_template_id text,
  model_config_id text,
  case_count integer not null default 0,
  completed_case_count integer not null default 0,
  failed_case_count integer not null default 0,
  summary jsonb,
  failed_cases jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists knowledge_eval_case_results (
  id text primary key,
  run_id text not null references knowledge_eval_runs(id) on delete cascade,
  case_id text not null references knowledge_eval_cases(id) on delete cascade,
  status text not null,
  actual_answer text,
  citations jsonb not null default '[]'::jsonb,
  trace_id text,
  retrieval_metrics jsonb,
  generation_metrics jsonb,
  judge_result jsonb,
  failure_category text,
  error jsonb
);

create index if not exists knowledge_eval_datasets_workspace_updated_idx
  on knowledge_eval_datasets (workspace_id, updated_at desc);

create index if not exists knowledge_eval_runs_workspace_created_idx
  on knowledge_eval_runs (workspace_id, created_at desc);

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
  affected_rows integer := 0;
begin
  if upsert_knowledge_chunks.tenant_id is null or btrim(upsert_knowledge_chunks.tenant_id) = '' then
    raise exception 'tenant_id is required for upsert_knowledge_chunks';
  end if;

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
        and kd.workspace_id = upsert_knowledge_chunks.tenant_id
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
      updated_at = excluded.updated_at
    where knowledge_document_chunks.document_id = excluded.document_id;

    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then
      raise exception 'knowledge chunk upsert conflict for chunk_id=% document_id=%', record_item ->> 'chunk_id', document_id;
    end if;

    upserted_count := upserted_count + affected_rows;
  end loop;

  return jsonb_build_object('upserted_count', upserted_count);
end;
$function$;

create or replace function match_knowledge_chunks(
  knowledge_base_id text,
  embedding vector(1024),
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
language plpgsql
stable
as $function$
declare
  normalized_filters jsonb := coalesce(match_knowledge_chunks.filters, '{}'::jsonb);
begin
  if match_knowledge_chunks.tenant_id is null or btrim(match_knowledge_chunks.tenant_id) = '' then
    raise exception 'tenant_id is required for match_knowledge_chunks';
  end if;

  return query
  select
    kdc.id as chunk_id,
    kdc.document_id,
    kdc.content as text,
    1 - (kdc.embedding <=> match_knowledge_chunks.embedding) as score,
    kdc.metadata
  from knowledge_document_chunks kdc
  join knowledge_documents kd on kd.id = kdc.document_id
  where kd.knowledge_base_id = match_knowledge_chunks.knowledge_base_id
    and kd.workspace_id = match_knowledge_chunks.tenant_id
    and kdc.embedding is not null
    and (
      (
        (not (normalized_filters ? 'document_ids') or jsonb_array_length(coalesce(normalized_filters -> 'document_ids', '[]'::jsonb)) = 0)
        and (not (normalized_filters ? 'documentIds') or jsonb_array_length(coalesce(normalized_filters -> 'documentIds', '[]'::jsonb)) = 0)
      )
      or kdc.document_id in (
        select document_id_filter.value
        from jsonb_array_elements_text(coalesce(normalized_filters -> 'document_ids', '[]'::jsonb)) as document_id_filter(value)
      )
      or (
        not (normalized_filters ? 'document_ids')
        and kdc.document_id in (
          select document_id_filter.value
          from jsonb_array_elements_text(coalesce(normalized_filters -> 'documentIds', '[]'::jsonb)) as document_id_filter(value)
        )
      )
    )
    and (
      not (normalized_filters ? 'tags')
      or jsonb_array_length(coalesce(normalized_filters -> 'tags', '[]'::jsonb)) = 0
      or (kdc.metadata -> 'tags') ?| array(
        select tag_filter.value
        from jsonb_array_elements_text(coalesce(normalized_filters -> 'tags', '[]'::jsonb)) as tag_filter(value)
      )
    )
    and (
      not (normalized_filters ? 'metadata')
      or coalesce(normalized_filters -> 'metadata', '{}'::jsonb) = '{}'::jsonb
      or kdc.metadata @> (normalized_filters -> 'metadata')
    )
  order by kdc.embedding <=> match_knowledge_chunks.embedding
  limit greatest(match_knowledge_chunks.top_k, 0);
end;
$function$;

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
  if delete_knowledge_document_chunks.tenant_id is null or btrim(delete_knowledge_document_chunks.tenant_id) = '' then
    raise exception 'tenant_id is required for delete_knowledge_document_chunks';
  end if;

  delete from knowledge_document_chunks kdc
  using knowledge_documents kd
  where kd.id = kdc.document_id
    and kd.id = delete_knowledge_document_chunks.document_id
    and kd.knowledge_base_id = delete_knowledge_document_chunks.knowledge_base_id
    and kd.workspace_id = delete_knowledge_document_chunks.tenant_id;

  get diagnostics deleted_count = row_count;

  return jsonb_build_object('deleted_count', deleted_count);
end;
$function$;
