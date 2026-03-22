import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const ignores = [
  'dist',
  'build',
  'coverage',
  '.turbo',
  'node_modules',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/node_modules/**',
  '**/*.d.ts',
  'data/**',
  'logs/**',
  '**/*.spec.ts',
  '**/*.spec.js'
];

const frontendTypedFiles = [
  'apps/frontend/agent-admin/src/**/*.{ts,tsx}',
  'apps/frontend/agent-chat/src/**/*.{ts,tsx}'
];

const backendTypedFiles = [
  'apps/backend/agent-server/src/**/*.ts',
  'apps/backend/agent-server/test/**/*.ts',
  'apps/worker/src/**/*.ts',
  'packages/*/src/**/*.ts'
];

const configFiles = [
  'scripts/**/*.js',
  'eslint.config.mjs',
  'prettier.config.js',
  'apps/backend/agent-server/*.ts',
  'apps/backend/agent-server/*.js',
  'apps/frontend/agent-admin/*.ts',
  'apps/frontend/agent-chat/*.ts',
  'apps/worker/*.ts',
  'packages/*/*.ts',
  'packages/*/*.js',
  '*.ts',
  '*.js',
  '*.mjs'
];

const sharedRules = {
  'no-undef': 'off',
  'no-unused-vars': 'off',
  '@typescript-eslint/no-unused-vars': 'off',
  '@typescript-eslint/no-explicit-any': 'off'
};

export default tseslint.config(
  { ignores },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    files: frontendTypedFiles,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      globals: {
        ...globals.browser
      }
    },
    rules: sharedRules
  },
  {
    files: backendTypedFiles,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      globals: {
        ...globals.node
      }
    },
    rules: sharedRules
  },
  {
    files: configFiles,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      globals: {
        ...globals.node
      }
    },
    rules: sharedRules
  }
);
