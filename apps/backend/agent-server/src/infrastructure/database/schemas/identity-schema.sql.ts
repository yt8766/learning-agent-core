export const IDENTITY_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS identity_users (
  id text PRIMARY KEY,
  username text NOT NULL UNIQUE,
  display_name text NOT NULL,
  global_roles text[] NOT NULL DEFAULT ARRAY['knowledge_user']::text[],
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS identity_users
  ADD COLUMN IF NOT EXISTS global_roles text[] NOT NULL DEFAULT ARRAY['knowledge_user']::text[];

CREATE TABLE IF NOT EXISTS identity_password_credentials (
  user_id text PRIMARY KEY REFERENCES identity_users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS identity_refresh_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES identity_users(id) ON DELETE CASCADE,
  token_hash text,
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS identity_refresh_sessions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE IF EXISTS identity_refresh_sessions
  ADD COLUMN IF NOT EXISTS token_hash text;

ALTER TABLE IF EXISTS identity_refresh_sessions
  ALTER COLUMN token_hash DROP NOT NULL;

ALTER TABLE IF EXISTS identity_refresh_sessions
  ADD COLUMN IF NOT EXISTS revocation_reason text;

CREATE TABLE IF NOT EXISTS identity_refresh_tokens (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES identity_refresh_sessions(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  replaced_by_token_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;
