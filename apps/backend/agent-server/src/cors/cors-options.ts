import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const ALLOWED_EXACT_ORIGINS = new Set(['https://admin-local.gosh0.com']);

export function isAllowedCorsOrigin(origin?: string): boolean {
  if (!origin) {
    return true;
  }

  try {
    const parsed = new URL(origin);
    const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    const isLocalDevProtocol = parsed.protocol === 'http:' || parsed.protocol === 'https:';

    if (isLocalhost && isLocalDevProtocol) {
      return true;
    }

    return ALLOWED_EXACT_ORIGINS.has(origin);
  } catch {
    return false;
  }
}

export function createCorsOptions(): CorsOptions {
  return {
    origin: (origin, callback) => {
      callback(null, isAllowedCorsOrigin(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['set-cookie']
  };
}
