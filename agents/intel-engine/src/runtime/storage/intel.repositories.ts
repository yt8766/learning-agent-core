import type Database from 'better-sqlite3';
import {
  IntelDailyDigestSchema,
  IntelDailyDigestSignalSchema,
  IntelDeliverySchema,
  IntelSignalSchema,
  IntelSignalSourceSchema,
  type IntelAlert,
  type IntelDailyDigest,
  type IntelDailyDigestSignal,
  type IntelDelivery,
  type IntelSignal,
  type IntelSignalSource
} from '../../types';

import { createIntelDatabase } from './intel-db';

export interface CreateIntelRepositoriesOptions {
  databaseFile: string;
}

export interface RawEventInsertInput {
  jobId: string;
  query: string;
  sourceName: string;
  sourceType: string;
  title: string;
  url: string;
  snippet: string;
  publishedAt: string;
  fetchedAt: string;
  contentHash: string;
}

export type SignalUpsertInput = IntelSignal;
export type AlertUpsertInput = IntelAlert;
export type SignalSourceInsertInput = IntelSignalSource;
export type DailyDigestInsertInput = IntelDailyDigest;
export type DailyDigestSignalInput = IntelDailyDigestSignal;
export type DeliveryInsertInput = IntelDelivery;

export interface ListSignalsByWindowInput {
  windowStart: string;
  windowEnd: string;
  statuses?: IntelSignal['status'][];
}

export interface ListSignalsInWindowInput {
  startAt: string;
  endAt: string;
  statuses?: IntelSignal['status'][];
}

export interface UpdateDeliveryStatusInput {
  id: string;
  now: string;
  failureReason?: string;
  nextRetryAt?: string;
}

const signalSelect = `SELECT id,dedupe_key AS dedupeKey,category,event_type AS eventType,title,summary,priority,confidence,status,first_seen_at AS firstSeenAt,last_seen_at AS lastSeenAt FROM signals`;
const sourceSelect = `SELECT id,signal_id AS signalId,content_hash AS contentHash,source_name AS sourceName,source_type AS sourceType,title,url,snippet,published_at AS publishedAt,fetched_at AS fetchedAt,created_at AS createdAt FROM signal_sources`;
const digestSignalSelect = `SELECT digest_id AS digestId,signal_id AS signalId,position,created_at AS createdAt FROM daily_digest_signals`;
const deliverySelect = `SELECT id,signal_id AS signalId,alert_id AS alertId,digest_id AS digestId,channel_type AS channelType,channel_target AS channelTarget,delivery_kind AS deliveryKind,delivery_status AS deliveryStatus,retry_count AS retryCount,status_version AS statusVersion,created_at AS createdAt,updated_at AS updatedAt,next_retry_at AS nextRetryAt,expires_at AS expiresAt,last_attempt_at AS lastAttemptAt,failure_reason AS failureReason,closed_at AS closedAt FROM deliveries`;

function parseMany<T>(schema: { parse(input: unknown): T }, rows: unknown[]): T[] {
  return rows.map(row => schema.parse(normalizeRow(row)));
}

function parseOne<T>(schema: { parse(input: unknown): T }, row: unknown): T | undefined {
  return row === undefined ? undefined : schema.parse(normalizeRow(row));
}

function normalizeRow(row: unknown): unknown {
  if (row === null || typeof row !== 'object' || Array.isArray(row)) {
    return row;
  }

  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value === null ? undefined : value]));
}

