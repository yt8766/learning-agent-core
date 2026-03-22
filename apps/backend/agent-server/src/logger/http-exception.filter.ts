import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Request, Response } from 'express';

import { AppLoggerService } from './app-logger.service';
import { getRequestContext, RequestWithLogContext, sanitizeForLogging } from './logging.utils';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>() as RequestWithLogContext;
    const requestContext = getRequestContext(request);

    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : 'Internal Server Error';
    const normalizedResponse = sanitizeForLogging(exceptionResponse);
    const message = typeof normalizedResponse === 'string' ? normalizedResponse : JSON.stringify(normalizedResponse);

    const logFormat = [
      '################################################',
      `Request original url: ${request.originalUrl}`,
      `Method: ${request.method}`,
      `IP: ${request.ip}`,
      `RequestId: ${requestContext.requestId}`,
      `TraceId: ${requestContext.traceId}`,
      `Status code: ${status}`,
      `Response: ${message}`,
      '################################################'
    ].join('\n');

    this.logger.error(logFormat, {
      context: 'HttpExceptionFilter',
      requestId: requestContext.requestId,
      traceId: requestContext.traceId
    });

    response.status(status).json({
      code: status,
      timestamp: new Date().toISOString(),
      error: normalizedResponse,
      msg: status >= 500 ? 'Server Error' : 'Client Error',
      requestId: requestContext.requestId,
      traceId: requestContext.traceId
    });
  }
}
