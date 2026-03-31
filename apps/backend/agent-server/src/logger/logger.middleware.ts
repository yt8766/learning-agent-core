import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

import { AppLoggerService } from './app-logger.service';
import { ensureRequestContext, RequestWithLogContext, sanitizeForLogging } from './logging.utils';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: AppLoggerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const request = req as RequestWithLogContext;
    const startedAt = Date.now();
    const context = ensureRequestContext(request);

    res.setHeader('x-request-id', context.requestId);
    res.setHeader('x-trace-id', context.traceId);

    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      const route = request.route?.path ? `${request.baseUrl ?? ''}${String(request.route.path)}` : undefined;
      const payload = {
        event: 'request.completed',
        method: request.method,
        url: request.originalUrl,
        route,
        ip: request.ip,
        statusCode: res.statusCode,
        durationMs,
        requestId: context.requestId,
        traceId: context.traceId,
        params: sanitizeForLogging(request.params),
        query: sanitizeForLogging(request.query),
        headers: sanitizeForLogging({
          authorization: request.headers.authorization,
          referer: request.headers.referer,
          userAgent: request.headers['user-agent']
        }),
        body: request.method === 'GET' ? undefined : sanitizeForLogging(request.body)
      };

      if (res.statusCode >= 500) {
        if (context.errorLogged) {
          this.logger.warn(payload, {
            context: 'Request LoggerMiddleware',
            requestId: context.requestId,
            traceId: context.traceId
          });
          return;
        }
        this.logger.error(payload, {
          context: 'Request LoggerMiddleware',
          requestId: context.requestId,
          traceId: context.traceId
        });
      } else if (res.statusCode >= 400) {
        this.logger.warn(payload, {
          context: 'Request LoggerMiddleware',
          requestId: context.requestId,
          traceId: context.traceId
        });
      } else {
        this.logger.log(payload, {
          context: 'Request LoggerMiddleware',
          requestId: context.requestId,
          traceId: context.traceId
        });
      }
    });

    next();
  }
}
