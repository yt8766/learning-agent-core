export const RUNTIME_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS workflow_runs (
  id varchar(64) PRIMARY KEY,
  "workflowId" varchar(128) NOT NULL,
  status varchar(32) NOT NULL,
  "startedAt" bigint NOT NULL,
  "completedAt" bigint,
  "inputData" jsonb,
  "traceData" jsonb
);

CREATE TABLE IF NOT EXISTS intel_search_runs (
  id text PRIMARY KEY,
  workspace_id text NOT NULL,
  run_kind text NOT NULL,
  status text NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  triggered_by text,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error jsonb
);

CREATE TABLE IF NOT EXISTS intel_search_queries (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES intel_search_runs(id) ON DELETE CASCADE,
  channel text NOT NULL,
  direction text NOT NULL,
  query text NOT NULL,
  provider text NOT NULL DEFAULT 'minimax-cli',
  status text NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  result_count integer NOT NULL DEFAULT 0,
  error jsonb
);

CREATE TABLE IF NOT EXISTS intel_raw_events (
  id text PRIMARY KEY,
  query_id text NOT NULL REFERENCES intel_search_queries(id) ON DELETE CASCADE,
  content_hash text NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  snippet text NOT NULL,
  published_at timestamptz,
  fetched_at timestamptz NOT NULL,
  source_name text NOT NULL,
  source_url text,
  source_group text NOT NULL,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(query_id, content_hash)
);

CREATE TABLE IF NOT EXISTS intel_signals (
  id text PRIMARY KEY,
  workspace_id text NOT NULL,
  stable_topic_key text NOT NULL,
  channel text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  priority text NOT NULL,
  confidence text NOT NULL,
  status text NOT NULL,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(workspace_id, stable_topic_key)
);

CREATE TABLE IF NOT EXISTS intel_signal_sources (
  id text PRIMARY KEY,
  signal_id text NOT NULL REFERENCES intel_signals(id) ON DELETE CASCADE,
  raw_event_id text REFERENCES intel_raw_events(id) ON DELETE SET NULL,
  source_name text NOT NULL,
  source_url text,
  url text NOT NULL,
  source_group text NOT NULL,
  snippet text NOT NULL,
  published_at timestamptz,
  captured_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS intel_daily_digests (
  id text PRIMARY KEY,
  workspace_id text NOT NULL,
  digest_date date NOT NULL,
  channel text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  content_markdown text NOT NULL,
  signal_count integer NOT NULL DEFAULT 0,
  highlight_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS intel_knowledge_candidates (
  id text PRIMARY KEY,
  signal_id text NOT NULL REFERENCES intel_signals(id) ON DELETE CASCADE,
  candidate_type text NOT NULL,
  decision text NOT NULL,
  decision_reason text NOT NULL,
  ttl_days integer,
  created_at timestamptz NOT NULL,
  review_status text NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS intel_knowledge_ingestions (
  id text PRIMARY KEY,
  candidate_id text NOT NULL REFERENCES intel_knowledge_candidates(id) ON DELETE CASCADE,
  status text NOT NULL,
  knowledge_base_id text,
  document_id text,
  chunk_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  attempted_at timestamptz NOT NULL,
  error jsonb
);

CREATE INDEX IF NOT EXISTS intel_signals_channel_last_seen_idx
  ON intel_signals(channel, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS intel_candidates_review_status_idx
  ON intel_knowledge_candidates(review_status, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_gateway_records (
  domain text NOT NULL,
  id text NOT NULL,
  record jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(domain, id)
);

CREATE TABLE IF NOT EXISTS agent_gateway_client_records (
  kind text NOT NULL,
  id text NOT NULL,
  client_id text NOT NULL,
  secret_hash text,
  record jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(kind, id)
);

CREATE INDEX IF NOT EXISTS agent_gateway_client_records_client_idx
  ON agent_gateway_client_records(kind, client_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS agent_gateway_client_records_secret_hash_idx
  ON agent_gateway_client_records(kind, secret_hash)
  WHERE secret_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS agent_gateway_secrets (
  namespace text NOT NULL,
  id text NOT NULL,
  secret_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(namespace, id)
);
`;
