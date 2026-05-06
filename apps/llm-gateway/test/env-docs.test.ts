import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const gatewayRoot = join(process.cwd(), 'apps/llm-gateway');
const rootPackageJsonPath = join(process.cwd(), 'package.json');
const rootEnvExamplePath = join(process.cwd(), '.env.example');
const rootComposePath = join(process.cwd(), 'docker-compose.yml');
const integrationDocPath = join(process.cwd(), 'docs/integration/llm-gateway-postgres-login.md');
const postgresRuntimeDocPath = join(process.cwd(), 'docs/integration/llm-gateway-postgres-runtime.md');
const previewDocPath = join(process.cwd(), 'docs/integration/llm-gateway-vercel-preview.md');
const integrationReadmePath = join(process.cwd(), 'docs/integration/README.md');
const frontendReadmePath = join(process.cwd(), 'docs/apps/frontend/llm-gateway/README.md');
const packageJsonPath = join(gatewayRoot, 'package.json');
const gitignorePath = join(process.cwd(), '.gitignore');
const previewSmokeScriptPath = join(process.cwd(), 'apps/llm-gateway/scripts/preview-smoke.mjs');
const postcssConfigPath = join(gatewayRoot, 'postcss.config.mjs');

async function readGatewayFile(path: string): Promise<string> {
  return readFile(join(gatewayRoot, path), 'utf8');
}

