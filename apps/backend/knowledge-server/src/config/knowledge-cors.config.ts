const LOCAL_KNOWLEDGE_FRONTEND_DEV_ORIGINS = ['http://127.0.0.1:5175', 'http://localhost:5175'];

export interface KnowledgeCorsConfigInput {
  nodeEnv?: string;
  knowledgeServerCorsOrigin?: string;
  corsOrigins?: string;
}

export function resolveKnowledgeCorsOrigins(input: KnowledgeCorsConfigInput): string[] | true {
  const configuredOrigins = parseOrigins(input.knowledgeServerCorsOrigin ?? input.corsOrigins);
  if (input.nodeEnv === 'production') {
    return configuredOrigins.length > 0 ? configuredOrigins : true;
  }

  return uniqueOrigins([...configuredOrigins, ...LOCAL_KNOWLEDGE_FRONTEND_DEV_ORIGINS]);
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
