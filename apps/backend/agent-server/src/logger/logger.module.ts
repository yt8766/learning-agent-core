import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { AppLoggerService } from './app-logger.service';
import { HttpExceptionFilter } from './http-exception.filter';
import { LoggerMiddleware } from './logger.middleware';
import { ResponseInterceptor } from './response.interceptor';

@Module({
  providers: [
    AppLoggerService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter
    }
  ],
  exports: [AppLoggerService]
})
export class LoggerModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
