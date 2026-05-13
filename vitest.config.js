import { existsSync } from 'node:fs';
import { resolve as resolveFilePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const resolvePath = value => fileURLToPath(new URL(value, import.meta.url));
const agentAdminSrcRoot = resolvePath('./apps/frontend/agent-admin/src/');
const agentChatSrcRoot = resolvePath('./apps/frontend/agent-chat/src/');
const knowledgeSrcRoot = resolvePath('./apps/frontend/knowledge/src/');

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

  if (importer?.includes('/apps/frontend/knowledge/')) {
    return resolveFrontendAliasPath(knowledgeSrcRoot, source.slice(2));
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
    alias: [
      {
        find: '@agent/knowledge/browser-entry',
        replacement: resolvePath('./packages/knowledge/src/browser/index.ts')
      },
      {
        find: '@agent/knowledge/node',
        replacement: resolvePath('./packages/knowledge/src/node/index.ts')
      },
      { find: '@agent/knowledge', replacement: resolvePath('./packages/knowledge/src') },
      { find: '@agent/core', replacement: resolvePath('./packages/core/src') },
      { find: '@agent/config', replacement: resolvePath('./packages/config/src') },
      { find: '@agent/runtime', replacement: resolvePath('./packages/runtime/src') },
      { find: '@agent/platform-runtime', replacement: resolvePath('./packages/platform-runtime/src') },
      { find: '@agent/adapters', replacement: resolvePath('./packages/adapters/src') },
      { find: '@agent/tools', replacement: resolvePath('./packages/tools/src') },
      { find: '@agent/memory', replacement: resolvePath('./packages/memory/src') },
      { find: '@agent/report-kit', replacement: resolvePath('./packages/report-kit/src') },
      { find: '@agent/skill', replacement: resolvePath('./packages/skill/src') },
      { find: '@agent/templates', replacement: resolvePath('./packages/templates/src') },
      { find: '@agent/evals', replacement: resolvePath('./packages/evals/src') },
      { find: '@agent/agents-supervisor', replacement: resolvePath('./agents/supervisor/src') },
      { find: '@agent/agents-audio', replacement: resolvePath('./agents/audio/src') },
      { find: '@agent/agents-company-live', replacement: resolvePath('./agents/company-live/src') },
      { find: '@agent/agents-data-report', replacement: resolvePath('./agents/data-report/src') },
      { find: '@agent/agents-image', replacement: resolvePath('./agents/image/src') },
      { find: '@agent/agents-intel-engine', replacement: resolvePath('./agents/intel-engine/src') },
      { find: '@agent/agents-video', replacement: resolvePath('./agents/video/src') },
      { find: '@agent/agents-coder', replacement: resolvePath('./agents/coder/src') },
      { find: '@agent/agents-reviewer', replacement: resolvePath('./agents/reviewer/src') }
    ]
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
        'apps/frontend/agent-admin/src/**/*.{ts,tsx}',
        'apps/frontend/knowledge/src/**/*.{ts,tsx}'
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
        'packages/templates/src/starters/**',
        '**/*.stories.*',
        '**/vite-env.d.ts',
        '**/src/**/types.ts',
        '**/*.types.tsx',
        'apps/frontend/*/src/main.tsx',
        'apps/frontend/*/src/main.ts'
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
        },
        'apps/frontend/knowledge/src/**': {
          lines: 85,
          statements: 85,
          functions: 85,
          branches: 85
        }
      }
    }
  }
});
