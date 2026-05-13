import { describe, expect, it, vi } from 'vitest';

import {
  CODEX_COMPOSER_DRAFT_STORAGE_KEY,
  filterComposerModels,
  getModelLogoProvider,
  getModelLogoSrc,
  readComposerDraft,
  shouldSubmitComposerKey,
  writeComposerDraft
} from '../src/components/codex-composer.helpers';

describe('CodexComposer helpers', () => {
  it('persists composer drafts in a codex-chat scoped key', () => {
    const storage = createStorage();

    writeComposerDraft(storage, '继续上次的问题');

    expect(storage.setItem).toHaveBeenCalledWith(CODEX_COMPOSER_DRAFT_STORAGE_KEY, '继续上次的问题');
    expect(readComposerDraft(storage)).toBe('继续上次的问题');
  });

  it('clears the scoped composer draft after submit', () => {
    const storage = createStorage('已有草稿');

    writeComposerDraft(storage, '');

    expect(storage.removeItem).toHaveBeenCalledWith(CODEX_COMPOSER_DRAFT_STORAGE_KEY);
    expect(readComposerDraft(storage)).toBe('');
  });

  it('submits on plain Enter but keeps Shift+Enter and IME composition safe', () => {
    expect(
      shouldSubmitComposerKey({ key: 'Enter', shiftKey: false, isComposing: false, nativeIsComposing: false })
    ).toBe(true);
    expect(
      shouldSubmitComposerKey({ key: 'Enter', shiftKey: true, isComposing: false, nativeIsComposing: false })
    ).toBe(false);
    expect(
      shouldSubmitComposerKey({ key: 'Enter', shiftKey: false, isComposing: true, nativeIsComposing: false })
    ).toBe(false);
    expect(
      shouldSubmitComposerKey({ key: 'Enter', shiftKey: false, isComposing: false, nativeIsComposing: true })
    ).toBe(false);
  });

  it('filters models by display name, id, or provider for the official model selector search', () => {
    const models = [
      { id: 'deepseek-ai/deepseek-v3.2', displayName: 'DeepSeek V3.2', providerId: 'deepseek' },
      { id: 'moonshotai/kimi-k2.5', displayName: 'Kimi K2.5', providerId: 'moonshotai' },
      { id: 'openai/gpt-oss-20b', displayName: 'GPT OSS 20B', providerId: 'openai' }
    ];

    expect(filterComposerModels(models, 'oss')).toEqual([models[2]]);
    expect(filterComposerModels(models, 'moonshot')).toEqual([models[1]]);
    expect(filterComposerModels(models, 'DeepSeek')).toEqual([models[0]]);
    expect(filterComposerModels(models, '')).toEqual(models);
  });

  it('uses downloaded provider logos with official models.dev provider fallbacks', () => {
    expect(getModelLogoProvider({ id: 'zai/glm-4.7', providerId: 'glm' })).toBe('zhipuai');
    expect(getModelLogoSrc({ id: 'zai/glm-4.7', providerId: 'glm' })).toBe('/model-logos/zhipuai-apple.png');
    expect(getModelLogoSrc({ id: 'minimax/minimax-m2', providerId: 'minimax' })).toBe('/model-logos/minimax.svg');
    expect(getModelLogoSrc({ id: 'moonshotai/kimi-k2.5', providerId: 'moonshotai' })).toBe(
      '/model-logos/moonshotai.svg'
    );
    expect(getModelLogoSrc({ id: 'some-provider/model', providerId: 'some-provider' })).toBe(
      'https://models.dev/logos/some-provider.svg'
    );
  });
});

function createStorage(initialValue = ''): Storage {
  let value = initialValue;

  return {
    getItem: vi.fn((key: string) => (key === CODEX_COMPOSER_DRAFT_STORAGE_KEY && value ? value : null)),
    setItem: vi.fn((key: string, nextValue: string) => {
      if (key === CODEX_COMPOSER_DRAFT_STORAGE_KEY) {
        value = nextValue;
      }
    }),
    removeItem: vi.fn((key: string) => {
      if (key === CODEX_COMPOSER_DRAFT_STORAGE_KEY) {
        value = '';
      }
    }),
    clear: vi.fn(),
    key: vi.fn(),
    length: initialValue ? 1 : 0
  };
}
