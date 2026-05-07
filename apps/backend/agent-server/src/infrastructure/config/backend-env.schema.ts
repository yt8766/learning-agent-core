import { z } from 'zod';

export const BackendPersistenceModeSchema = z.enum(['memory', 'postgres']);

export const BackendEnvSchema = z.object({
  NODE_ENV: z.string().optional(),
  DATABASE_URL: z.string().min(1).optional(),
  DB_HOST: z.string().min(1).optional(),
  DB_PORT: z.string().min(1).optional(),
  DB_USER: z.string().min(1).optional(),
  DB_PASS: z.string().optional(),
  DB_NAME: z.string().min(1).optional(),
  BACKEND_PERSISTENCE: BackendPersistenceModeSchema.optional(),
  BACKEND_RUN_MIGRATIONS: z.enum(['true', 'false']).optional(),
  BACKEND_ENABLE_LEGACY_ROUTES: z.enum(['true', 'false']).optional(),
  BACKEND_REMOTE_SKILL_INSTALL_ENABLED: z.enum(['true', 'false']).optional(),
  BACKEND_BACKGROUND_ENABLED: z.enum(['true', 'false']).optional(),
  AGENT_SERVER_ENABLE_DATABASE_IN_TEST: z.enum(['true', 'false']).optional()
});

export type BackendEnv = z.infer<typeof BackendEnvSchema>;
export type BackendPersistenceMode = z.infer<typeof BackendPersistenceModeSchema>;

export function parseBackendEnv(env: NodeJS.ProcessEnv): BackendEnv {
  return BackendEnvSchema.parse(env);
}
