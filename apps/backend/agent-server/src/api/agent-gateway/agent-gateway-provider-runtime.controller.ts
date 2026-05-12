import { Body, Controller, Headers, Optional, Param, Post, ServiceUnavailableException } from '@nestjs/common';
import { AgentGatewayRuntimeAuthService } from '../../domains/agent-gateway/runtime/agent-gateway-runtime-auth.service';
import { DeterministicOpenAICompatibleExecutor } from '../../domains/agent-gateway/runtime-engine/executors';
import { normalizeClaudeMessagesRequest } from '../../domains/agent-gateway/runtime-engine/protocols/claude-messages.protocol';
import { normalizeGeminiGenerateContentRequest } from '../../domains/agent-gateway/runtime-engine/protocols/gemini-generate-content.protocol';
import { normalizeOpenAIChatCompletionRequest } from '../../domains/agent-gateway/runtime-engine/protocols/openai-chat.protocol';
import { normalizeOpenAIResponsesRequest } from '../../domains/agent-gateway/runtime-engine/protocols/openai-responses.protocol';
import type {
  ProviderPinnedRuntimeInvocation,
  RuntimeProtocolClient
} from '../../domains/agent-gateway/runtime-engine/protocols/provider-pinned-runtime-invocation';
import { getProviderPinnedRuntimeContext } from '../../domains/agent-gateway/runtime-engine/protocols/provider-pinned-runtime-invocation';
import { RuntimeEngineFacade } from '../../domains/agent-gateway/runtime-engine/runtime-engine.facade';
import type { RuntimeEngineInvokeResult } from '../../domains/agent-gateway/runtime-engine/types/runtime-engine.types';

@Controller('agent-gateway/runtime/provider')
export class AgentGatewayProviderRuntimeController {
  constructor(
    @Optional()
    private readonly auth?: AgentGatewayRuntimeAuthService,
    @Optional()
    private readonly runtimeEngine?: RuntimeEngineFacade
  ) {}

  @Post('openai/responses')
  async openAIResponses(
    @Body() body: unknown,
    @Headers('authorization') authorization?: string
  ): Promise<RuntimeEngineInvokeResult> {
    return this.invokePinned(
      normalizeOpenAIResponsesRequest({
        requestId: `resp-${Date.now()}`,
        client: await this.resolveClient(authorization),
        body
      })
    );
  }

  @Post('openai/chat/completions')
  async openAIChatCompletions(
    @Body() body: { model: string; messages: Array<{ role: string; content: string }>; stream?: boolean },
    @Headers('authorization') authorization?: string
  ): Promise<RuntimeEngineInvokeResult> {
    const client = await this.resolveClient(authorization);
    return this.invokePinned(
      normalizeOpenAIChatCompletionRequest({
        requestId: `chatcmpl-${Date.now()}`,
        clientId: client.clientId,
        apiKeyId: client.apiKeyId,
        scopes: client.scopes,
        body,
        providerKind: 'openaiCompatible'
      })
    );
  }

  @Post('claude/messages')
  async claudeMessages(
    @Body() body: unknown,
    @Headers('authorization') authorization?: string
  ): Promise<RuntimeEngineInvokeResult> {
    return this.invokePinned(
      normalizeClaudeMessagesRequest({
        requestId: `msg-${Date.now()}`,
        client: await this.resolveClient(authorization),
        body
      })
    );
  }

  @Post('gemini/models/:model/generateContent')
  async geminiGenerateContentForModel(
    @Param('model') model: string,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string
  ): Promise<RuntimeEngineInvokeResult> {
    return this.invokePinned(
      normalizeGeminiGenerateContentRequest({
        requestId: `gemini-${Date.now()}`,
        client: await this.resolveClient(authorization),
        body,
        model
      })
    );
  }

  @Post('gemini/generateContent')
  async geminiGenerateContent(
    @Body() body: unknown,
    @Headers('authorization') authorization?: string
  ): Promise<RuntimeEngineInvokeResult> {
    return this.invokePinned(
      normalizeGeminiGenerateContentRequest({
        requestId: `gemini-${Date.now()}`,
        client: await this.resolveClient(authorization),
        body
      })
    );
  }

  private async invokePinned(invocation: ProviderPinnedRuntimeInvocation): Promise<RuntimeEngineInvokeResult> {
    const providerKind = getProviderPinnedRuntimeContext(invocation)?.providerKind ?? 'openaiCompatible';
    if (this.runtimeEngine) return this.runtimeEngine.invoke(invocation, { providerKind });
    if (this.auth) throw new ServiceUnavailableException('Runtime engine facade is not configured');

    const executor = new DeterministicOpenAICompatibleExecutor({
      providerKind,
      modelIds: [invocation.model]
    });
    return executor.invoke(invocation);
  }

  private async resolveClient(authorization?: string): Promise<RuntimeProtocolClient> {
    if (!this.auth) {
      return { clientId: 'provider-runtime-test-client', apiKeyId: 'provider-runtime-test-key', scopes: [] };
    }
    const principal = await this.auth.authenticate(authorization, 'chat.completions');
    return {
      clientId: principal.client.id,
      apiKeyId: principal.apiKey.id,
      scopes: principal.apiKey.scopes
    };
  }
}
