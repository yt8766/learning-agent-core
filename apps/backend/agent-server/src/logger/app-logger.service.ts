import { Injectable, LoggerService, LogLevel } from '@nestjs/common';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import * as chalk from 'chalk';

export interface LogMeta {
  context?: string;
  requestId?: string;
  traceId?: string;
  stack?: string;
  [key: string]: unknown;
}

type RuntimeLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

@Injectable()
export class AppLoggerService implements LoggerService {
  private readonly logsDir: string;
  private currentLevel: RuntimeLevel = 'debug';
  private lastTimestamp = Date.now();

  constructor() {
    this.logsDir = join(process.cwd(), 'logs');
    mkdirSync(this.logsDir, { recursive: true });
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
    const normalizedMessage = typeof message === 'string' ? message : JSON.stringify(message, null, 2);
    const timestamp = formatTimestamp(now);
    const context = meta.context ?? 'Application';
    const requestId = meta.requestId ? ` [requestId=${String(meta.requestId)}]` : '';
    const traceId = meta.traceId ? ` [traceId=${String(meta.traceId)}]` : '';
    const stack = meta.stack ? `\n${String(meta.stack)}` : '';
    const levelLabel = toNestLevel(level).padEnd(7, ' ');
    const line = `[Nest] ${String(process.pid).padStart(5, ' ')}  - ${timestamp} ${levelLabel} [${context}] ${normalizedMessage}${requestId}${traceId} +${deltaMs}ms${stack}`;

    writeConsole(level, levelLabel, context, normalizedMessage, requestId, traceId, deltaMs, stack);
    this.writeFile(level, line);
  }

  private writeFile(level: RuntimeLevel, line: string): void {
    const date = formatDate(new Date());
    appendFileSync(join(this.logsDir, `app-${date}.log`), `${line}\n`, 'utf8');
    if (level === 'error') {
      appendFileSync(join(this.logsDir, `app-${date}.error.log`), `${line}\n`, 'utf8');
    }
  }
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
  stack: string
): void {
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
