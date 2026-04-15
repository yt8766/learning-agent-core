import { readFileSync } from 'node:fs';

type BuildCompilerOptions = {
  rootDir?: string;
  baseUrl?: string;
  paths?: Record<string, string[]>;
};

describe('agent-server tsconfig.build', () => {
  it('disables dev path aliases so the production build cannot compile workspace source trees', () => {
    const rawConfig = JSON.parse(readFileSync(new URL('../../tsconfig.build.json', import.meta.url), 'utf8')) as {
      compilerOptions?: BuildCompilerOptions;
    };

    expect(rawConfig.compilerOptions?.rootDir).toBe('./src');
    expect(rawConfig.compilerOptions?.baseUrl).toBe('./');

    expect(rawConfig.compilerOptions?.paths).toEqual({});
  });
});
