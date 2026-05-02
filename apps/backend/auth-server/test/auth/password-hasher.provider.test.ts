import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { PasswordHasherProvider } from '../../src/auth/password-hasher.provider';

describe('PasswordHasherProvider', () => {
  it('hashes and verifies passwords with bcrypt', async () => {
    const hasher = new PasswordHasherProvider();

    const hash = await hasher.hash('secret-123');

    expect(hash).toMatch(/^\$2[aby]\$/);
    await expect(hasher.verify('secret-123', hash)).resolves.toBe(true);
    await expect(hasher.verify('wrong-password', hash)).resolves.toBe(false);
  });

  it('loads bcrypt under CommonJS without relying on a default export', async () => {
    const { PasswordHasherProvider: CommonJsPasswordHasherProvider } = loadProviderModule(
      resolve(__dirname, '../../src/auth/password-hasher.provider.ts'),
      {
        '@nestjs/common': { Injectable: () => () => undefined },
        bcrypt: {
          compare: async (password: string, hash: string) => hash === `$2:${password}`,
          hash: async (password: string) => `$2:${password}`
        }
      }
    );

    const hasher = new CommonJsPasswordHasherProvider();

    await expect(hasher.hash('secret-123')).resolves.toBe('$2:secret-123');
    await expect(hasher.verify('secret-123', '$2:secret-123')).resolves.toBe(true);
    await expect(hasher.verify('secret-123', 'plain:secret-123')).resolves.toBe(false);
  });
});

function loadProviderModule(filePath: string, modules: Record<string, unknown>) {
  const source = readFileSync(filePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      allowSyntheticDefaultImports: true,
      esModuleInterop: false,
      experimentalDecorators: true,
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
    PasswordHasherProvider: new () => {
      hash(password: string): Promise<string>;
      verify(password: string, passwordHash: string): Promise<boolean>;
    };
  };
}
