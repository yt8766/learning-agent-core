import { loadSettings } from '@agent/config';
import {
  MODEL_CAPABILITIES,
  createDefaultRuntimeLlmProvider,
  createLlmProviderFactory,
  createModelCapabilities,
  type ChatMessage,
  type GenerateTextOptions,
  type LlmProvider,
  type LlmProviderModelInfo
} from '../src/index.js';

class DemoCapabilityProvider implements LlmProvider {
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
      contextWindow: 128_000,
      maxOutput: 8_192,
      capabilities:
        modelId === 'tool-specialist' ? createModelCapabilities('text', 'tool-call') : createModelCapabilities('text')
    }));
  }

  isConfigured(): boolean {
    return true;
  }

  async generateText(messages: ChatMessage[], options: GenerateTextOptions): Promise<string> {
    const modelId = options.modelId ?? this.config.roleModels?.[options.role] ?? this.config.models[0];
    return `[provider=${this.providerId} model=${modelId}] ${messages.at(-1)?.content ?? ''}`;
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
    throw new Error('Demo capability provider only implements text generation in this sample.');
  }
}

const capabilityFactory = createLlmProviderFactory({
  type: 'demo-capability',
  create(config) {
    return new DemoCapabilityProvider(config);
  }
});

async function main() {
  const llm = createDefaultRuntimeLlmProvider({
    settings: loadSettings({
      workspaceRoot: process.cwd(),
      overrides: {
        providers: [
          {
            id: 'demo-capability',
            type: 'demo-capability',
            displayName: 'Demo Capability Provider',
            models: ['balanced-text', 'tool-specialist'],
            roleModels: {
              manager: 'balanced-text'
            }
          }
        ],
        routing: {
          manager: {
            primary: 'demo-capability/balanced-text',
            fallback: ['demo-capability/tool-specialist']
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
    customFactories: [capabilityFactory]
  });

  const plainTextResult = await llm.generateText([{ role: 'user', content: '普通文本任务' }], {
    role: 'manager'
  });

  const toolCallResult = await llm.generateText([{ role: 'user', content: '需要具备工具调用能力的任务' }], {
    role: 'manager',
    requiredCapabilities: createModelCapabilities(MODEL_CAPABILITIES.TOOL_CALL)
  });

  console.log(
    JSON.stringify(
      {
        supportedModels: llm.supportedModels().map(model => `${model.providerId}/${model.id}`),
        plainTextRoute: plainTextResult,
        toolCallRoute: toolCallResult
      },
      null,
      2
    )
  );
}

void main();
