import { z } from 'zod';

const AgentGatewayPersistenceEnvSchema = z
  .object({
    AGENT_GATEWAY_PERSISTENCE: z.enum(['memory', 'postgres']).optional(),
    AGENT_GATEWAY_DATABASE_URL: z.string().min(1).optional(),
    BACKEND_PERSISTENCE: z.enum(['memory', 'postgres']).optional(),
    DATABASE_URL: z.string().min(1).optional()
  })
  .passthrough();

export type AgentGatewayPersistenceBackend = 'memory' | 'postgres';

export interface AgentGatewayPersistenceConfig {
  backend: AgentGatewayPersistenceBackend;
  databaseUrl?: string;
}

export function resolveAgentGatewayPersistenceConfig(env: NodeJS.ProcessEnv): AgentGatewayPersistenceConfig {
  const parsed = AgentGatewayPersistenceEnvSchema.parse(env);
  const backend = parsed.AGENT_GATEWAY_PERSISTENCE ?? parsed.BACKEND_PERSISTENCE ?? 'memory';
  const databaseUrl = parsed.AGENT_GATEWAY_DATABASE_URL ?? parsed.DATABASE_URL;

  if (backend === 'postgres' && !databaseUrl) {
    throw new Error('AGENT_GATEWAY_DATABASE_URL or DATABASE_URL is required when AGENT_GATEWAY_PERSISTENCE=postgres');
  }

  return { backend, databaseUrl };
}
