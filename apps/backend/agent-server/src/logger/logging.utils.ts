import { randomUUID } from 'node:crypto';

import { Request } from 'express';

const REDACTED = '[REDACTED]';
const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'auth',
  'secret',
  'apiKey',
  'apikey'
]);

export interface RequestLogContext {
  requestId: string;
  traceId: string;
  errorLogged?: boolean;
}

export interface RequestWithLogContext extends Request {
  logContext?: RequestLogContext;
}

export function ensureRequestContext(req: RequestWithLogContext): RequestLogContext {
  const requestId = getHeader(req, 'x-request-id') ?? randomUUID();
  const traceId = getHeader(req, 'x-trace-id') ?? getHeader(req, 'traceparent') ?? requestId;

  req.logContext = { requestId, traceId };
  return req.logContext;
}

export function getRequestContext(req: RequestWithLogContext): RequestLogContext {
  return req.logContext ?? ensureRequestContext(req);
}

export function markRequestErrorLogged(req: RequestWithLogContext): void {
  const context = getRequestContext(req);
  context.errorLogged = true;
}

/**
 * Redacts known secret-shaped fields before values cross the logging boundary.
 * This is not an authorization guard or general-purpose sanitizer; callers must still avoid logging unsafe payloads.
 */
export function sanitizeForLogging<T>(value: T): T {
  return sanitizeValue(value) as T;
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item));
  }

  if (value && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, current] of Object.entries(value as Record<string, unknown>)) {
      sanitized[key] = isSensitiveKey(key) ? REDACTED : sanitizeValue(current);
    }
    return sanitized;
  }

  return value;
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase());
}

function getHeader(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  if (Array.isArray(value)) {
    return value[0];
  }
  return typeof value === 'string' ? value : undefined;
}
