import { existsSync } from 'node:fs';
import { resolve as resolveFilePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const resolvePath = value => fileURLToPath(new URL(value, import.meta.url));
const agentAdminSrcRoot = resolvePath('./apps/frontend/agent-admin/src/');
const agentChatSrcRoot = resolvePath('./apps/frontend/agent-chat/src/');

function resolveFrontendAlias(source, importer) {
  if (!source.startsWith('@/')) {
    return null;
  }

  if (importer?.includes('/apps/frontend/agent-chat/')) {
    return resolveFrontendAliasPath(agentChatSrcRoot, source.slice(2));
  }

  if (importer?.includes('/apps/frontend/agent-admin/')) {
    return resolveFrontendAliasPath(agentAdminSrcRoot, source.slice(2));
  }

  return resolveFrontendAliasPath(agentAdminSrcRoot, source.slice(2));
}

function resolveFrontendAliasPath(root, relativePath) {
  const basePath = resolveFilePath(root, relativePath);
  const candidates = [
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    resolveFilePath(basePath, 'index.ts'),
    resolveFilePath(basePath, 'index.tsx'),
    resolveFilePath(basePath, 'index.js'),
    resolveFilePath(basePath, 'index.jsx'),
    basePath
  ];

  return candidates.find(candidate => existsSync(candidate)) ?? basePath;
}

export default defineConfig({
  plugins: [
    {
      name: 'frontend-app-alias',
      enforce: 'pre',
      resolveId(source, importer) {
        return resolveFrontendAlias(source, importer);
      }
    }
  ],
  resolve: {
    alias: {
      '@agent/agent-kit': resolvePath('./packages/agent-kit/src'),
      '@agent/runtime/base-agent': resolvePath('./packages/runtime/src/agents/base-agent.ts'),
      '@agent/runtime/agent-runtime-context': resolvePath('./packages/runtime/src/runtime/agent-runtime-context.ts'),
      '@agent/runtime/streaming-execution': resolvePath('./packages/runtime/src/runtime/streaming-execution.ts'),
      '@agent/core': resolvePath('./packages/core/src'),
      '@agent/knowledge': resolvePath('./packages/knowledge/src'),
      '@agent/config': resolvePath('./packages/config/src'),
      '@agent/runtime': resolvePath('./packages/runtime/src'),
      '@agent/platform-runtime': resolvePath('./packages/platform-runtime/src'),
      '@agent/adapters': resolvePath('./packages/adapters/src'),
      '@agent/tools': resolvePath('./packages/tools/src'),
      '@agent/memory': resolvePath('./packages/memory/src'),
      '@agent/report-kit': resolvePath('./packages/report-kit/src'),
      '@agent/skill-runtime': resolvePath('./packages/skill-runtime/src'),
      '@agent/templates': resolvePath('./packages/templates/src'),
      '@agent/evals': resolvePath('./packages/evals/src'),
      '@agent/agents-supervisor': resolvePath('./agents/supervisor/src'),
      '@agent/agents-data-report': resolvePath('./agents/data-report/src'),
      '@agent/agents-coder': resolvePath('./agents/coder/src'),
      '@agent/agents-reviewer': resolvePath('./agents/reviewer/src')
    }
  },
  test: {
    globals: true,
    passWithNoTests: true,
    environment: 'node',
    include: [
      'packages/**/test/**/*.test.ts',
      'packages/**/test/**/*.spec.ts',
      'packages/**/test/**/*.int-spec.ts',
      'packages/**/test/**/*.test.tsx',
      'packages/**/test/**/*.spec.tsx',
      'packages/**/test/**/*.int-spec.tsx',
      'agents/**/test/**/*.test.ts',
      'agents/**/test/**/*.spec.ts',
      'agents/**/test/**/*.int-spec.ts',
      'agents/**/test/**/*.test.tsx',
      'agents/**/test/**/*.spec.tsx',
      'agents/**/test/**/*.int-spec.tsx',
      'apps/**/test/**/*.test.ts',
      'apps/**/test/**/*.spec.ts',
      'apps/**/test/**/*.int-spec.ts',
      'apps/**/test/**/*.test.tsx',
      'apps/**/test/**/*.spec.tsx',
      'apps/**/test/**/*.int-spec.tsx',
      // workspace-level test host (see test/README.md)
      'test/integration/**/*.int-spec.ts',
      'test/smoke/**/*.smoke.ts',
      'test/acceptance/**/*.acc-spec.ts'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/data/**',
      '**/e2e/**',
      'packages/templates/src/scaffold/**',
      'packages/templates/src/scaffolds/**'
    ],
    watchExclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/data/**',
      'packages/templates/src/scaffold/**',
      'packages/templates/src/scaffolds/**'
    ],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './artifacts/coverage/vitest',
      reporter: ['text', 'json-summary', 'html'],
      all: true,
      reportOnFailure: true,
      include: [
        'packages/**/src/**/*.{ts,tsx}',
        'agents/**/src/**/*.{ts,tsx}',
        'apps/backend/agent-server/src/**/*.{ts,tsx}',
        'apps/frontend/agent-chat/src/**/*.{ts,tsx}',
        'apps/frontend/agent-admin/src/**/*.{ts,tsx}'
      ],
      exclude: [
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.int-spec.ts',
        '**/*.test.tsx',
        '**/*.spec.tsx',
        '**/*.int-spec.tsx',
        '**/test/**',
        '**/__tests__/**',
        '**/dist/**',
        '**/build/**',
        '**/.turbo/**',
        '**/coverage/**',
        '**/data/**',
        '**/assets/**',
        'packages/templates/src/scaffold/**',
        'packages/templates/src/scaffolds/**',
        '**/*.stories.*',
        '**/vite-env.d.ts',
        '**/src/main.ts',
        '**/src/main.tsx'
      ],
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 85,
        branches: 85,
        'packages/runtime/src/**': {
          lines: 85,
          statements: 85,
          functions: 85,
          branches: 85
        },
        'apps/backend/agent-server/src/**': {
          lines: 85,
          statements: 85,
          functions: 85,
          branches: 85
        },
        'apps/frontend/agent-chat/src/**': {
          lines: 85,
          statements: 85,
          functions: 85,
          branches: 85
        },
        'apps/frontend/agent-admin/src/**': {
          lines: 85,
          statements: 85,
          functions: 85,
          branches: 85
        }
      }
    }
  }
});
