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
`;
