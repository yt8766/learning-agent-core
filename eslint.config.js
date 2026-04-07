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
  'logs/**'
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

const testTypedFiles = [
  'apps/frontend/agent-admin/test/**/*.{ts,tsx}',
  'apps/frontend/agent-chat/test/**/*.{ts,tsx}',
  'packages/*/test/**/*.{ts,tsx}'
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
  '@typescript-eslint/no-explicit-any': 'off',
  'no-empty': ['error', { allowEmptyCatch: false }]
};

export default tseslint.config(
  { ignores },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    files: ['apps/frontend/agent-admin/src/**/*.{ts,tsx}', 'apps/frontend/agent-chat/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*', '../../*', '../../../*', '../../../../*', '../../../../../*'],
              message: '前端 src 跨目录引用请统一改用 @/... 路径别名，不要继续使用父级相对路径。'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['apps/frontend/agent-admin/test/**/*.{ts,tsx}', 'apps/frontend/agent-chat/test/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../src/*', '../../src/*', '../../../src/*', '../../../../src/*', '../../../../../src/*'],
              message: '测试引用本应用 src 时请统一使用 @/... 路径别名，不要继续写 ../../../src/...。'
            }
          ]
        }
      ]
    }
  },
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
    files: testTypedFiles,
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
