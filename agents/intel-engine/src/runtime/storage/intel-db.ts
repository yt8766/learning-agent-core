import path from 'node:path';

import Database from 'better-sqlite3';
import fs from 'fs-extra';

function ensureColumns(
  database: Database.Database,
  tableName: string,
  columns: Array<{ name: string; definition: string }>
): void {
  const existingColumns = new Set(
    (database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>).map(column => column.name)
  );

  for (const column of columns) {
    if (!existingColumns.has(column.name)) {
      database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${column.definition}`);
    }
  }
}

export function normalizeIntelDatabaseOpenError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (/better_sqlite3|better-sqlite3|NODE_MODULE_VERSION|different Node\.js version/i.test(message)) {
    const normalized = new Error(
      `Failed to open Intel SQLite database because better-sqlite3 was built for a different Node.js ABI. ` +
        `Please reinstall or rebuild workspace dependencies, then rerun pnpm verify. Original error: ${message}`
    ) as Error & { cause?: unknown };
    normalized.cause = error;
    return normalized;
  }

  return error instanceof Error ? error : new Error(message);
}

export function createIntelDatabase(databaseFile: string): Database.Database {
  fs.ensureDirSync(path.dirname(databaseFile));

  let database: Database.Database;
  try {
    database = new Database(databaseFile);
  } catch (error) {
    throw normalizeIntelDatabaseOpenError(error);
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS raw_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      query TEXT NOT NULL,
      source_name TEXT NOT NULL,
      source_type TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      snippet TEXT NOT NULL,
      published_at TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      content_hash TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS signals (
      id TEXT PRIMARY KEY,
      dedupe_key TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      event_type TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      priority TEXT NOT NULL,
      confidence TEXT NOT NULL,
      status TEXT NOT NULL,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS signal_sources (
      id TEXT PRIMARY KEY,
      signal_id TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      source_name TEXT NOT NULL,
      source_type TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      snippet TEXT NOT NULL,
      published_at TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(signal_id, content_hash)
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      signal_id TEXT NOT NULL,
      alert_level TEXT NOT NULL,
      alert_kind TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deliveries (
      id TEXT PRIMARY KEY,
      signal_id TEXT NOT NULL,
      alert_id TEXT,
      digest_id TEXT,
      channel_type TEXT NOT NULL,
      channel_target TEXT NOT NULL,
      delivery_kind TEXT NOT NULL,
      delivery_status TEXT NOT NULL,
      retry_count INTEGER NOT NULL,
      status_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT '',
      next_retry_at TEXT,
      expires_at TEXT,
      last_attempt_at TEXT,
      failure_reason TEXT,
      closed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS daily_digests (
      id TEXT PRIMARY KEY,
      digest_date TEXT NOT NULL,
      group_key TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      content_markdown TEXT NOT NULL,
      window_start TEXT NOT NULL,
      window_end TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(digest_date, group_key)
    );

    CREATE TABLE IF NOT EXISTS daily_digest_signals (
      digest_id TEXT NOT NULL,
      signal_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (digest_id, signal_id)
    );

    CREATE INDEX IF NOT EXISTS idx_signals_last_seen_at ON signals(last_seen_at);
    CREATE INDEX IF NOT EXISTS idx_signal_sources_signal_id ON signal_sources(signal_id);
    CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(delivery_status, next_retry_at, created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_deliveries_dedupe
      ON deliveries(signal_id, channel_target, delivery_kind, status_version);
    CREATE INDEX IF NOT EXISTS idx_daily_digests_date_group ON daily_digests(digest_date, group_key);
    CREATE INDEX IF NOT EXISTS idx_daily_digest_signals_digest_id ON daily_digest_signals(digest_id, position);
  `);

  ensureColumns(database, 'deliveries', [
    { name: 'digest_id', definition: 'digest_id TEXT' },
    { name: 'status_version', definition: 'status_version INTEGER NOT NULL DEFAULT 1' },
    { name: 'updated_at', definition: "updated_at TEXT NOT NULL DEFAULT ''" },
    { name: 'next_retry_at', definition: 'next_retry_at TEXT' },
    { name: 'expires_at', definition: 'expires_at TEXT' },
    { name: 'last_attempt_at', definition: 'last_attempt_at TEXT' },
    { name: 'failure_reason', definition: 'failure_reason TEXT' },
    { name: 'closed_at', definition: 'closed_at TEXT' }
  ]);

  return database;
}
