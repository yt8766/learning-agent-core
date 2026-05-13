import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Optional,
  Post,
  Res
} from '@nestjs/common';
import {
  GatewayOpenAIChatCompletionRequestSchema,
  type GatewayOpenAIChatCompletionResponse,
  type GatewayOpenAIModelsResponse,
  type GatewayRuntimeStreamEvent
} from '@agent/core';
import { AgentGatewayRuntimeAccountingService } from '../../domains/agent-gateway/runtime/agent-gateway-runtime-accounting.service';
import { AgentGatewayRuntimeAuthService } from '../../domains/agent-gateway/runtime/agent-gateway-runtime-auth.service';
import { openAIError } from '../../domains/agent-gateway/runtime/agent-gateway-openai-error';
import { RuntimeEngineFacade } from '../../domains/agent-gateway/runtime-engine/runtime-engine.facade';
import {
  normalizeOpenAIChatCompletionRequest,
  projectOpenAIChatCompletionResponse
} from '../../domains/agent-gateway/runtime-engine/protocols/openai-chat.protocol';
import { RuntimeStreamingService } from '../../domains/agent-gateway/runtime-engine/streaming/runtime-streaming.service';

interface WritableSseResponse {
  setHeader(name: string, value: string): void;
  write(chunk: string): void;
  end(): void;
}

@Controller('v1')
export class AgentGatewayOpenAICompatibleController {
  constructor(
    private readonly auth: AgentGatewayRuntimeAuthService,
    private readonly runtimeEngine: RuntimeEngineFacade,
    private readonly accounting: AgentGatewayRuntimeAccountingService,
    @Optional()
    private readonly streaming: RuntimeStreamingService = new RuntimeStreamingService()
  ) {}

  @Get('models')
  async models(@Headers('authorization') authorization?: string): Promise<GatewayOpenAIModelsResponse> {
    const startedAt = Date.now();
    const principal = await this.auth.authenticate(authorization, 'models.read');
    await this.accounting.assertQuota(principal, 0);
    await this.accounting.recordSuccess(
      principal,
      { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      {
        id: `req-${Date.now()}`,
        endpoint: '/v1/models',
        model: null,
        providerId: null,
        statusCode: 200,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: Date.now() - startedAt
      }
    );
    return this.runtimeEngine.listModels();
  }

  @Post('chat/completions')
  async chatCompletions(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response?: WritableSseResponse
  ): Promise<GatewayOpenAIChatCompletionResponse | string | void> {
    const parsed = GatewayOpenAIChatCompletionRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        openAIError('invalid_request', 'Invalid chat completion request', 'invalid_request_error')
      );
    }
    const principal = await this.auth.authenticate(authorization, 'chat.completions');
    await this.accounting.assertQuota(principal, estimateInputTokens(parsed.data.messages));

    const startedAt = Date.now();
    const invocationId = `chatcmpl-${Date.now()}`;
    const invocation = normalizeOpenAIChatCompletionRequest({
      requestId: invocationId,
      clientId: principal.client.id,
      apiKeyId: principal.apiKey.id,
      scopes: principal.apiKey.scopes,
      body: parsed.data
    });
    if (parsed.data.stream) {
      const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
      const events = captureStreamUsage(this.runtimeEngine.stream(invocation), usage);
      if (response) {
        await this.streaming.writeOpenAIChatSse(response, events, { model: invocation.model }).catch(error => {
          throw normalizeOpenAIException(error);
        });
        await this.recordStreamSuccess(principal, invocation.model, usage, startedAt);
        return undefined;
      }

      const sse = await this.streaming.toOpenAIChatSse(events, { model: invocation.model }).catch(error => {
        throw normalizeOpenAIException(error);
      });
      await this.recordStreamSuccess(principal, invocation.model, usage, startedAt);
      return sse;
    }

    const result = await this.runtimeEngine.invoke(invocation).catch(error => {
      throw normalizeOpenAIException(error);
    });
    await this.accounting.recordSuccess(principal, result.usage, {
      id: `req-${Date.now()}`,
      endpoint: '/v1/chat/completions',
      model: result.model,
      providerId: result.route.providerKind,
      statusCode: 200,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      latencyMs: Date.now() - startedAt
    });

    return projectOpenAIChatCompletionResponse(result);
  }

  private async recordStreamSuccess(
    principal: Awaited<ReturnType<AgentGatewayRuntimeAuthService['authenticate']>>,
    model: string,
    usage: { inputTokens: number; outputTokens: number; totalTokens: number },
    startedAt: number
  ): Promise<void> {
    await this.accounting.recordSuccess(principal, usage, {
      id: `req-${Date.now()}`,
      endpoint: '/v1/chat/completions',
      model,
      providerId: null,
      statusCode: 200,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      latencyMs: Date.now() - startedAt
    });
  }
}

async function* captureStreamUsage(
  events: AsyncIterable<GatewayRuntimeStreamEvent>,
  usage: { inputTokens: number; outputTokens: number; totalTokens: number }
): AsyncIterable<GatewayRuntimeStreamEvent> {
  for await (const event of events) {
    if (event.type === 'usage') {
      usage.inputTokens = event.usage.inputTokens;
      usage.outputTokens = event.usage.outputTokens;
      usage.totalTokens = event.usage.totalTokens;
    }
    yield event;
  }
}

function estimateInputTokens(messages: Array<{ content: string | Array<{ text?: string }> }>): number {
  return messages.reduce((sum, message) => sum + Math.ceil(estimateContentLength(message.content) / 4), 0);
}

function estimateContentLength(content: string | Array<{ text?: string }>): number {
  if (typeof content === 'string') return content.length;
  return content.reduce((sum, part) => sum + (part.text?.length ?? 0), 0);
}

function normalizeOpenAIException(error: unknown): Error {
  if (!(error instanceof HttpException)) {
    const message = error instanceof Error ? error.message : String(error);
    return new HttpException(openAIError('api_error', message, 'api_error'), HttpStatus.INTERNAL_SERVER_ERROR);
  }
  const response = error.getResponse();
  if (isOpenAIErrorResponse(response)) return error;
  const status = error.getStatus();
  const code = openAIErrorCode(response);
  const message = openAIErrorMessage(response, error.message);
  return new HttpException(openAIError(code, message, status >= 500 ? 'api_error' : 'invalid_request_error'), status);
}

function isOpenAIErrorResponse(response: unknown): response is { error: unknown } {
  if (!response || typeof response !== 'object' || !('error' in response)) return false;
  const error = (response as { error?: unknown }).error;
  return Boolean(
    error &&
    typeof error === 'object' &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { type?: unknown }).type === 'string' &&
    typeof (error as { message?: unknown }).message === 'string'
  );
}

function openAIErrorCode(response: unknown): string {
  if (response && typeof response === 'object' && 'code' in response) {
    const code = (response as { code?: unknown }).code;
    if (typeof code === 'string' && code) return code.toLowerCase();
  }
  return 'api_error';
}

function openAIErrorMessage(response: unknown, fallback: string): string {
  if (response && typeof response === 'object' && 'message' in response) {
    const message = (response as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}
