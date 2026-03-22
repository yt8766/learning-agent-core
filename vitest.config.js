import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const resolvePath = value => fileURLToPath(new URL(value, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@agent/shared': resolvePath('./packages/shared/src'),
      '@agent/config': resolvePath('./packages/config/src'),
      '@agent/tools': resolvePath('./packages/tools/src'),
      '@agent/memory': resolvePath('./packages/memory/src'),
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
      'packages/*/src/**/*.test.ts',
      'packages/*/src/**/*.spec.ts',
      'apps/backend/agent-server/src/**/*.test.ts',
      'apps/backend/agent-server/src/**/*.spec.ts',
      'apps/backend/agent-server/test/**/*.spec.ts',
      'apps/backend/agent-server/test/**/*.spec.js'
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
    reporters: ['default']
  }
});
