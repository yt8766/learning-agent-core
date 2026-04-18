import { loadSettings } from '@agent/config';
import {
  createDefaultRuntimeLlmProvider,
  createLlmProviderFactory,
  createModelCapabilities,
  type ChatMessage,
  type GenerateTextOptions,
  type LlmProvider,
  type LlmProviderModelInfo
} from '../src/index.js';

class DemoCustomProvider implements LlmProvider {
  readonly providerId: string;
  readonly displayName: string;

  constructor(
    private readonly config: {
      id: string;
      displayName?: string;
      models: string[];
      roleModels?: Partial<Record<'manager' | 'research' | 'executor' | 'reviewer', string>>;
    }
  ) {
    this.providerId = config.id;
    this.displayName = config.displayName ?? config.id;
  }

  supportedModels(): LlmProviderModelInfo[] {
    return this.config.models.map(modelId => ({
      id: modelId,
      displayName: modelId,
      providerId: this.providerId,
      contextWindow: 64_000,
      maxOutput: 4_096,
      capabilities: createModelCapabilities('text')
    }));
  }

  isConfigured(): boolean {
    return true;
  }

  async generateText(messages: ChatMessage[], options: GenerateTextOptions): Promise<string> {
    const modelId =
      options.modelId ?? this.config.roleModels?.[options.role] ?? this.config.models[0] ?? 'custom-http-chat';
    return `[demo-custom provider=${this.providerId} model=${modelId}] ${messages.at(-1)?.content ?? ''}`;
  }

  async streamText(
    messages: ChatMessage[],
    options: GenerateTextOptions,
    onToken: (token: string, metadata?: { model?: string }) => void
  ): Promise<string> {
    const text = await this.generateText(messages, options);
    onToken(text, { model: options.modelId ?? this.config.models[0] });
    return text;
  }

  async generateObject<T>(): Promise<T> {
    throw new Error('Demo custom provider only implements text generation in this sample.');
  }
}

const customFactory = createLlmProviderFactory({
  type: 'custom-http',
  create(config) {
    return new DemoCustomProvider(config);
  }
});

async function main() {
  const llm = createDefaultRuntimeLlmProvider({
    settings: loadSettings({
      workspaceRoot: process.cwd(),
      overrides: {
        providers: [
          {
            id: 'custom-http',
            type: 'custom-http',
            displayName: 'Custom HTTP',
            models: ['custom-http-chat'],
            roleModels: {
              manager: 'custom-http-chat'
            }
          }
        ],
        routing: {
          manager: {
            primary: 'custom-http/custom-http-chat'
          }
        },
        zhipuApiKey: '',
        zhipuApiBaseUrl: '',
        zhipuModels: {
          manager: 'glm-5',
          research: 'glm-5',
          executor: 'glm-5',
          reviewer: 'glm-5'
        },
        zhipuThinking: {
          manager: false,
          research: false,
          executor: false,
          reviewer: false
        }
      }
    }),
    customFactories: [customFactory]
  });

  const text = await llm.generateText([{ role: 'user', content: '请演示自定义 provider factory 如何接入 runtime。' }], {
    role: 'manager'
  });

  console.log(
    'provider ids:',
    llm
      .supportedModels()
      .map(model => `${model.providerId}/${model.id}`)
      .join(', ')
  );
  console.log('demo custom factory result:', text);
}

void main();