describe('llm gateway env docs', () => {
  it('keeps the documented runtime environment variables in .env.example', async () => {
    const envExample = await readGatewayFile('.env.example');

    expect(envExample).toContain('DATABASE_URL=');
    expect(envExample).toContain('UPSTASH_REDIS_REST_URL=');
    expect(envExample).toContain('UPSTASH_REDIS_REST_TOKEN=');
    expect(envExample).toContain('REDIS_URL=');
    expect(envExample).toContain('OPENAI_API_KEY=');
    expect(envExample).toContain('MINIMAX_API_KEY=');
    expect(envExample).toContain('MIMO_API_KEY=');
    expect(envExample).toContain('LLM_GATEWAY_PROVIDER_SECRET_KEY=');
    expect(envExample).toContain('LLM_GATEWAY_PROVIDER_SECRET_KEY_VERSION=');
    expect(envExample).toContain('LLM_GATEWAY_BOOTSTRAP_API_KEY=');
    expect(envExample).toContain('LLM_GATEWAY_BOOTSTRAP_ADMIN_PASSWORD=replace-with-local-admin-password');
    expect(envExample).not.toContain('yangtao1314520');
    expect(envExample).toContain('LLM_GATEWAY_ADMIN_JWT_SECRET=');
    expect(envExample).toContain('LLM_GATEWAY_KEY_HASH_SECRET=');
  });

  it('keeps local Postgres on the root compose file with root db volume storage', async () => {
    const rootEnvExample = await readFile(rootEnvExamplePath, 'utf8');
    const rootCompose = await readFile(rootComposePath, 'utf8');
    const rootPackageJson = JSON.parse(await readFile(rootPackageJsonPath, 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const gatewayEnvExample = await readGatewayFile('.env.example');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as { scripts?: Record<string, string> };

    await expect(access(join(gatewayRoot, 'docker-compose.yml'))).rejects.toThrow();
    expect(packageJson.scripts).not.toHaveProperty('docker:up');
    expect(packageJson.scripts).not.toHaveProperty('docker:down');
    expect(rootPackageJson.scripts?.['docker:up']).toBe('docker compose up -d postgres');
    expect(rootPackageJson.scripts?.['docker:down']).toBe('docker compose down');
    expect(rootPackageJson.scripts?.['docker:ps']).toBe('docker compose ps');
    expect(rootPackageJson.scripts?.['docker:logs']).toBe('docker compose logs -f postgres');
    expect(rootCompose).toContain('pgvector/pgvector:pg16');
    expect(rootCompose).toContain('./db/postgres:/var/lib/postgresql/data');
    expect(rootCompose).not.toContain('llm-gateway');
    expect(rootEnvExample).toContain('DB_NAME=agent_db');
    expect(gatewayEnvExample).not.toContain('POSTGRES_DATA_DIR=');
  });

  it('keeps the local dev server on the documented gateway port', async () => {
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as { scripts?: Record<string, string> };
    const doc = await readFile(integrationDocPath, 'utf8');
    const frontendReadme = await readFile(frontendReadmePath, 'utf8');

    expect(packageJson.scripts?.dev).toBe('next dev --port 3100');
    expect(doc).toContain('http://localhost:3100');
    expect(frontendReadme).toContain('http://localhost:3100');
  });

  it('keeps the Postgres/login integration doc aligned with bootstrap commands and verification', async () => {
    const doc = await readFile(integrationDocPath, 'utf8');

    expect(doc).toContain('pnpm docker:up');
    expect(doc).toContain('pnpm docker:ps');
    expect(doc).toContain('pnpm docker:logs');
    expect(doc).toContain('pnpm docker:down');
    expect(doc).toContain('docker compose up -d postgres');
    expect(doc).toContain('./db/postgres:/var/lib/postgresql/data');
    expect(doc).toContain('pnpm --dir apps/llm-gateway dev');
    expect(doc).toContain('apps/llm-gateway/test/env-docs.test.ts');
    expect(doc).toContain('UPSTASH_REDIS_REST_URL');
    expect(doc).toContain('LLM_GATEWAY_PROVIDER_SECRET_KEY');
    expect(doc).toContain('Authorization: Bearer <accessToken>');
  });

  it('documents the Vercel Preview acceptance checklist and doc entrypoints', async () => {
    const previewDoc = await readFile(previewDocPath, 'utf8');
    const integrationReadme = await readFile(integrationReadmePath, 'utf8');
    const frontendReadme = await readFile(frontendReadmePath, 'utf8');
    const packageJson = await readGatewayFile('package.json');
    const previewSmokeScript = await readFile(previewSmokeScriptPath, 'utf8');

    expect(packageJson).toContain('"preview:smoke": "node scripts/preview-smoke.mjs"');
    expect(previewSmokeScript).toContain('PREVIEW_BASE_URL');
    expect(previewSmokeScript).toContain('LLM_GATEWAY_PREVIEW_API_KEY');
    expect(previewSmokeScript).toContain('LLM_GATEWAY_PREVIEW_ADMIN_PASSWORD');
    expect(previewSmokeScript).toContain('/api/v1/models');
    expect(previewSmokeScript).toContain('/api/v1/key');
    expect(previewSmokeScript).toContain('/api/v1/chat/completions');
    expect(previewSmokeScript).toContain('/api/admin/auth/login');
    expect(previewSmokeScript).toContain('/api/admin/providers');
    expect(previewSmokeScript).toContain('maskSecret');
    expect(previewDoc).toContain('DATABASE_URL');
    expect(previewDoc).toContain('UPSTASH_REDIS_REST_URL');
    expect(previewDoc).toContain('UPSTASH_REDIS_REST_TOKEN');
    expect(previewDoc).toContain('LLM_GATEWAY_ADMIN_JWT_SECRET');
    expect(previewDoc).toContain('LLM_GATEWAY_PROVIDER_SECRET_KEY');
    expect(previewDoc).toContain('LLM_GATEWAY_KEY_HASH_SECRET');
    expect(previewDoc).toContain('provider 后台录入/注入');
    expect(previewDoc).toContain('/api/v1');
    expect(previewDoc).toContain('admin auth smoke');
    expect(previewDoc).toContain('pnpm --dir apps/llm-gateway preview:smoke');
    expect(previewDoc).toContain('PREVIEW_BASE_URL');
    expect(previewDoc).toContain('LLM_GATEWAY_PREVIEW_API_KEY');
    expect(previewDoc).toContain('LLM_GATEWAY_PREVIEW_ADMIN_PASSWORD');
    expect(previewDoc).toContain(
      'pnpm exec vitest run --config vitest.config.js apps/llm-gateway/test/env-docs.test.ts'
    );

    expect(integrationReadme).toContain('llm-gateway-vercel-preview.md');
    expect(frontendReadme).toContain('llm-gateway-vercel-preview.md');
    expect(frontendReadme).toContain('pnpm --dir apps/llm-gateway preview:smoke');
  });

  it('documents local bootstrap fallback separately from production DB fail-closed runtime', async () => {
    const postgresRuntimeDoc = await readFile(postgresRuntimeDocPath, 'utf8');
    const previewDoc = await readFile(previewDocPath, 'utf8');

    expect(postgresRuntimeDoc).toContain('本地 bootstrap fallback');
    expect(postgresRuntimeDoc).toContain('production DB runtime fail-closed');
    expect(previewDoc).toContain('本地 bootstrap fallback');
    expect(previewDoc).toContain('production DB runtime fail-closed');
  });

  it('keeps Next build output out of formatting and source patrols', async () => {
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as { scripts?: Record<string, string> };
    const gitignore = await readFile(gitignorePath, 'utf8');
    const frontendReadme = await readFile(frontendReadmePath, 'utf8');

    expect(gitignore).toMatch(/(^|\n)\.next(\n|$)/);
    expect(packageJson.scripts?.lint).toContain('--ignore-pattern .next');
    expect(frontendReadme).toContain('`.next` 是 Next build/dev 生成目录');
  });

  it('keeps Tailwind v4 PostCSS wired for the shadcn dashboard shell', async () => {
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
      devDependencies?: Record<string, string>;
    };
    const postcssConfig = await readFile(postcssConfigPath, 'utf8');
    const frontendReadme = await readFile(frontendReadmePath, 'utf8');

    expect(packageJson.devDependencies).toHaveProperty('@tailwindcss/postcss');
    expect(postcssConfig).toContain('@tailwindcss/postcss');
    expect(frontendReadme).toContain('`postcss.config.mjs` 必须保留 `@tailwindcss/postcss`');
    expect(frontendReadme).toContain('黑白 dashboard-01');
    expect(frontendReadme).toContain('桌面端左侧栏必须为 inset/gap 布局');
    expect(frontendReadme).toContain('浅灰细边');
  });
});
