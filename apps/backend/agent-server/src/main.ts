import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { MetadataScanner, ModulesContainer, NestFactory } from '@nestjs/core';
import * as chalk from 'chalk';

import { AppModule } from './app.module';
import { createCorsOptions } from './cors/cors-options';
import { AppLoggerService } from './logger/app-logger.service';

const REQUEST_METHOD_LABEL: Record<number, string> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.DELETE]: 'DELETE',
  [RequestMethod.PATCH]: 'PATCH',
  [RequestMethod.ALL]: 'ALL',
  [RequestMethod.OPTIONS]: 'OPTIONS',
  [RequestMethod.HEAD]: 'HEAD',
  [RequestMethod.SEARCH]: 'SEARCH'
};

process.on('uncaughtException', error => {
  const stack = error instanceof Error ? (error.stack ?? error.message) : String(error);
  writeBootstrapLine('ERROR', 'NestFactory', 'Uncaught exception', stack);
});

process.on('unhandledRejection', reason => {
  const stack = reason instanceof Error ? (reason.stack ?? reason.message) : String(reason);
  writeBootstrapLine('ERROR', 'NestFactory', 'Unhandled rejection', stack);
});

async function bootstrap(): Promise<void> {
  let port = Number(process.env.PORT ?? 3000);
  writeBootstrapLine('LOG', 'NestFactory', 'Starting Nest application...');
  try {
    const app = await NestFactory.create(AppModule, {
      logger: false,
      abortOnError: false
    });
    port = Number(process.env.PORT ?? 3000);
    const host = process.env.HOST ?? '127.0.0.1';
    const globalPrefix = process.env.API_PREFIX ?? 'api';

    const logger = app.get(AppLoggerService);
    app.useLogger(logger);
    app.setGlobalPrefix(globalPrefix);
    app.enableCors(createCorsOptions());

    const modules = app.get(ModulesContainer);
    logInitializedModules(modules, logger);
    logMappedRoutes(modules, logger, globalPrefix);

    await app.listen(port, host);
    writeBootstrapLine('LOG', 'NestFactory', 'HTTP 服务已就绪', `Application is running on: http://${host}:${port}`);
  } catch (error) {
    const stack = error instanceof Error ? (error.stack ?? error.message) : String(error);
    console.error(error);
    writeBootstrapLine('ERROR', 'NestFactory', 'Nest application failed to start', stack);

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'EADDRINUSE'
    ) {
      writeBootstrapLine(
        'ERROR',
        'NestFactory',
        `端口 ${port} 已被占用（EADDRINUSE）`,
        '请关闭仍占用该端口的 Node/Nest 进程，或改用其他端口：PowerShell 使用 $env:PORT=3001，cmd 使用 set PORT=3001。'
      );
    }

    process.exitCode = 1;
  }
}

function logInitializedModules(modules: ModulesContainer, logger: AppLoggerService): void {
  const moduleNames = [...modules.values()]
    .map(moduleRef => moduleRef.metatype?.name)
    .filter((name): name is string => Boolean(name))
    .filter(name => !name.startsWith('Internal'));

  const uniqueNames = [...new Set(moduleNames)].sort((left, right) => {
    if (left === 'AppModule') return -1;
    if (right === 'AppModule') return 1;
    if (left === 'LoggerModule') return -1;
    if (right === 'LoggerModule') return 1;
    return left.localeCompare(right);
  });

  for (const name of uniqueNames) {
    logger.log(`${name} dependencies initialized`, 'InstanceLoader');
  }
}

function logMappedRoutes(modules: ModulesContainer, logger: AppLoggerService, globalPrefix: string): void {
  const scanner = new MetadataScanner();
  const routeGroups: Array<{
    controllerName: string;
    controllerPath: string;
    routes: Array<{ path: string; method: string }>;
  }> = [];

  for (const moduleRef of modules.values()) {
    for (const controllerRef of moduleRef.controllers.values()) {
      const metatype = controllerRef.metatype;
      const instance = controllerRef.instance;
      if (!metatype || !instance) {
        continue;
      }

      const controllerPath = normalizePath(Reflect.getMetadata(PATH_METADATA, metatype));
      const prototype = Object.getPrototypeOf(instance) as Record<string, (...args: unknown[]) => unknown>;
      const routes: Array<{ path: string; method: string }> = [];

      for (const methodName of scanner.getAllMethodNames(prototype)) {
        const handler = prototype[methodName];
        const routePath = Reflect.getMetadata(PATH_METADATA, handler);
        const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler);
        if (routePath === undefined || requestMethod === undefined) {
          continue;
        }

        const paths = Array.isArray(routePath) ? routePath : [routePath];
        for (const currentPath of paths) {
          routes.push({
            path: joinRoute(`/${globalPrefix}`, controllerPath, normalizePath(currentPath)),
            method: REQUEST_METHOD_LABEL[requestMethod] ?? 'GET'
          });
        }
      }

      if (routes.length > 0) {
        routeGroups.push({
          controllerName: metatype.name,
          controllerPath: joinRoute(`/${globalPrefix}`, controllerPath),
          routes: routes.sort(
            (left, right) => left.path.localeCompare(right.path) || left.method.localeCompare(right.method)
          )
        });
      }
    }
  }

  routeGroups
    .sort(
      (left, right) =>
        left.controllerPath.localeCompare(right.controllerPath) ||
        left.controllerName.localeCompare(right.controllerName)
    )
    .forEach(group => {
      logger.log(`${group.controllerName} {${group.controllerPath}}:`, 'RoutesResolver');
      group.routes.forEach(route => {
        logger.log(`Mapped {${route.path}, ${route.method}} route`, 'RouterExplorer');
      });
    });
}

function normalizePath(path: string | string[] | undefined): string {
  if (Array.isArray(path)) {
    return normalizePath(path[0]);
  }

  if (!path || path === '/') {
    return '/';
  }

  return `/${String(path).replace(/^\/+|\/+$/g, '')}`;
}

function joinRoute(...parts: string[]): string {
  const normalized = parts
    .filter(Boolean)
    .map(part => part.trim())
    .filter(part => part !== '/')
    .map(part => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);

  if (normalized.length === 0) {
    return '/';
  }

  return `/${normalized.join('/')}`.replace(/\/+/g, '/');
}

function writeBootstrapLine(level: 'LOG' | 'ERROR', context: string, message: string, detail?: string): void {
  const timestamp = new Date().toLocaleString();
  const pid = String(process.pid).padStart(5, ' ');
  const appStr = chalk.green('[Nest]');
  const pidStr = chalk.green(pid);
  const levelStr = level === 'ERROR' ? chalk.red(level.padEnd(7, ' ')) : chalk.green(level.padEnd(7, ' '));
  const contextStr = chalk.yellow(`[${context}]`);
  const output = `${appStr} ${pidStr}  - ${timestamp} ${levelStr} ${contextStr} ${chalk.green(message)}`;

  if (level === 'ERROR') {
    console.error(output);
    if (detail) {
      console.error(chalk.red(detail));
    }
    return;
  }

  console.log(output);
  if (detail) {
    console.log(detail);
  }
}

void bootstrap();
