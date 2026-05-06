create extension if not exists vector;

create table if not exists knowledge_bases (
  id text not null,
  tenant_id text not null,
  name text not null,
  description text,
  visibility text not null,
  status text not null,
  tags jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (tenant_id, id)
);

create table if not exists knowledge_documents (
  id text not null,
  tenant_id text not null,
  knowledge_base_id text not null,
  title text not null,
  source_uri text,
  mime_type text,
  status text not null,
  metadata jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (tenant_id, knowledge_base_id, id)
);

create table if not exists knowledge_chunks (
  id text not null,
  tenant_id text not null,
  knowledge_base_id text not null,
  document_id text not null,
  text text not null,
  ordinal integer not null,
  token_count integer,
  embedding vector(1024),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (tenant_id, id)
);

create index if not exists knowledge_chunks_document_idx
  on knowledge_chunks (tenant_id, knowledge_base_id, document_id);

create index if not exists knowledge_chunks_embedding_idx
  on knowledge_chunks using ivfflat (embedding vector_cosine_ops);

create table if not exists knowledge_chat_messages (
  id text not null,
  tenant_id text not null,
  conversation_id text not null,
  role text not null,
  content text not null,
  knowledge_base_id text,
  citations jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (tenant_id, id)
);

create table if not exists knowledge_traces (
  id text not null,
  tenant_id text not null,
  operation text not null,
  status text not null,
  knowledge_base_ids jsonb not null default '[]'::jsonb,
  conversation_id text,
  message_id text,
  latency_ms integer,
  spans jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (tenant_id, id)
);

create table if not exists knowledge_eval_datasets (
  id text not null,
  tenant_id text not null,
  name text not null,
  tags jsonb not null default '[]'::jsonb,
  cases jsonb not null default '[]'::jsonb,
  created_by text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (tenant_id, id)
);

create table if not exists knowledge_eval_runs (
  id text not null,
  tenant_id text not null,
  dataset_id text not null,
  knowledge_base_id text,
  status text not null,
  metrics jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by text,
  error_message text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (tenant_id, id)
);

create table if not exists knowledge_eval_results (
  id text not null,
  tenant_id text not null,
  run_id text not null,
  case_id text not null,
  status text not null,
  question text not null,
  actual_answer text not null,
  retrieved_chunk_ids jsonb not null default '[]'::jsonb,
  citations jsonb not null default '[]'::jsonb,
  retrieval_metrics jsonb not null default '{}'::jsonb,
  generation_metrics jsonb not null default '{}'::jsonb,
  trace_id text,
  error_message text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (tenant_id, id)
);

create table if not exists knowledge_auth_sessions (
  id text not null,
  user_id text not null,
  refresh_token_hash text not null,
  rotated_to_session_id text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (id)
);

create index if not exists knowledge_auth_sessions_refresh_token_hash_idx
  on knowledge_auth_sessions (refresh_token_hash);
