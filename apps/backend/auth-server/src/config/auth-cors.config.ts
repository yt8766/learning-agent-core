const LOCAL_FRONTEND_DEV_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5174',
  'http://localhost:5174',
  'http://127.0.0.1:5175',
  'http://localhost:5175'
];

export interface AuthCorsConfigInput {
  nodeEnv?: string;
  authServerCorsOrigin?: string;
  corsOrigins?: string;
}

export function resolveAuthCorsOrigins(input: AuthCorsConfigInput): string[] | true {
  const configuredOrigins = parseOrigins(input.authServerCorsOrigin ?? input.corsOrigins);
  if (input.nodeEnv === 'production') {
    return configuredOrigins.length > 0 ? configuredOrigins : true;
  }

  return uniqueOrigins([...configuredOrigins, ...LOCAL_FRONTEND_DEV_ORIGINS]);
}

function parseOrigins(value: string | undefined): string[] {
  return (
    value
      ?.split(',')
      .map(origin => origin.trim())
      .filter(Boolean) ?? []
  );
}

function uniqueOrigins(origins: string[]): string[] {
  return [...new Set(origins)];
}
