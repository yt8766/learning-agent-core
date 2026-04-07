import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Request, Response } from 'express';

import { AppLoggerService } from './app-logger.service';
import { getRequestContext, markRequestErrorLogged, RequestWithLogContext, sanitizeForLogging } from './logging.utils';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>() as RequestWithLogContext;
    const requestContext = getRequestContext(request);
    const contextualHost = host as ArgumentsHost & {
      getClass?: () => { name?: string };
      getHandler?: () => { name?: string };
    };

    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : 'Internal Server Error';
    const normalizedResponse = sanitizeForLogging(exceptionResponse);
    const message = typeof normalizedResponse === 'string' ? normalizedResponse : JSON.stringify(normalizedResponse);
    const route = request.route?.path ? `${request.baseUrl ?? ''}${String(request.route.path)}` : undefined;
    const errorPayload = {
      event: 'request.failed',
      method: request.method,
      url: request.originalUrl,
      route,
      controller: contextualHost.getClass?.()?.name,
      handler: contextualHost.getHandler?.()?.name,
      ip: request.ip,
      statusCode: status,
      requestId: requestContext.requestId,
      traceId: requestContext.traceId,
      query: sanitizeForLogging(request.query),
      params: sanitizeForLogging(request.params),
      headers: sanitizeForLogging({
        authorization: request.headers.authorization,
        referer: request.headers.referer,
        userAgent: request.headers['user-agent']
      }),
      response: normalizedResponse,
      errorName: exception instanceof Error ? exception.name : 'UnknownError',
      errorMessage: exception instanceof Error ? exception.message : message,
      stack: exception instanceof Error ? exception.stack : undefined,
      cause:
        exception instanceof Error && 'cause' in exception
          ? sanitizeForLogging((exception as Error & { cause?: unknown }).cause)
          : undefined
    };

    markRequestErrorLogged(request);
    this.logger.error(errorPayload, {
      context: 'HttpExceptionFilter',
      requestId: requestContext.requestId,
      traceId: requestContext.traceId,
      stack: exception instanceof Error ? exception.stack : undefined
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