function createRawEventRepository(database: Database.Database) {
  const insert = database.prepare(
    `INSERT INTO raw_events (job_id, query, source_name, source_type, title, url, snippet, published_at, fetched_at, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(content_hash) DO UPDATE SET job_id = excluded.job_id, query = excluded.query, source_name = excluded.source_name, source_type = excluded.source_type, title = excluded.title, url = excluded.url, snippet = excluded.snippet, published_at = excluded.published_at, fetched_at = excluded.fetched_at`
  );
  const selectByHash = database.prepare(`SELECT id FROM raw_events WHERE content_hash = ?`);
  return {
    insert(input: RawEventInsertInput): number {
      insert.run(
        input.jobId,
        input.query,
        input.sourceName,
        input.sourceType,
        input.title,
        input.url,
        input.snippet,
        input.publishedAt,
        input.fetchedAt,
        input.contentHash
      );
      const row = selectByHash.get(input.contentHash) as { id: number } | undefined;
      if (!row) {
        throw new Error(`Failed to persist raw event for content hash: ${input.contentHash}`);
      }
      return Number(row.id);
    }
  };
}

function createSignalRepository(database: Database.Database) {
  const upsert = database.prepare(
    `INSERT INTO signals (id, dedupe_key, category, event_type, title, summary, priority, confidence, status, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET dedupe_key = excluded.dedupe_key, category = excluded.category, event_type = excluded.event_type, title = excluded.title, summary = excluded.summary, priority = excluded.priority, confidence = excluded.confidence, status = excluded.status, first_seen_at = excluded.first_seen_at, last_seen_at = excluded.last_seen_at`
  );
  return {
    upsert(input: SignalUpsertInput): string {
      upsert.run(
        input.id,
        input.dedupeKey,
        input.category,
        input.eventType,
        input.title,
        input.summary,
        input.priority,
        input.confidence,
        input.status,
        input.firstSeenAt,
        input.lastSeenAt
      );
      return input.id;
    },
    listByWindow(input: ListSignalsByWindowInput): IntelSignal[] {
      const statuses = input.statuses ?? [];
      const where = statuses.length ? ` AND status IN (${statuses.map(() => '?').join(', ')})` : '';
      const rows = database
        .prepare(
          `${signalSelect} WHERE last_seen_at >= ? AND last_seen_at < ?${where} ORDER BY last_seen_at ASC, id ASC`
        )
        .all(input.windowStart, input.windowEnd, ...statuses);
      return parseMany(IntelSignalSchema, rows);
    },
    listInWindow(input: ListSignalsInWindowInput): IntelSignal[] {
      return this.listByWindow({
        windowStart: input.startAt,
        windowEnd: input.endAt,
        statuses: input.statuses
      });
    },
    listByDedupeKeys(dedupeKeys: string[]): IntelSignal[] {
      const uniqueKeys = Array.from(new Set(dedupeKeys)).filter(Boolean);
      if (uniqueKeys.length === 0) {
        return [];
      }

      const placeholders = uniqueKeys.map(() => '?').join(', ');
      return parseMany(
        IntelSignalSchema,
        database
          .prepare(`${signalSelect} WHERE dedupe_key IN (${placeholders}) ORDER BY first_seen_at ASC, id ASC`)
          .all(...uniqueKeys)
      );
    }
  };
}

function createAlertRepository(database: Database.Database) {
  const upsert = database.prepare(
    `INSERT INTO alerts (id, signal_id, alert_level, alert_kind, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET signal_id = excluded.signal_id, alert_level = excluded.alert_level, alert_kind = excluded.alert_kind, status = excluded.status, created_at = excluded.created_at, updated_at = excluded.updated_at`
  );
  return {
    upsert(input: AlertUpsertInput): string {
      upsert.run(
        input.id,
        input.signalId,
        input.alertLevel,
        input.alertKind,
        input.status,
        input.createdAt,
        input.updatedAt
      );
      return input.id;
    }
  };
}

