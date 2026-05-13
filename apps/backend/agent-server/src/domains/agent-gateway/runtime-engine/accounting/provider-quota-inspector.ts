import type { GatewayQuotaDetail, GatewayQuotaDetailListResponse } from '@agent/core';

export type ProviderQuotaInspectorProviderKind = 'codex' | 'claude' | 'gemini' | 'antigravity' | 'kimi';
export type ProviderQuotaWindow = '5h' | 'daily' | 'weekly' | 'monthly' | 'rolling';
export type ProviderQuotaScope = 'account' | 'project' | 'model' | 'apiKey';
export type ProviderQuotaSnapshotSource = 'provider' | 'authFile' | 'runtime' | 'import';
export type ProviderQuotaStatus = 'normal' | 'warning' | 'exceeded' | 'unknown' | 'error';

export interface ProviderQuotaWindowProjection {
  limit: number | null;
  used: number;
  resetAt: string | null;
}

export interface ProviderQuotaAuthFileProjection {
  id: string;
  providerKind: ProviderQuotaInspectorProviderKind | string;
  accountEmail?: string | null;
  projectId?: string | null;
  models?: string[];
  status?: string;
  error?: string;
  quota?: Partial<Record<'fiveHour' | ProviderQuotaWindow, ProviderQuotaWindowProjection>>;
}

export interface ProviderQuotaInspectionRequest {
  authFiles: ProviderQuotaAuthFileProjection[];
}

export interface ProviderQuotaSnapshot {
  id: string;
  providerKind: ProviderQuotaInspectorProviderKind;
  authFileId: string;
  accountEmail?: string | null;
  model?: string | null;
  scope: ProviderQuotaScope;
  window: ProviderQuotaWindow;
  limit: number | null;
  used: number;
  remaining: number | null;
  resetAt: string | null;
  refreshedAt: string;
  status: ProviderQuotaStatus;
  source: ProviderQuotaSnapshotSource;
}

export interface ProviderQuotaInspector {
  readonly providerKind: ProviderQuotaInspectorProviderKind;
  inspect(request: ProviderQuotaInspectionRequest): Promise<ProviderQuotaSnapshot[]>;
}

export interface DeterministicProviderQuotaInspectorOptions {
  now?: () => string;
  defaultModel?: string;
}

export class DeterministicProviderQuotaInspector implements ProviderQuotaInspector {
  readonly providerKind: ProviderQuotaInspectorProviderKind;
  private readonly now: () => string;
  private readonly defaultModel: string;

  constructor(
    providerKind: ProviderQuotaInspectorProviderKind,
    options: DeterministicProviderQuotaInspectorOptions = {}
  ) {
    this.providerKind = providerKind;
    this.now = options.now ?? (() => new Date().toISOString());
    this.defaultModel = options.defaultModel ?? `${providerKind}-model`;
  }

  async inspect(request: ProviderQuotaInspectionRequest): Promise<ProviderQuotaSnapshot[]> {
    return request.authFiles
      .filter(authFile => authFile.providerKind === this.providerKind)
      .flatMap(authFile => this.inspectAuthFile(authFile));
  }

  private inspectAuthFile(authFile: ProviderQuotaAuthFileProjection): ProviderQuotaSnapshot[] {
    if (authFile.status && !['valid', 'active'].includes(authFile.status)) {
      return [this.createUnknownSnapshot(authFile)];
    }

    const windows = normalizeQuotaWindows(authFile.quota);
    if (!windows.length) {
      return [this.createUnknownSnapshot(authFile)];
    }

    const models = authFile.models?.length ? authFile.models : [this.defaultModel];
    return windows.flatMap(([window, quota]) =>
      models.map(model => {
        const remaining = quota.limit === null ? null : Math.max(quota.limit - quota.used, 0);
        return {
          id: `${this.providerKind}:${authFile.id}:${model}:${window}`,
          providerKind: this.providerKind,
          authFileId: authFile.id,
          accountEmail: authFile.accountEmail ?? null,
          model,
          scope: 'model',
          window,
          limit: quota.limit,
          used: quota.used,
          remaining,
          resetAt: quota.resetAt,
          refreshedAt: this.now(),
          status: statusForQuota(quota.limit, quota.used, remaining),
          source: 'authFile'
        };
      })
    );
  }

  private createUnknownSnapshot(authFile: ProviderQuotaAuthFileProjection): ProviderQuotaSnapshot {
    return {
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
      source: 'authFile'
    };
  }
}

export function projectProviderQuotaSnapshots(snapshots: ProviderQuotaSnapshot[]): GatewayQuotaDetailListResponse {
  return {
    items: snapshots.map(snapshot => projectProviderQuotaSnapshot(snapshot))
  };
}

export function projectProviderQuotaSnapshot(snapshot: ProviderQuotaSnapshot): GatewayQuotaDetail {
  return {
    id: snapshot.id,
    providerId: snapshot.providerKind,
    model: snapshot.model ?? snapshot.accountEmail ?? snapshot.authFileId,
    scope: snapshot.scope,
    window: snapshot.window,
    limit: snapshot.limit ?? 0,
    used: snapshot.used,
    remaining: snapshot.remaining ?? 0,
    resetAt: snapshot.resetAt,
    refreshedAt: snapshot.refreshedAt,
    status: snapshot.status === 'unknown' || snapshot.status === 'error' ? 'warning' : snapshot.status
  };
}

function normalizeQuotaWindows(
  quota: ProviderQuotaAuthFileProjection['quota']
): Array<[ProviderQuotaWindow, ProviderQuotaWindowProjection]> {
  if (!quota) return [];
  const entries: Array<[ProviderQuotaWindow, ProviderQuotaWindowProjection | undefined]> = [
    ['5h', quota.fiveHour ?? quota['5h']],
    ['daily', quota.daily],
    ['weekly', quota.weekly],
    ['monthly', quota.monthly],
    ['rolling', quota.rolling]
  ];
  return entries.filter((entry): entry is [ProviderQuotaWindow, ProviderQuotaWindowProjection] => Boolean(entry[1]));
}

function statusForQuota(limit: number | null, used: number, remaining: number | null): ProviderQuotaStatus {
  if (limit === null || remaining === null) return 'unknown';
  if (used >= limit) return 'exceeded';
  if (remaining / limit <= 0.2) return 'warning';
  return 'normal';
}
