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
      const logFormat = [
        '################################################',
        `Request original url: ${request.originalUrl}`,
        `Method: ${request.method}`,
        `IP: ${request.ip}`,
        `Status code: ${res.statusCode}`,
        `Duration: ${durationMs}ms`,
        `RequestId: ${context.requestId}`,
        `TraceId: ${context.traceId}`,
        `Params: ${JSON.stringify(sanitizeForLogging(request.params))}`,
        `Query: ${JSON.stringify(sanitizeForLogging(request.query))}`,
        `Headers: ${JSON.stringify(sanitizeForLogging({ authorization: request.headers.authorization, referer: request.headers.referer, userAgent: request.headers['user-agent'] }))}`,
        `Body: ${JSON.stringify(sanitizeForLogging(request.body))}`,
        '################################################'
      ].join('\n');

      if (res.statusCode >= 500) {
        this.logger.error(logFormat, {
          context: 'Request LoggerMiddleware',
          requestId: context.requestId,
          traceId: context.traceId
        });
      } else if (res.statusCode >= 400) {
        this.logger.warn(logFormat, {
          context: 'Request LoggerMiddleware',
          requestId: context.requestId,
          traceId: context.traceId
        });
      } else {
        this.logger.log(logFormat, {
          context: 'Request LoggerMiddleware',
          requestId: context.requestId,
          traceId: context.traceId
        });
      }
    });

    next();
  }
}
