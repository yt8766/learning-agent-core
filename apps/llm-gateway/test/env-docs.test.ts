import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const repoRoot = new URL('../../../', import.meta.url);

function readRepoFile(path: string): string {
  return readFileSync(new URL(path, repoRoot), 'utf8');
}

describe('llm-gateway local PostgreSQL deployment docs', () => {
  it('names local Docker Compose lifecycle scripts after Docker, not a single database resource', () => {
    const packageJson = JSON.parse(readRepoFile('apps/llm-gateway/package.json')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.['docker:up']).toBe('docker compose up -d llm-gateway-postgres');
    expect(packageJson.scripts?.['docker:down']).toBe('docker compose down');
    expect(packageJson.scripts).not.toHaveProperty('db:up');
    expect(packageJson.scripts).not.toHaveProperty('db:down');
  });

  it('keeps the Docker PostgreSQL service owned by llm-gateway and driven by app env', () => {
    const compose = readRepoFile('apps/llm-gateway/docker-compose.yml');

    expect(compose).toContain('postgres:16');
    expect(compose).toContain('POSTGRES_DB: ${POSTGRES_DB:-llm_gateway}');
    expect(compose).toContain('POSTGRES_USER: ${POSTGRES_USER:-llm_gateway}');
    expect(compose).toContain(
      'POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in apps/llm-gateway/.env}'
    );
    expect(compose).toContain('${POSTGRES_PORT:-5432}:5432');
    expect(compose).toContain('${POSTGRES_DATA_DIR:-./.db/postgres}:/var/lib/postgresql/data');
    expect(compose).toContain('pg_isready -U "$${POSTGRES_USER}" -d "$${POSTGRES_DB}"');
  });

  it('keeps the app env example aligned with the login bootstrap dependencies', () => {
    const envExample = readRepoFile('apps/llm-gateway/.env.example');

    expect(envExample).toContain('POSTGRES_DB=llm_gateway');
    expect(envExample).toContain('POSTGRES_USER=llm_gateway');
    expect(envExample).toContain('POSTGRES_PASSWORD=llm_gateway_password');
    expect(envExample).toContain('POSTGRES_PORT=5432');
    expect(envExample).toContain('POSTGRES_DATA_DIR=./.db/postgres');
    expect(envExample).toContain(
      'DATABASE_URL=postgresql://llm_gateway:llm_gateway_password@localhost:5432/llm_gateway'
    );
    expect(envExample).toContain('REDIS_URL=');
    expect(envExample).toContain('OPENAI_API_KEY=');
    expect(envExample).toContain('MINIMAX_API_KEY=');
    expect(envExample).toContain('MIMO_API_KEY=');
    expect(envExample).toContain('LLM_GATEWAY_BOOTSTRAP_API_KEY=');
    expect(envExample).toContain('LLM_GATEWAY_BOOTSTRAP_ADMIN_PASSWORD=');
    expect(envExample).toContain('LLM_GATEWAY_ADMIN_JWT_SECRET=');
    expect(envExample).toContain('values beginning with replace-with- are treated as not configured');
  });

  it('records the login persistence boundary and avoids session-cookie storage', () => {
    const docs = readRepoFile('docs/integration/llm-gateway-postgres-login.md');

    expect(docs).toContain('postgres:16');
    expect(docs).toContain('apps/llm-gateway/docker-compose.yml');
    expect(docs).toContain('pnpm --dir apps/llm-gateway docker:up');
    expect(docs).toContain('DATABASE_URL=postgresql://llm_gateway:llm_gateway_password@localhost:5432/llm_gateway');
    expect(docs).toContain('不使用 session cookie');
    expect(docs).toContain('不创建 `admin_sessions` 表');
    expect(docs).toContain('admin_principals');
    expect(docs).toContain('admin_credentials');
    expect(docs).toContain('admin_login_attempts');
    expect(docs).toContain('admin_audit_events');
    expect(docs).toContain('以 `replace-with-` 开头的示例值会被视为未配置');
    expect(docs).toContain('后续修改 bootstrap 环境变量不会覆盖既有密码');
  });

  it('confirms local database files stay ignored by git', () => {
    const gitignore = readRepoFile('.gitignore');

    expect(gitignore).toMatch(/(^|\n)\.db(\n|$)/);
  });

  it('exposes the isolated E2E compose stack through package scripts and config', () => {
    const packageJson = JSON.parse(readRepoFile('apps/llm-gateway/package.json')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.['test:e2e']).toBe('node scripts/run-e2e.mjs --runner=container');
    expect(packageJson.scripts?.['test:e2e:local']).toBe('node scripts/run-e2e.mjs --runner=host');
    expect(packageJson.scripts?.['test:e2e:up']).toBe(
      'docker compose -p ${LLM_GATEWAY_E2E_PROJECT:-llm-gateway-e2e} -f docker-compose.e2e.yml up -d llm-gateway-e2e-postgres llm-gateway-e2e-app'
    );
    expect(packageJson.scripts?.['test:e2e:down']).toBe(
      'docker compose -p ${LLM_GATEWAY_E2E_PROJECT:-llm-gateway-e2e} -f docker-compose.e2e.yml down -v --remove-orphans --rmi local'
    );

    const compose = readRepoFile('apps/llm-gateway/docker-compose.e2e.yml');
    expect(compose).toContain('llm-gateway-e2e-postgres:');
    expect(compose).toContain('llm-gateway-e2e-app:');
    expect(compose).toContain('llm-gateway-e2e-runner:');
    expect(compose).toContain('LLM_GATEWAY_RUNTIME: postgres');
    expect(compose).toContain('LLM_GATEWAY_PROVIDER_MODE: mock');
    expect(compose).not.toContain('container_name: learning-agent-llm-gateway-postgres');
    expect(compose).not.toContain('./.db/postgres');

    const e2eDocs = readRepoFile('docs/integration/llm-gateway-e2e.md');
    expect(e2eDocs).toContain('pnpm --dir apps/llm-gateway test:e2e');
    expect(e2eDocs).toContain('docker-compose.e2e.yml');
  });

  it('keeps E2E Docker context, runner, and seed guarded for isolated execution', () => {
    const dockerignore = readRepoFile('.dockerignore');
    for (const pattern of [
      '.env',
      '.env.*',
      '**/.env',
      '**/.env.*',
      '**/.db/**',
      '**/node_modules/**',
      '.git',
      '.worktrees',
      'artifacts',
      'coverage',
      '**/.next/**',
      '**/.turbo/**'
    ]) {
      expect(dockerignore).toContain(pattern);
    }

    const compose = readRepoFile('apps/llm-gateway/docker-compose.e2e.yml');
    expect(compose).not.toContain('ports:');
    expect(compose).not.toContain('${LLM_GATEWAY_E2E_PORT:-3100}:3000');

    const runner = readRepoFile('apps/llm-gateway/scripts/run-e2e.mjs');
    expect(runner).toContain('LLM_GATEWAY_E2E_PROJECT');
    expect(runner).toContain('llm-gateway-e2e');
    expect(runner).toContain('apps/llm-gateway/test/e2e/**/*.e2e-spec.ts');
    expect(runner).toContain('docker compose -p');
    expect(runner).toContain('test:e2e:down');
    expect(runner).toContain("'--rmi', 'local'");

    const seed = readRepoFile('apps/llm-gateway/test/e2e/seed.ts');
    expect(seed).toContain('assertE2eDatabaseUrl');
    expect(seed).toContain('LLM_GATEWAY_ALLOW_E2E_SEED=1');
    expect(seed).toContain('Refusing to seed llm-gateway E2E data');
  });
});
