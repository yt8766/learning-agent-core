import { HttpException } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { HttpExceptionFilter } from '../../src/logger/http-exception.filter';
import {
  ensureRequestContext,
  getRequestContext,
  markRequestErrorLogged,
  sanitizeForLogging
} from '../../src/logger/logging.utils';
import { LoggerMiddleware } from '../../src/logger/logger.middleware';
import { ResponseInterceptor } from '../../src/logger/response.interceptor';

describe('logging.utils', () => {
  it('creates and reuses request context from headers', () => {
    const req = {
      headers: {
        'x-request-id': 'req-1',
        traceparent: 'trace-1'
      }
    } as any;

    expect(ensureRequestContext(req)).toEqual({
      requestId: 'req-1',
      traceId: 'trace-1'
    });
    expect(getRequestContext(req)).toBe(req.logContext);
  });

  it('marks request context as error logged and redacts sensitive fields recursively', () => {
    const req = {
      headers: {
        'x-request-id': ['req-2'],
        'x-trace-id': 'trace-2'
      }
    } as any;

    markRequestErrorLogged(req);

    expect(req.logContext).toEqual({
      requestId: 'req-2',
      traceId: 'trace-2',
      errorLogged: true
    });
    expect(
      sanitizeForLogging({
        token: 'secret',
        nested: {
          authorization: 'Bearer top-secret'
        },
        items: [{ apiKey: 'abc' }, { safe: 'ok' }]
      })
    ).toEqual({
      token: '[REDACTED]',
      nested: {
        authorization: '[REDACTED]'
      },
      items: [{ apiKey: '[REDACTED]' }, { safe: 'ok' }]
    });
  });
});

describe('HttpExceptionFilter', () => {
  it('logs sanitized http exceptions and returns a client error payload', () => {
    const logger = {
      error: vi.fn()
    } as any;
    const filter = new HttpExceptionFilter(logger);
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const request = {
      method: 'POST',
      originalUrl: '/api/runtime/tasks',
      baseUrl: '/api/runtime',
      route: { path: '/tasks' },
      ip: '127.0.0.1',
      query: { keyword: 'diagnosis' },
      params: { id: 'task-1' },
      headers: {
        authorization: 'Bearer hidden',
        referer: 'https://example.com',
        'user-agent': 'vitest'
      }
    } as any;
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => request
      }),
      getClass: () => ({ name: 'RuntimeController' }),
      getHandler: () => ({ name: 'createTask' })
    } as any;

    filter.catch(new HttpException({ reason: 'invalid', token: 'secret' }, 400), host);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'request.failed',
        method: 'POST',
        route: '/api/runtime/tasks',
        response: { reason: 'invalid', token: '[REDACTED]' }
      }),
      expect.objectContaining({
        context: 'HttpExceptionFilter',
        requestId: expect.any(String),
        traceId: expect.any(String)
      })
    );
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 400,
        error: { reason: 'invalid', token: '[REDACTED]' },
        msg: 'Client Error',
        requestId: expect.any(String),
        traceId: expect.any(String)
      })
    );
    expect(request.logContext?.errorLogged).toBe(true);
  });

  it('handles unknown errors as server errors', () => {
    const logger = {
      error: vi.fn()
    } as any;
    const filter = new HttpExceptionFilter(logger);
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const request = {
      method: 'GET',
      originalUrl: '/api/runtime/tasks',
      headers: {}
    } as any;
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => request
      })
    } as any;

    filter.catch('boom', host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 500,
        error: 'Internal Server Error',
        msg: 'Server Error'
      })
    );
  });
});

describe('ResponseInterceptor', () => {
  it('logs object, array and scalar response summaries', async () => {
    const logger = {
      debug: vi.fn()
    } as any;
    const interceptor = new ResponseInterceptor(logger);
    const req = {
      method: 'GET',
      originalUrl: '/api/platform/console',
      headers: { 'x-request-id': 'req-3' }
    } as any;
    const context = {
      switchToHttp: () => ({
        getRequest: () => req
      }),
      getClass: () => ({ name: 'PlatformController' }),
      getHandler: () => ({ name: 'getConsole' })
    } as any;

    await lastValueFrom(interceptor.intercept(context, { handle: () => of({ token: 'secret', ok: true }) } as any));
    await lastValueFrom(interceptor.intercept(context, { handle: () => of(['a', 'b']) } as any));
    await lastValueFrom(interceptor.intercept(context, { handle: () => of('ok') } as any));

    expect(logger.debug).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        event: 'request.response',
        controller: 'PlatformController',
        handler: 'getConsole',
        responseSummary: {
          kind: 'object',
          keys: ['token', 'ok']
        }
      }),
      expect.objectContaining({
        context: 'Response LoggerInterceptor',
        requestId: 'req-3'
      })
    );
    expect(logger.debug).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        responseSummary: {
          kind: 'array',
          itemCount: 2
        }
      }),
      expect.any(Object)
    );
    expect(logger.debug).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        responseSummary: {
          kind: 'string',
          value: 'ok'
        }
      }),
      expect.any(Object)
    );
  });
});

