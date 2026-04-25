import { ZodError } from 'zod';

import {
  AdminRequestLogQuerySchema,
  type AdminDashboardResponse,
  type AdminRequestLogEntry,
  type AdminRequestLogListResponse,
  type AdminRequestLogQuery
} from '../contracts/admin-logs';
import { createPostgresAdminLogsStore } from '../repositories/postgres-admin-logs-store';

export interface AdminLogsStore {
  list(query: AdminRequestLogQuery): Promise<AdminRequestLogListResponse>;
  dashboard(query: AdminRequestLogQuery): Promise<AdminDashboardResponse>;
}

export interface CreateMemoryAdminLogsStoreOptions {
  logs?: AdminRequestLogEntry[];
}

let routeService: AdminLogsStore | null = null;

export function setAdminLogsRouteServiceForRoutes(service: AdminLogsStore | null): void {
  routeService = service;
}

export function getAdminLogsRouteServiceForRoutes(): AdminLogsStore {
  if (!routeService) {
    routeService = createDefaultAdminLogsStore();
  }

  return routeService;
}

export function createMemoryAdminLogsStore(options: CreateMemoryAdminLogsStoreOptions = {}): AdminLogsStore {
  const logs = options.logs ?? [];

  return {
    async list(query) {
      return { items: filterLogs(logs, query).slice(0, query.limit).map(redactLogEntry), nextCursor: null };
    },
    async dashboard(query) {
      return buildDashboard(filterLogs(logs, query));
    }
  };
}

export function parseAdminRequestLogQuery(url: string): AdminRequestLogQuery {
  const searchParams = new URL(url).searchParams;
  const input: Record<string, string> = {};

  for (const key of ['keyId', 'model', 'provider', 'status', 'limit']) {
    const value = searchParams.get(key);
    if (value) {
      input[key] = value;
    }
  }

  return AdminRequestLogQuerySchema.parse(input);
}

export async function listAdminRequestLogsForRoutes(query: AdminRequestLogQuery): Promise<AdminRequestLogListResponse> {
  return getAdminLogsRouteServiceForRoutes().list(query);
}

export async function getAdminDashboardForRoutes(query: AdminRequestLogQuery): Promise<AdminDashboardResponse> {
  return getAdminLogsRouteServiceForRoutes().dashboard(query);
}

export function buildDashboard(logs: AdminRequestLogEntry[]): AdminDashboardResponse {
  const requestCount = logs.length;
  const totals = logs.reduce(
    (summary, log) => ({
      totalTokens: summary.totalTokens + log.totalTokens,
      estimatedCost: summary.estimatedCost + log.estimatedCost,
      errorCount: summary.errorCount + (log.status === 'error' ? 1 : 0),
      latencyMs: summary.latencyMs + log.latencyMs
    }),
    { totalTokens: 0, estimatedCost: 0, errorCount: 0, latencyMs: 0 }
  );

  return {
    summary: {
      requestCount,
      totalTokens: totals.totalTokens,
      estimatedCost: roundCost(totals.estimatedCost),
      failureRate: requestCount === 0 ? 0 : totals.errorCount / requestCount,
      averageLatencyMs: requestCount === 0 ? 0 : Math.round(totals.latencyMs / requestCount)
    },
    topModels: topBy(logs, 'model').map(item => ({ model: item.key, ...item.rollup })),
    topKeys: topBy(logs, 'keyId').map(item => ({ keyId: item.key, ...item.rollup })),
    topProviders: topBy(logs, 'provider').map(item => ({ provider: item.key, ...item.rollup }))
  };
}

export function redactLogEntry(log: AdminRequestLogEntry): AdminRequestLogEntry {
  return {
    ...log,
    errorMessage: log.errorMessage ? redactSecretLikeText(log.errorMessage) : null
  };
}

export function adminLogsRouteErrorResponse(error: unknown): Response {
  if (error instanceof ZodError) {
    return errorResponse('admin_logs_bad_request', 'Admin logs query is invalid.', 400);
  }

  return errorResponse('admin_logs_request_failed', 'Admin logs request failed.', 500);
}

function createDefaultAdminLogsStore(): AdminLogsStore {
  if (process.env.DATABASE_URL) {
    return createPostgresAdminLogsStore(process.env.DATABASE_URL);
  }

  return createMemoryAdminLogsStore();
}

function filterLogs(logs: AdminRequestLogEntry[], query: AdminRequestLogQuery): AdminRequestLogEntry[] {
  return logs.filter(log => {
    if (query.keyId && log.keyId !== query.keyId) return false;
    if (query.model && log.model !== query.model) return false;
    if (query.provider && log.provider !== query.provider) return false;
    if (query.status && log.status !== query.status) return false;
    return true;
  });
}

function topBy(logs: AdminRequestLogEntry[], key: 'model' | 'keyId' | 'provider') {
  const rollups = new Map<string, { requestCount: number; totalTokens: number; estimatedCost: number }>();

  for (const log of logs) {
    const current = rollups.get(log[key]) ?? { requestCount: 0, totalTokens: 0, estimatedCost: 0 };
    rollups.set(log[key], {
      requestCount: current.requestCount + 1,
      totalTokens: current.totalTokens + log.totalTokens,
      estimatedCost: roundCost(current.estimatedCost + log.estimatedCost)
    });
  }

  return Array.from(rollups.entries())
    .map(([rollupKey, rollup]) => ({ key: rollupKey, rollup }))
    .sort(
      (left, right) =>
        right.rollup.estimatedCost - left.rollup.estimatedCost || right.rollup.requestCount - left.rollup.requestCount
    )
    .slice(0, 5);
}

function redactSecretLikeText(value: string): string {
  if (/(sk-|secret|api[_-]?key|token)/i.test(value)) {
    return '[redacted]';
  }

  return value;
}

function roundCost(value: number): number {
  return Number(value.toFixed(6));
}

function errorResponse(code: string, message: string, status: number): Response {
  return Response.json(
    {
      error: {
        code,
        message,
        type: 'admin_logs_error'
      }
    },
    { status }
  );
}
