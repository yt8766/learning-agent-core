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

describe('AppLoggerService', () => {
  beforeEach(() => {
    appendFileSyncMock.mockReset();
    mkdirSyncMock.mockReset();
    vi.restoreAllMocks();
    delete process.env.LOG_FORMAT;
    delete process.env.LOG_STACK_MAX;
    delete process.env.NODE_ENV;
  });

  it('writes pretty logs to console and the daily app log by default', async () => {
    process.env.NODE_ENV = 'test';
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { AppLoggerService } = await loadLoggerModule();

    const logger = new AppLoggerService();
    logger.log('hello world', 'RuntimeController');

    expect(mkdirSyncMock).toHaveBeenCalledWith(expect.stringContaining('/logs'), { recursive: true });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[RuntimeController] hello world'));
    expect(errorSpy).not.toHaveBeenCalled();
    expect(appendFileSyncMock).toHaveBeenCalledTimes(1);
    expect(appendFileSyncMock).toHaveBeenCalledWith(
      expect.stringContaining('/logs/app-'),
      expect.stringContaining('"message":"hello world"'),
      'utf8'
    );
  });

  it('writes json errors, truncates stack, and duplicates error lines into the error log', async () => {
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
    expect(appendFileSyncMock).toHaveBeenCalledTimes(2);
    expect(appendFileSyncMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('.error.log'),
      expect.stringContaining('"level":"error"'),
      'utf8'
    );
  });

  it('respects level filtering and normalizes nested metadata values', async () => {
    process.env.NODE_ENV = 'test';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { AppLoggerService } = await loadLoggerModule();

    const logger = new AppLoggerService();
    logger.setLogLevels(['warn']);
    logger.debug('skip me', { context: 'DebugContext' });
    logger.warn(
      { event: 'request.warned' },
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
        message: '{"event":"request.warned"}',
        extra: expect.stringContaining('...<truncated 505 chars>'),
        nested: {
          error: expect.objectContaining({
            name: 'Error',
            message: 'downstream failed'
          })
        }
      })
    );
  });
});
