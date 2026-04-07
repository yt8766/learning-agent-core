import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { AppLoggerService } from './app-logger.service';
import { getRequestContext, RequestWithLogContext, sanitizeForLogging } from './logging.utils';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>() as RequestWithLogContext;
    const requestContext = getRequestContext(req);
    const controller = context.getClass().name;
    const handler = context.getHandler().name;

    return next.handle().pipe(
      tap(data => {
        const sanitized = sanitizeForLogging(data);
        const responseSummary = Array.isArray(sanitized)
          ? { kind: 'array', itemCount: sanitized.length }
          : sanitized && typeof sanitized === 'object'
            ? { kind: 'object', keys: Object.keys(sanitized as Record<string, unknown>).slice(0, 12) }
            : { kind: typeof sanitized, value: sanitized };

        this.logger.debug(
          {
            event: 'request.response',
            method: req.method,
            url: req.originalUrl,
            controller,
            handler,
            requestId: requestContext.requestId,
            traceId: requestContext.traceId,
            responseSummary
          },
          {
            context: 'Response LoggerInterceptor',
            requestId: requestContext.requestId,
            traceId: requestContext.traceId
          }
        );
      })
    );
  }
}
