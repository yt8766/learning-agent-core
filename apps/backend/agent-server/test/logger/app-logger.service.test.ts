import { beforeEach, describe, expect, it, vi } from 'vitest';

const appendFileSyncMock = vi.fn();
const mkdirSyncMock = vi.fn();

vi.mock('node:fs', () => ({
  appendFileSync: appendFileSyncMock,
  mkdirSync: mkdirSyncMock
}));

vi.mock('chalk', () => ({
  default: {
    green: (value: string) => value,
    yellow: (value: string) => value,
    cyan: (value: string) => value,
    magenta: (value: string) => value,
    red: (value: string) => value
  },
  green: (value: string) => value,
  yellow: (value: string) => value,
  cyan: (value: string) => value,
  magenta: (value: string) => value,
  red: (value: string) => value
}));

async function loadLoggerModule() {
  vi.resetModules();
  return import('../../src/logger/app-logger.service');
}

describe.sequential('AppLoggerService', () => {
  beforeEach(() => {
    appendFileSyncMock.mockReset();
    mkdirSyncMock.mockReset();
    vi.restoreAllMocks();
    delete process.env.LOG_FORMAT;
    delete process.env.LOG_STACK_MAX;
    delete process.env.NODE_ENV;
  });

  it('writes pretty logs to console and skips persisting ordinary info logs by default', async () => {
    process.env.NODE_ENV = 'test';
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { AppLoggerService } = await loadLoggerModule();

    const logger = new AppLoggerService();
    logger.log('hello world', 'RuntimeController');

    expect(mkdirSyncMock).toHaveBeenCalledWith(expect.stringContaining('/logs'), { recursive: true });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[RuntimeController] hello world'));
    expect(errorSpy).not.toHaveBeenCalled();
    expect(appendFileSyncMock).not.toHaveBeenCalled();
  });

  it('writes logs into the backend logs directory even when cwd points elsewhere', async () => {
    process.env.NODE_ENV = 'test';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/tmp/codex-test-root');
    const { AppLoggerService } = await loadLoggerModule();

    const logger = new AppLoggerService();
    logger.warn({ event: 'runtime.schedule.tick_failed', statusCode: 503 }, { context: 'RuntimeScheduleService' });

    const expectedLogsDirSuffix = '/apps/backend/agent-server/logs';
    expect(cwdSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(mkdirSyncMock).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`${expectedLogsDirSuffix}$`)), {
      recursive: true
    });
    expect(appendFileSyncMock).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`${expectedLogsDirSuffix}/warn-`)),
      expect.stringContaining('"level":"warn"'),
      'utf8'
    );
  });

  it('writes json errors, truncates stack, and routes error lines into the error log', async () => {
    process.env.LOG_FORMAT = 'json';
    process.env.LOG_STACK_MAX = '10';
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { AppLoggerService } = await loadLoggerModule();

    const logger = new AppLoggerService();
    logger.error('request failed', {
      context: 'HttpExceptionFilter',
      requestId: 'req-1',
      traceId: 'trace-1',
      stack: '0123456789abcdefghij'
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const jsonLine = errorSpy.mock.calls[0]?.[0];
    expect(typeof jsonLine).toBe('string');
    expect(JSON.parse(String(jsonLine))).toEqual(
      expect.objectContaining({
        level: 'error',
        context: 'HttpExceptionFilter',
        message: 'request failed',
        requestId: 'req-1',
        traceId: 'trace-1',
        stack: '0123456789...<truncated 10 chars>'
      })
    );
    expect(appendFileSyncMock).toHaveBeenCalledTimes(1);
    expect(appendFileSyncMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/logs/error-'),
      expect.stringContaining('"level":"error"'),
      'utf8'
    );
  });

  it('routes audit and performance events into dedicated log files and normalizes nested metadata values', async () => {
    process.env.NODE_ENV = 'test';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { AppLoggerService } = await loadLoggerModule();

    const logger = new AppLoggerService();
    logger.setLogLevels(['warn']);
    logger.debug('skip me', { context: 'DebugContext' });
    logger.warn(
      { event: 'approval-policy.revoked' },
      {
        context: 'LoggerMiddleware',
        extra: 'x'.repeat(4505),
        nested: {
          error: new Error('downstream failed')
        }
      }
    );

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(appendFileSyncMock).toHaveBeenCalledTimes(1);

    const persistedLine = appendFileSyncMock.mock.calls[0]?.[1];
    const record = JSON.parse(String(persistedLine).trim());

    expect(record).toEqual(
      expect.objectContaining({
        level: 'warn',
        context: 'LoggerMiddleware',
        message: '{"event":"approval-policy.revoked"}',
        extra: expect.stringContaining('...<truncated 505 chars>'),
        nested: {
          error: expect.objectContaining({
            name: 'Error',
            message: 'downstream failed'
          })
        }
      })
    );
    expect(String(appendFileSyncMock.mock.calls[0]?.[0])).toContain('/logs/audit-');

    appendFileSyncMock.mockReset();
    logger.setLogLevels(['log']);
    logger.log(
      {
        event: 'runtime.platform_console.fresh_aggregate',
        totalDurationMs: 480,
        timingsMs: { total: 480 }
      },
      { context: 'RuntimeCentersQueryService' }
    );

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(String(appendFileSyncMock.mock.calls[0]?.[0])).toContain('/logs/performance-');
    expect(appendFileSyncMock.mock.calls[0]?.[2]).toBe('utf8');
    expect(JSON.parse(String(appendFileSyncMock.mock.calls[0]?.[1]).trim())).toEqual(
      expect.objectContaining({
        level: 'info',
        context: 'RuntimeCentersQueryService',
        message: expect.stringContaining('"event":"runtime.platform_console.fresh_aggregate"')
      })
    );
  });
});
