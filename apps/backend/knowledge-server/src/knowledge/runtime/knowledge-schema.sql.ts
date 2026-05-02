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
  embedding_status text not null,
  vector_index_status text not null,
  keyword_index_status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, ordinal)
);
`;
