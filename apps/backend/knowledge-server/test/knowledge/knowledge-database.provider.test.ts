import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

describe('createKnowledgeDatabaseClient', () => {
  it('loads pg Pool under CommonJS without relying on a default export', () => {
    class Pool {
      readonly connectionString: string;

      constructor(options: { connectionString: string }) {
        this.connectionString = options.connectionString;
      }
    }

    const { createKnowledgeDatabaseClient } = loadProviderModule(
      resolve(__dirname, '../../src/knowledge/runtime/knowledge-database.provider.ts'),
      { pg: { Pool } }
    );

    const client = createKnowledgeDatabaseClient({ databaseUrl: 'postgres://local/knowledge' });

    expect(client).toBeInstanceOf(Pool);
    expect(client).toMatchObject({ connectionString: 'postgres://local/knowledge' });
  });
});

function loadProviderModule(filePath: string, modules: Record<string, unknown>) {
  const source = readFileSync(filePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      allowSyntheticDefaultImports: true,
      esModuleInterop: false,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  }).outputText;
  const exports: Record<string, unknown> = {};
  const context = {
    exports,
    require: (specifier: string) => {
      if (specifier in modules) {
        return modules[specifier];
      }
      throw new Error(`Unexpected require: ${specifier}`);
    }
  };

  vm.runInNewContext(output, context, { filename: filePath });
  return exports as {
    createKnowledgeDatabaseClient(options: { databaseUrl: string }): unknown;
  };
}
