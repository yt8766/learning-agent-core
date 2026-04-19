import { Injectable, LoggerService, LogLevel } from '@nestjs/common';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import * as chalk from 'chalk';
import { resolvePersistedLogChannels, type RuntimeLevel } from './log-persistence';

export interface LogMeta {
  context?: string;
  requestId?: string;
  traceId?: string;
  stack?: string;
  [key: string]: unknown;
}

type LogFormat = 'pretty' | 'json';
const DEFAULT_MAX_STACK_LENGTH = 8000;

@Injectable()
export class AppLoggerService implements LoggerService {
  private readonly logsDir: string;
  private currentLevel: RuntimeLevel = 'debug';
  private lastTimestamp = Date.now();
  private readonly format: LogFormat;

  constructor() {
    this.logsDir = resolve(__dirname, '..', '..', 'logs');
    mkdirSync(this.logsDir, { recursive: true });
    this.format = this.resolveFormat();
  }

  log(message: unknown, contextOrMeta?: string | LogMeta): void {
    this.write('info', message, contextOrMeta);
  }

  error(message: unknown, contextOrMeta?: string | LogMeta): void {
    this.write('error', message, contextOrMeta);
  }

  warn(message: unknown, contextOrMeta?: string | LogMeta): void {
    this.write('warn', message, contextOrMeta);
  }

  debug(message: unknown, contextOrMeta?: string | LogMeta): void {
    this.write('debug', message, contextOrMeta);
  }

  verbose(message: unknown, contextOrMeta?: string | LogMeta): void {
    this.write('verbose', message, contextOrMeta);
  }

  fatal(message: unknown, contextOrMeta?: string | LogMeta): void {
    this.write('error', message, contextOrMeta);
  }

  setLogLevels(levels: LogLevel[]): void {
    this.currentLevel = levels.includes('verbose')
      ? 'verbose'
      : levels.includes('debug')
        ? 'debug'
        : levels.includes('log')
          ? 'info'
          : levels.includes('warn')
            ? 'warn'
            : 'error';
  }

  private write(level: RuntimeLevel, message: unknown, contextOrMeta?: string | LogMeta): void {
    if (!shouldWrite(level, this.currentLevel)) {
      return;
    }

    const now = Date.now();
    const deltaMs = now - this.lastTimestamp;
    this.lastTimestamp = now;

    const meta =
      typeof contextOrMeta === 'string' ? { context: contextOrMeta } : (contextOrMeta ?? { context: 'Application' });
    const normalizedMessage = typeof message === 'string' ? message : JSON.stringify(normalizeLogValue(message));
    const timestamp = formatTimestamp(now);
    const context = meta.context ?? 'Application';
    const requestId = meta.requestId ? ` [requestId=${String(meta.requestId)}]` : '';
    const traceId = meta.traceId ? ` [traceId=${String(meta.traceId)}]` : '';
    const normalizedStack =
      typeof meta.stack === 'string' ? truncateString(meta.stack, resolveMaxStackLength()) : undefined;
    const stack = normalizedStack ? `\n${normalizedStack}` : '';
    const levelLabel = toNestLevel(level).padEnd(7, ' ');
    const record = {
      time: new Date(now).toISOString(),
      level,
      context,
      message: normalizedMessage,
      requestId: meta.requestId,
      traceId: meta.traceId,
      deltaMs,
      pid: process.pid,
      ...normalizeMetaFields(meta),
      ...(normalizedStack ? { stack: normalizedStack } : {})
    };
    const line =
      this.format === 'json'
        ? JSON.stringify(record)
        : `[Nest] ${String(process.pid).padStart(5, ' ')}  - ${timestamp} ${levelLabel} [${context}] ${normalizedMessage}${requestId}${traceId} +${deltaMs}ms${stack}`;

    writeConsole(level, levelLabel, context, normalizedMessage, requestId, traceId, deltaMs, stack, line, this.format);
    this.writeFile(level, message, meta, JSON.stringify(record));
  }

