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
      '@agent/shared': resolvePath('./packages/shared/src'),
      '@agent/config': resolvePath('./packages/config/src'),
      '@agent/tools': resolvePath('./packages/tools/src'),
      '@agent/memory': resolvePath('./packages/memory/src'),
      '@agent/model': resolvePath('./packages/model/src'),
      '@agent/skills': resolvePath('./packages/skills/src'),
      '@agent/evals': resolvePath('./packages/evals/src'),
      '@agent/agent-core': resolvePath('./packages/agent-core/src')
    }
  },
  test: {
    globals: true,
    passWithNoTests: true,
    environment: 'node',
    include: [
      'packages/*/test/**/*.test.ts',
      'packages/*/test/**/*.spec.ts',
      'packages/*/test/**/*.int-spec.ts',
      'packages/*/test/**/*.test.tsx',
      'packages/*/test/**/*.spec.tsx',
      'packages/*/test/**/*.int-spec.tsx',
      'apps/**/test/**/*.test.ts',
      'apps/**/test/**/*.spec.ts',
      'apps/**/test/**/*.int-spec.ts',
      'apps/**/test/**/*.test.tsx',
      'apps/**/test/**/*.spec.tsx',
      'apps/**/test/**/*.int-spec.tsx'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/data/**',
      '**/e2e/**'
    ],
    watchExclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.turbo/**', '**/coverage/**', '**/data/**'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage/vitest',
      reporter: ['text', 'json-summary', 'html'],
      all: true,
      reportOnFailure: true,
      include: [
        'packages/*/src/**/*.{ts,tsx}',
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
        'packages/agent-core/src/**': {
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
