import { readJson } from 'fs-extra';
import { resolve } from 'node:path';

export interface MockableState {
  mockConfig?: Record<string, unknown>;
}

export interface TryExecuteMockOptions {
  baseDir?: string;
  delayMs?: number;
}

export interface MockReader {
  readJson: (path: string) => Promise<unknown>;
}

const defaultMockReader: MockReader = {
  readJson: path => readJson(path)
};

export function shouldMock(state: MockableState, nodeName: string): boolean {
  if (typeof state.mockConfig?.[nodeName] === 'boolean') {
    return state.mockConfig[nodeName] as boolean;
  }

  return process.env.MOCK_MODE === 'true';
}

export async function tryExecuteMock<TState extends MockableState, TResult>(
  state: TState,
  nodeName: string,
  mockFileName: string,
  processResult: string | ((data: unknown, state: TState) => TResult),
  options: TryExecuteMockOptions = {},
  reader: MockReader = defaultMockReader
): Promise<TResult | Record<string, unknown> | null> {
  if (!shouldMock(state, nodeName)) {
    return null;
  }

  const delayMs = options.delayMs ?? 100;
  if (delayMs > 0) {
    await new Promise(resolveDelay => setTimeout(resolveDelay, delayMs));
  }

  try {
    const mockPath = resolve(options.baseDir ?? resolve(process.cwd(), 'mock'), mockFileName);
    const jsonData = await reader.readJson(mockPath);

    if (typeof processResult === 'string') {
      return { [processResult]: jsonData };
    }

    return processResult(jsonData, state);
  } catch (error) {
    console.error(`[MOCK] Failed to read mock data for ${nodeName}:`, error);
    return null;
  }
}