function createSignalSourceRepository(database: Database.Database) {
  const insert = database.prepare(
    `INSERT INTO signal_sources (id, signal_id, content_hash, source_name, source_type, title, url, snippet, published_at, fetched_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(signal_id, content_hash) DO UPDATE SET id = excluded.id, source_name = excluded.source_name, source_type = excluded.source_type, title = excluded.title, url = excluded.url, snippet = excluded.snippet, published_at = excluded.published_at, fetched_at = excluded.fetched_at, created_at = excluded.created_at`
  );
  const insertMany = database.transaction((inputs: SignalSourceInsertInput[]) => {
    for (const input of inputs) {
      insert.run(
        input.id,
        input.signalId,
        input.contentHash,
        input.sourceName,
        input.sourceType,
        input.title,
        input.url,
        input.snippet,
        input.publishedAt,
        input.fetchedAt,
        input.createdAt
      );
    }
  });
  return {
    insertMany(inputs: SignalSourceInsertInput[]): string[] {
      insertMany(inputs);
      return inputs.map(input => input.id);
    },
    listBySignal(signalId: string): IntelSignalSource[] {
      return parseMany(
        IntelSignalSourceSchema,
        database.prepare(`${sourceSelect} WHERE signal_id = ? ORDER BY created_at ASC, id ASC`).all(signalId)
      );
    },
    listBySignalIds(signalIds: string[]): IntelSignalSource[] {
      if (signalIds.length === 0) {
        return [];
      }

      const placeholders = signalIds.map(() => '?').join(', ');
      return parseMany(
        IntelSignalSourceSchema,
        database
          .prepare(
            `${sourceSelect} WHERE signal_id IN (${placeholders}) ORDER BY signal_id ASC, created_at ASC, id ASC`
          )
          .all(...signalIds)
      );
    }
  };
}

function createDailyDigestRepository(database: Database.Database) {
  const upsert = database.prepare(
    `INSERT INTO daily_digests (id, digest_date, group_key, title, summary, content_markdown, window_start, window_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET digest_date = excluded.digest_date, group_key = excluded.group_key, title = excluded.title, summary = excluded.summary, content_markdown = excluded.content_markdown, window_start = excluded.window_start, window_end = excluded.window_end, created_at = excluded.created_at, updated_at = excluded.updated_at`
  );
  const deleteMembership = database.prepare(`DELETE FROM daily_digest_signals WHERE digest_id = ?`);
  const insertMembership = database.prepare(
    `INSERT INTO daily_digest_signals (digest_id, signal_id, position, created_at) VALUES (?, ?, ?, ?)`
  );
  const replaceMembership = database.transaction((digestId: string, inputs: DailyDigestSignalInput[]) => {
    deleteMembership.run(digestId);
    for (const input of inputs) {
      insertMembership.run(input.digestId, input.signalId, input.position, input.createdAt);
    }
  });
  return {
    insert(input: DailyDigestInsertInput): string {
      upsert.run(
        input.id,
        input.digestDate,
        input.groupKey,
        input.title,
        input.summary,
        input.contentMarkdown,
        input.windowStart,
        input.windowEnd,
        input.createdAt,
        input.updatedAt
      );
      return input.id;
    },
    replaceSignalMembership(digestId: string, inputs: DailyDigestSignalInput[]): void {
      replaceMembership(digestId, inputs);
    },
    createDailyDigest(input: {
      id: string;
      digestDate: string;
      title: string;
      content: string;
      signalCount: number;
      highlightCount: number;
      createdAt: string;
    }): string {
      return this.insert({
        id: input.id,
        digestDate: input.digestDate,
        groupKey: 'daily',
        title: input.title,
        summary: `${input.highlightCount}/${input.signalCount} highlights`,
        contentMarkdown: input.content,
        windowStart: `${input.digestDate}T00:00:00.000Z`,
        windowEnd: `${input.digestDate}T23:59:59.999Z`,
        createdAt: input.createdAt,
        updatedAt: input.createdAt
      });
    },
    linkSignals(digestId: string, signalIds: string[]): void {
      this.replaceSignalMembership(
        digestId,
        signalIds.map((signalId, index) => ({
          digestId,
          signalId,
          position: index,
          createdAt: new Date().toISOString()
        }))
      );
    },
    listSignalMembership(digestId: string): IntelDailyDigestSignal[] {
      return parseMany(
        IntelDailyDigestSignalSchema,
        database.prepare(`${digestSignalSelect} WHERE digest_id = ? ORDER BY position ASC, signal_id ASC`).all(digestId)
      );
    },
    getById(digestId: string): IntelDailyDigest | undefined {
      return parseOne(
        IntelDailyDigestSchema,
        database
          .prepare(
            `SELECT id,digest_date AS digestDate,group_key AS groupKey,title,summary,content_markdown AS contentMarkdown,window_start AS windowStart,window_end AS windowEnd,created_at AS createdAt,updated_at AS updatedAt FROM daily_digests WHERE id = ?`
          )
          .get(digestId)
      );
    }
  };
}

