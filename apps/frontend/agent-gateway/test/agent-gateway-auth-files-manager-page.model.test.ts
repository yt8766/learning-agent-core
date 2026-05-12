import { describe, expect, it } from 'vitest';
import {
  AUTH_FILES_MANAGER_PAGE_STORAGE_KEY,
  DEFAULT_AUTH_FILES_MANAGER_PAGE_STATE,
  parseAuthFilesManagerPageState,
  readAuthFilesManagerPageState,
  writeAuthFilesManagerPageState
} from '../src/app/pages/auth-files-manager-page.model';

interface MockStorageShape {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

function createMockStorage(initialValue?: string): MockStorageShape & { state: Map<string, string> } {
  const state = new Map<string, string>(initialValue ? [[AUTH_FILES_MANAGER_PAGE_STORAGE_KEY, initialValue]] : []);
  return {
    state,
    getItem: key => state.get(key) ?? null,
    setItem: (key, value) => {
      state.set(key, value);
    }
  } as MockStorageShape & { state: Map<string, string> };
}

describe('auth files manager page local storage state', () => {
  it('parses valid persisted ui state and keeps compact/regular page sizes separately', () => {
    const parsed = parseAuthFilesManagerPageState({
      filter: 'gemini',
      query: 'cli proxy',
      compactMode: true,
      relationView: true,
      problemOnly: true,
      disabledOnly: false,
      regularPageSize: '24',
      compactPageSize: '48',
      page: 3,
      pageSize: '12',
      sortBy: 'priority'
    });

    expect(parsed).toEqual({
      activeProvider: 'gemini',
      compactMode: true,
      compactPageSize: '48',
      currentPage: 3,
      query: 'cli proxy',
      relationView: true,
      regularPageSize: '24',
      showDisabledOnly: false,
      showProblemOnly: true,
      sortBy: 'priority'
    });
  });

  it('falls back to defaults when persisted values are invalid', () => {
    const parsed = parseAuthFilesManagerPageState({
      filter: '   ',
      query: 123 as unknown,
      compactMode: 'yes' as unknown,
      relationView: 'also-no' as unknown,
      regularPageSize: '99',
      compactPageSize: true as unknown,
      page: -2,
      problemOnly: 'true' as unknown,
      disabledOnly: 0 as unknown,
      sortBy: 'not-a-sort' as unknown,
      pageSize: true as unknown
    });

    expect(parsed).toEqual(DEFAULT_AUTH_FILES_MANAGER_PAGE_STATE);
  });

  it('defaults to safe state on malformed json storage payload', () => {
    const storage = createMockStorage('{malformed-json');

    const parsed = readAuthFilesManagerPageState(storage as unknown as Storage);

    expect(parsed).toEqual(DEFAULT_AUTH_FILES_MANAGER_PAGE_STATE);
  });

  it('writes persisted ui state to storage with page and page size fields', () => {
    const storage = createMockStorage();
    const nextState = {
      ...DEFAULT_AUTH_FILES_MANAGER_PAGE_STATE,
      activeProvider: 'vertex',
      compactMode: true,
      compactPageSize: '48',
      currentPage: 4,
      query: 'vertex',
      relationView: false,
      regularPageSize: '24',
      showDisabledOnly: true,
      showProblemOnly: false,
      sortBy: 'provider' as const
    };

    writeAuthFilesManagerPageState(nextState, storage as unknown as Storage);

    const output = storage.state.get(AUTH_FILES_MANAGER_PAGE_STORAGE_KEY);
    expect(output).not.toBeNull();

    const persisted = JSON.parse(output || '{}');
    expect(persisted).toEqual({
      compactMode: true,
      compactPageSize: '48',
      disabledOnly: true,
      filter: 'vertex',
      page: 4,
      pageSize: '24',
      problemOnly: false,
      query: 'vertex',
      regularPageSize: '24',
      relationView: false,
      sortBy: 'provider'
    });
  });
});