describe('LoggerMiddleware', () => {
  it('logs successful GET requests without request body', () => {
    const logger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    } as any;
    const middleware = new LoggerMiddleware(logger);
    const listeners = new Map<string, () => void>();
    const req = {
      method: 'GET',
      originalUrl: '/api/runtime/tasks',
      baseUrl: '/api/runtime',
      route: { path: '/tasks' },
      ip: '127.0.0.1',
      params: { id: 'task-1' },
      query: { q: 'runtime' },
      body: { token: 'secret' },
      headers: {
        authorization: 'Bearer hidden',
        referer: 'https://example.com',
        'user-agent': 'vitest',
        'x-request-id': 'req-4'
      }
    } as any;
    const res = {
      statusCode: 200,
      setHeader: vi.fn(),
      on: vi.fn((event: string, handler: () => void) => {
        listeners.set(event, handler);
      })
    } as any;
    const next = vi.fn();

    middleware.use(req, res, next);
    listeners.get('finish')?.();

    expect(next).toHaveBeenCalledOnce();
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'req-4');
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'request.completed',
        method: 'GET',
        route: '/api/runtime/tasks',
        body: undefined
      }),
      expect.objectContaining({
        context: 'Request LoggerMiddleware',
        requestId: 'req-4'
      })
    );
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs warning for handled 5xx requests and error for unhandled 5xx requests', () => {
    const logger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    } as any;
    const middleware = new LoggerMiddleware(logger);
    const createResponse = (statusCode: number) => {
      const listeners = new Map<string, () => void>();
      return {
        listeners,
        response: {
          statusCode,
          setHeader: vi.fn(),
          on: vi.fn((event: string, handler: () => void) => {
            listeners.set(event, handler);
          })
        }
      };
    };

    const handledReq = {
      method: 'POST',
      originalUrl: '/api/runtime/tasks',
      params: {},
      query: {},
      body: { password: 'hidden' },
      headers: {
        'x-request-id': 'req-5',
        'x-trace-id': 'trace-5'
      }
    } as any;
    const handled = createResponse(503);
    middleware.use(handledReq, handled.response as any, vi.fn());
    markRequestErrorLogged(handledReq);
    handled.listeners.get('finish')?.();

    const failedReq = {
      method: 'POST',
      originalUrl: '/api/runtime/tasks',
      params: {},
      query: {},
      body: { password: 'hidden' },
      headers: {}
    } as any;
    const failed = createResponse(500);
    middleware.use(failedReq, failed.response as any, vi.fn());
    failed.listeners.get('finish')?.();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 503,
        body: { password: '[REDACTED]' }
      }),
      expect.objectContaining({
        requestId: 'req-5'
      })
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        body: { password: '[REDACTED]' }
      }),
      expect.objectContaining({
        context: 'Request LoggerMiddleware',
        requestId: expect.any(String)
      })
    );
  });

  it('logs 4xx requests as warnings', () => {
    const logger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    } as any;
    const middleware = new LoggerMiddleware(logger);
    const listeners = new Map<string, () => void>();
    const req = {
      method: 'POST',
      originalUrl: '/api/runtime/tasks',
      params: {},
      query: {},
      body: { apiKey: 'abc' },
      headers: {}
    } as any;
    const res = {
      statusCode: 422,
      setHeader: vi.fn(),
      on: vi.fn((event: string, handler: () => void) => {
        listeners.set(event, handler);
      })
    } as any;

    middleware.use(req, res, vi.fn());
    listeners.get('finish')?.();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 422,
        body: { apiKey: '[REDACTED]' }
      }),
      expect.objectContaining({
        context: 'Request LoggerMiddleware'
      })
    );
  });
});
