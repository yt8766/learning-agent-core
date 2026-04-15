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
  'packages/templates/**'
];

const frontendTypedFiles = [
  'apps/frontend/agent-admin/src/**/*.{ts,tsx}',
  'apps/frontend/agent-chat/src/**/*.{ts,tsx}'
];

const backendTypedFiles = [
  'apps/backend/agent-server/src/**/*.ts',
  'apps/backend/agent-server/test/**/*.ts',
  'apps/worker/src/**/*.ts',
  'packages/**/src/**/*.{ts,tsx}'
];

const testTypedFiles = [
  'apps/frontend/agent-admin/test/**/*.{ts,tsx}',
  'apps/frontend/agent-chat/test/**/*.{ts,tsx}',
  'packages/**/test/**/*.{ts,tsx}'
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
  'packages/*/*/*.ts',
  'packages/*/*/*.js',
  '*.ts',
  '*.js',
  '*.mjs'
];

const sharedRules = {
  'no-undef': 'off',
  'no-unused-vars': 'off',
  '@typescript-eslint/no-unused-vars': 'off',
  '@typescript-eslint/no-explicit-any': 'off',
  '@typescript-eslint/ban-ts-comment': 'off',
  'no-empty': ['error', { allowEmptyCatch: false }]
};

const packageSrcDeepImportPatterns = [
  {
    group: ['packages/*/src/*', '*/packages/*/src/*', '@agent/*/src/*'],
    message: '禁止跨边界依赖 packages/*/src，请只通过包公开入口消费。'
  }
];

const toolsDataReportDeepImportPatterns = [
  {
    group: ['../../src/data-report/*', '../src/data-report/*', '../../../src/data-report/*'],
    message: '请改用 @agent/tools 根入口，不要在测试或消费方深层引用 tools/src/data-report/*。'
  }
];

const rootOnlyPackagePatterns = [
  {
    group: ['@agent/config/*'],
    message: '请统一改用 @agent/config 根入口导入。'
  },
  {
    group: ['@agent/memory/*'],
    message: '请统一改用 @agent/memory 根入口导入。'
  },
  {
    group: ['@agent/model/*'],
    message: '请统一改用 @agent/model 根入口导入。'
  },
  {
    group: ['@agent/runtime/*'],
    message: '请统一改用 @agent/runtime 根入口导入。'
  },
  {
    group: ['@agent/adapters/*'],
    message: '请统一改用 @agent/adapters 根入口导入。'
  },
  {
    group: [
      '@agent/agents-supervisor/*',
      '@agent/agents-data-report/*',
      '@agent/agents-coder/*',
      '@agent/agents-reviewer/*'
    ],
    message: '请统一改用各 agent 包根入口导入。'
  },
  {
    group: ['@agent/tools/*'],
    message: '请统一改用 @agent/tools 根入口导入。'
  }
];

const memoryPublicEntryDeepImportPatterns = [
  {
    group: ['../src/*', '../../src/*'],
    message: '请改用 @agent/memory 的公开子域入口（repositories/search/vector/embeddings）。'
  }
];

const modelPublicEntryDeepImportPatterns = [
  {
    group: ['../src', '../src/*', '../../src', '../../src/*'],
    message: '请改用 @agent/model 的公开子域入口（chat/embeddings/providers）。'
  }
];

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
            ...packageSrcDeepImportPatterns,
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
            ...packageSrcDeepImportPatterns,
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
    files: ['apps/**/*.{ts,tsx,js,mjs,cjs}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: packageSrcDeepImportPatterns
        }
      ]
    }
  },
  {
    files: ['packages/{shared,core}/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: '@agent/runtime', message: 'core/shared 是契约层，禁止依赖 runtime。' },
            { name: '@agent/tools', message: 'shared 是契约层，禁止依赖 tools。' },
            { name: '@agent/model', message: 'shared 是契约层，禁止依赖 model。' },
            { name: '@agent/adapters', message: 'core/shared 是契约层，禁止依赖 adapters。' },
            { name: '@agent/memory', message: 'shared 是契约层，禁止依赖 memory。' },
            { name: '@agent/skills', message: 'shared 是契约层，禁止依赖 skills。' }
          ],
          patterns: packageSrcDeepImportPatterns
        }
      ]
    }
  },
  {
    files: ['packages/{tools,model,memory,skills,report-kit,adapters}/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: '@agent/runtime', message: '基础能力层禁止反向依赖 runtime。' }],
          patterns: [
            ...packageSrcDeepImportPatterns,
            {
              group: ['@agent/runtime/*'],
              message: '基础能力层禁止深层依赖 runtime 内部实现。'
            }
          ]
        }
      ]
    }
  },
  {
    files: [
      'packages/runtime/src/**/*.{ts,tsx}',
      'agents/*/src/**/*.{ts,tsx}',
      'apps/backend/agent-server/src/**/*.ts',
      'packages/tools/src/**/*.ts',
      'packages/skills/src/**/*.ts'
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: rootOnlyPackagePatterns
        }
      ]
    }
  },
  {
    files: ['packages/tools/test/**/*.{ts,tsx}'],
    ignores: ['packages/tools/test/data-report/data-report-assembly.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: toolsDataReportDeepImportPatterns
        }
      ]
    }
  },
  {
    files: ['packages/config/test/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: rootOnlyPackagePatterns
        }
      ]
    }
  },
  {
    files: ['packages/memory/test/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [...memoryPublicEntryDeepImportPatterns, ...rootOnlyPackagePatterns]
        }
      ]
    }
  },
  {
    files: ['packages/{model,adapters}/test/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: modelPublicEntryDeepImportPatterns
        }
      ]
    }
  },
  {
    files: [
      'packages/runtime/test/**/*.{ts,tsx}',
      'agents/*/test/**/*.{ts,tsx}',
      'apps/backend/agent-server/test/**/*.ts',
      'packages/tools/test/**/*.{ts,tsx}'
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: rootOnlyPackagePatterns
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
