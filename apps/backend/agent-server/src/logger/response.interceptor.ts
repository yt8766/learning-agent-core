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

    return next.handle().pipe(
      tap(data => {
        const logFormat = [
          '################################################',
          `Request original url: ${req.originalUrl}`,
          `Method: ${req.method}`,
          `IP: ${req.ip}`,
          `RequestId: ${requestContext.requestId}`,
          `TraceId: ${requestContext.traceId}`,
          `Response Data: ${JSON.stringify(sanitizeForLogging(data))}`,
          '################################################'
        ].join('\n');

        this.logger.log(logFormat, {
          context: 'Response LoggerInterceptor',
          requestId: requestContext.requestId,
          traceId: requestContext.traceId
        });
      })
    );
  }
}
