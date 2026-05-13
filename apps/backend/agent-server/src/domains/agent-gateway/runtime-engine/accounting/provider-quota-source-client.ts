import { GatewayProviderQuotaSnapshotSchema } from '@agent/core';

import type {
  ProviderQuotaAuthFileProjection,
  ProviderQuotaInspectionRequest,
  ProviderQuotaInspector,
  ProviderQuotaInspectorProviderKind,
  ProviderQuotaScope,
  ProviderQuotaSnapshot,
  ProviderQuotaStatus,
  ProviderQuotaWindow
} from './provider-quota-inspector';

export type ProviderQuotaSourceErrorCode = 'unreadable' | 'account_expired' | 'permission_denied';

export interface ProviderQuotaSourceFetchRequest {
  providerKind: ProviderQuotaInspectorProviderKind;
  authFile: ProviderQuotaAuthFileProjection;
}

export interface ProviderQuotaSourceRecord {
  providerKind: ProviderQuotaInspectorProviderKind;
  authFileId: string;
  accountEmail?: string | null;
  model?: string | null;
  scope: ProviderQuotaScope;
  window: ProviderQuotaWindow;
  limit: number | null;
  used: number;
  resetAt: string | null;
}

export type ProviderQuotaSourceFetchResult =
  | { status: 'ok'; records: ProviderQuotaSourceRecord[] }
  | { status: 'error'; error: { code: ProviderQuotaSourceErrorCode; message: string } };

export interface ProviderQuotaSourceClient {
  fetchQuota(request: ProviderQuotaSourceFetchRequest): Promise<ProviderQuotaSourceFetchResult>;
}

export interface SourceBackedProviderQuotaInspectorOptions {
  now?: () => string;
}

export class SourceBackedProviderQuotaInspector implements ProviderQuotaInspector {
  readonly providerKind: ProviderQuotaInspectorProviderKind;
  private readonly now: () => string;

  constructor(
    providerKind: ProviderQuotaInspectorProviderKind,
    private readonly sourceClient: ProviderQuotaSourceClient,
    options: SourceBackedProviderQuotaInspectorOptions = {}
  ) {
    this.providerKind = providerKind;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async inspect(request: ProviderQuotaInspectionRequest): Promise<ProviderQuotaSnapshot[]> {
    const snapshots: ProviderQuotaSnapshot[] = [];
    for (const authFile of request.authFiles.filter(item => item.providerKind === this.providerKind)) {
      if (authFile.status && !['active', 'valid'].includes(authFile.status)) {
        snapshots.push(this.createUnknownSnapshot(authFile));
        continue;
      }

      const result = await this.sourceClient.fetchQuota({ providerKind: this.providerKind, authFile });
      if (result.status === 'error') {
        snapshots.push(this.createUnknownSnapshot(authFile));
        continue;
      }

      const records = result.records.filter(
        record => record.providerKind === this.providerKind && record.authFileId === authFile.id
      );
      snapshots.push(...this.aggregate(records));
    }
    return snapshots;
  }

  private aggregate(records: ProviderQuotaSourceRecord[]): ProviderQuotaSnapshot[] {
    const buckets = new Map<string, ProviderQuotaSourceRecord[]>();
    for (const record of records) {
      const key = [record.providerKind, record.authFileId, record.model ?? 'account', record.scope, record.window].join(
        ':'
      );
      buckets.set(key, [...(buckets.get(key) ?? []), record]);
    }

    return Array.from(buckets.values()).map(bucket => this.projectBucket(bucket));
  }

  private projectBucket(bucket: ProviderQuotaSourceRecord[]): ProviderQuotaSnapshot {
    const first = bucket[0];
    const limit = mergeLimit(bucket);
    const used = bucket.reduce((sum, record) => sum + record.used, 0);
    const remaining = limit === null ? null : Math.max(limit - used, 0);
    const snapshot: ProviderQuotaSnapshot = {
      id: `${first.providerKind}:${first.authFileId}:${first.model ?? first.scope}:${first.window}`,
      providerKind: first.providerKind,
      authFileId: first.authFileId,
      accountEmail: first.accountEmail ?? null,
      model: first.model ?? null,
      scope: first.scope,
      window: first.window,
      limit,
      used,
      remaining,
      resetAt: mergeResetAt(bucket),
      refreshedAt: this.now(),
      status: statusForQuota(limit, used, remaining),
      source: 'provider'
    };
    GatewayProviderQuotaSnapshotSchema.parse(snapshot);
    return snapshot;
  }

  private createUnknownSnapshot(authFile: ProviderQuotaAuthFileProjection): ProviderQuotaSnapshot {
    const snapshot: ProviderQuotaSnapshot = {
      id: `${this.providerKind}:${authFile.id}:account:unknown`,
      providerKind: this.providerKind,
      authFileId: authFile.id,
      accountEmail: authFile.accountEmail ?? null,
      model: null,
      scope: 'account',
      window: 'rolling',
      limit: null,
      used: 0,
      remaining: null,
      resetAt: null,
      refreshedAt: this.now(),
      status: 'unknown',
      source: 'provider'
    };
    GatewayProviderQuotaSnapshotSchema.parse(snapshot);
    return snapshot;
  }
}

function mergeLimit(records: ProviderQuotaSourceRecord[]): number | null {
  const limits = records.map(record => record.limit).filter((limit): limit is number => limit !== null);
  return limits.length ? Math.max(...limits) : null;
}

function mergeResetAt(records: ProviderQuotaSourceRecord[]): string | null {
  const resetTimes = records.map(record => record.resetAt).filter((resetAt): resetAt is string => resetAt !== null);
  return resetTimes.length ? resetTimes.sort()[0] : null;
}

function statusForQuota(limit: number | null, used: number, remaining: number | null): ProviderQuotaStatus {
  if (limit === null || remaining === null) return 'unknown';
  if (used >= limit) return 'exceeded';
  if (remaining / limit <= 0.2) return 'warning';
  return 'normal';
}
