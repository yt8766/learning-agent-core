export const AUTH_SCHEMA_SQL = `
create table if not exists auth_users (
  id text primary key,
  username text not null unique,
  display_name text not null,
  global_roles text[] not null default array[]::text[],
  status text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists auth_sessions (
  id text primary key,
  user_id text not null references auth_users(id) on delete cascade,
  status text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists auth_refresh_tokens (
  id text primary key,
  session_id text not null references auth_sessions(id) on delete cascade,
  token_hash text not null unique,
  status text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  replaced_by_token_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
`;