function createDeliveryRepository(database: Database.Database) {
  const insert = database.prepare(
    `INSERT INTO deliveries (id, signal_id, alert_id, digest_id, channel_type, channel_target, delivery_kind, delivery_status, retry_count, status_version, created_at, updated_at, next_retry_at, expires_at, last_attempt_at, failure_reason, closed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const markSent = database.prepare(
    `UPDATE deliveries SET delivery_status = 'sent', updated_at = ?, last_attempt_at = ?, next_retry_at = NULL, failure_reason = NULL WHERE id = ?`
  );
  const markFailed = database.prepare(
    `UPDATE deliveries SET delivery_status = 'failed', retry_count = retry_count + 1, updated_at = ?, last_attempt_at = ?, next_retry_at = ?, failure_reason = ? WHERE id = ?`
  );
  const markClosed = database.prepare(
    `UPDATE deliveries SET delivery_status = 'closed', updated_at = ?, closed_at = ?, next_retry_at = NULL, failure_reason = ? WHERE id = ?`
  );
  return {
    insert(input: DeliveryInsertInput): string {
      insert.run(
        input.id,
        input.signalId,
        input.alertId ?? null,
        input.digestId ?? null,
        input.channelType,
        input.channelTarget,
        input.deliveryKind,
        input.deliveryStatus,
        input.retryCount,
        input.statusVersion ?? 1,
        input.createdAt,
        input.updatedAt ?? input.createdAt,
        input.nextRetryAt ?? null,
        input.expiresAt ?? null,
        input.lastAttemptAt ?? null,
        input.failureReason ?? null,
        input.closedAt ?? null
      );
      return input.id;
    },
    listPending(): IntelDelivery[] {
      return parseMany(
        IntelDeliverySchema,
        database
          .prepare(`${deliverySelect} WHERE delivery_status IN ('pending', 'failed') ORDER BY created_at ASC, id ASC`)
          .all()
      );
    },
    getById(id: string): IntelDelivery | undefined {
      return parseOne(IntelDeliverySchema, database.prepare(`${deliverySelect} WHERE id = ?`).get(id));
    },
    markSent(input: UpdateDeliveryStatusInput): void {
      markSent.run(input.now, input.now, input.id);
    },
    markFailed(input: UpdateDeliveryStatusInput): void {
      markFailed.run(input.now, input.now, input.nextRetryAt ?? null, input.failureReason ?? null, input.id);
    },
    markClosed(input: UpdateDeliveryStatusInput): void {
      markClosed.run(input.now, input.now, input.failureReason ?? null, input.id);
    }
  };
}

export interface IntelRepositories {
  rawEvents: ReturnType<typeof createRawEventRepository>;
  signals: ReturnType<typeof createSignalRepository>;
  alerts: ReturnType<typeof createAlertRepository>;
  signalSources: ReturnType<typeof createSignalSourceRepository>;
  dailyDigests: ReturnType<typeof createDailyDigestRepository>;
  deliveries: ReturnType<typeof createDeliveryRepository>;
}

export function createIntelRepositories(options: CreateIntelRepositoriesOptions): IntelRepositories {
  const database = createIntelDatabase(options.databaseFile);
  return {
    rawEvents: createRawEventRepository(database),
    signals: createSignalRepository(database),
    alerts: createAlertRepository(database),
    signalSources: createSignalSourceRepository(database),
    dailyDigests: createDailyDigestRepository(database),
    deliveries: createDeliveryRepository(database)
  };
}
