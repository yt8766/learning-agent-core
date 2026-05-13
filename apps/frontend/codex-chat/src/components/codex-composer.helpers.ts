import type { ChatModelOption } from '../types/chat';

export const CODEX_COMPOSER_DRAFT_STORAGE_KEY = 'codex-chat:composer:draft';

const localModelLogoFiles: Record<string, string> = {
  anthropic: 'anthropic.svg',
  deepseek: 'deepseek.svg',
  google: 'google.svg',
  minimax: 'minimax.svg',
  mistral: 'mistral.svg',
  mistralai: 'mistralai.svg',
  moonshotai: 'moonshotai.svg',
  openai: 'openai.svg',
  'x-ai': 'x-ai.svg',
  xai: 'xai.svg',
  zai: 'zai.svg',
  zhipuai: 'zhipuai-apple.png'
};

const modelLogoProviderAliases: Record<string, string> = {
  glm: 'zhipuai',
  kimi: 'moonshotai',
  mistral: 'mistral',
  'mistral-ai': 'mistral',
  moonshot: 'moonshotai',
  x: 'xai',
  'x.ai': 'xai'
};

interface ComposerKeyIntent {
  isComposing: boolean;
  key: string;
  nativeIsComposing: boolean;
  shiftKey: boolean;
}

export function readComposerDraft(storage: Pick<Storage, 'getItem'> | undefined): string {
  if (!storage) {
    return '';
  }

  try {
    return storage.getItem(CODEX_COMPOSER_DRAFT_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function writeComposerDraft(storage: Pick<Storage, 'removeItem' | 'setItem'> | undefined, value: string) {
  if (!storage) {
    return;
  }

  try {
    if (value) {
      storage.setItem(CODEX_COMPOSER_DRAFT_STORAGE_KEY, value);
      return;
    }
    storage.removeItem(CODEX_COMPOSER_DRAFT_STORAGE_KEY);
  } catch {
    // Draft persistence is best-effort; blocked storage must not break typing.
  }
}

export function shouldSubmitComposerKey(intent: ComposerKeyIntent) {
  return intent.key === 'Enter' && !intent.shiftKey && !intent.isComposing && !intent.nativeIsComposing;
}

export function filterComposerModels(models: ChatModelOption[], query: string): ChatModelOption[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return models;
  }

  return models.filter(model =>
    `${model.displayName} ${model.id} ${model.providerId}`.toLowerCase().includes(normalizedQuery)
  );
}

export function getModelLogoProvider(model: Pick<ChatModelOption, 'id' | 'providerId'>): string {
  const provider = (model.providerId || model.id.split('/')[0] || '').trim().toLowerCase();

  return modelLogoProviderAliases[provider] ?? provider;
}

export function getModelLogoSrc(model: Pick<ChatModelOption, 'id' | 'providerId'>): string {
  const provider = getModelLogoProvider(model);

  if (!provider) {
    return '';
  }

  const localFile = localModelLogoFiles[provider];
  if (localFile) {
    return `/model-logos/${localFile}`;
  }

  return `https://models.dev/logos/${provider}.svg`;
}