  private writeFile(level: RuntimeLevel, message: unknown, meta: LogMeta, line: string): void {
    const channels = resolvePersistedLogChannels({ level, message, meta });
    if (channels.length === 0) {
      return;
    }

    const date = formatDate(new Date());
    for (const channel of channels) {
      appendFileSync(join(this.logsDir, `${channel}-${date}.log`), `${line}\n`, 'utf8');
    }
  }

  private resolveFormat(): LogFormat {
    const explicit = process.env.LOG_FORMAT?.toLowerCase();
    if (explicit === 'json' || explicit === 'pretty') {
      return explicit;
    }
    return process.env.NODE_ENV === 'production' ? 'json' : 'pretty';
  }
}

function normalizeMetaFields(meta: LogMeta): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(meta)
      .filter(([key]) => !['context', 'requestId', 'traceId', 'stack'].includes(key))
      .map(([key, value]) => [key, normalizeLogValue(value)])
  );
}

function normalizeLogValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack ? truncateString(value.stack, resolveMaxStackLength()) : undefined,
      cause: 'cause' in value ? normalizeLogValue((value as Error & { cause?: unknown }).cause) : undefined
    };
  }

  if (Array.isArray(value)) {
    return value.map(item => normalizeLogValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, normalizeLogValue(item)])
    );
  }

  if (typeof value === 'string') {
    return truncateString(value, 4000);
  }

  return value;
}

function truncateString(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}...<truncated ${value.length - maxLength} chars>`;
}

function resolveMaxStackLength(): number {
  const parsed = Number(process.env.LOG_STACK_MAX ?? '');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_STACK_LENGTH;
}

function shouldWrite(level: RuntimeLevel, current: RuntimeLevel): boolean {
  const rank = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    verbose: 4
  } as const;

  return rank[level] <= rank[current];
}

function toNestLevel(level: RuntimeLevel): string {
  switch (level) {
    case 'error':
      return 'ERROR';
    case 'warn':
      return 'WARN';
    case 'debug':
      return 'DEBUG';
    case 'verbose':
      return 'VERBOSE';
    default:
      return 'LOG';
  }
}

function writeConsole(
  level: RuntimeLevel,
  levelLabel: string,
  context: string,
  message: string,
  requestId: string,
  traceId: string,
  deltaMs: number,
  stack: string,
  jsonLine: string,
  format: LogFormat
): void {
  if (format === 'json') {
    if (level === 'error') {
      console.error(jsonLine);
      return;
    }

    if (level === 'warn') {
      console.warn(jsonLine);
      return;
    }

    console.log(jsonLine);
    return;
  }

  const timestamp = formatTimestamp(Date.now());
  const appStr = chalk.green('[Nest]');
  const pidStr = chalk.green(String(process.pid).padStart(5, ' '));
  const coloredLevel = colorizeLevel(levelLabel);
  const contextStr = chalk.yellow(`[${context}]`);
  const diffStr = chalk.yellow(` +${deltaMs}ms`);
  const requestStr = requestId ? chalk.cyan(requestId) : '';
  const traceStr = traceId ? chalk.magenta(traceId) : '';
  const output = `${appStr} ${pidStr}  - ${timestamp} ${coloredLevel} ${contextStr} ${message}${requestStr}${traceStr}${diffStr}${stack}`;

  if (level === 'error') {
    console.error(output);
    return;
  }

  if (level === 'warn') {
    console.warn(output);
    return;
  }

  console.log(output);
}

function colorizeLevel(level: string): string {
  switch (level.trim()) {
    case 'ERROR':
      return chalk.red(level);
    case 'WARN':
      return chalk.yellow(level);
    case 'DEBUG':
      return chalk.magenta(level);
    case 'VERBOSE':
      return chalk.cyan(level);
    default:
      return chalk.green(level);
  }
}

function formatTimestamp(input: number): string {
  return new Date(input).toLocaleString();
}

function formatDate(input: Date): string {
  const year = input.getFullYear();
  const month = String(input.getMonth() + 1).padStart(2, '0');
  const day = String(input.getDate()).padStart(2, '0');
  return [year, month, day].join('-');
}
