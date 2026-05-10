import { BadRequestException, Body, Controller, Get, Headers, HttpException, HttpStatus, Post } from '@nestjs/common';
import {
  GatewayOpenAIChatCompletionRequestSchema,
  type GatewayOpenAIChatCompletionResponse,
  type GatewayOpenAIModelsResponse
} from '@agent/core';
import { AgentGatewayRelayService } from '../../domains/agent-gateway/runtime/agent-gateway-relay.service';
import { AgentGatewayRuntimeAccountingService } from '../../domains/agent-gateway/runtime/agent-gateway-runtime-accounting.service';
import { AgentGatewayRuntimeAuthService } from '../../domains/agent-gateway/runtime/agent-gateway-runtime-auth.service';
import { openAIError } from '../../domains/agent-gateway/runtime/agent-gateway-openai-error';

@Controller('v1')
export class AgentGatewayOpenAICompatibleController {
  constructor(
    private readonly auth: AgentGatewayRuntimeAuthService,
    private readonly relay: AgentGatewayRelayService,
    private readonly accounting: AgentGatewayRuntimeAccountingService
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
    return {
      object: 'list',
      data: [{ id: 'gpt-5.4', object: 'model', created: 1_778_367_600, owned_by: 'openai-primary' }]
    };
  }

  @Post('chat/completions')
  async chatCompletions(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown
  ): Promise<GatewayOpenAIChatCompletionResponse> {
    const parsed = GatewayOpenAIChatCompletionRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        openAIError('invalid_request', 'Invalid chat completion request', 'invalid_request_error')
      );
    }
    if (parsed.data.stream) {
      throw new BadRequestException(
        openAIError('stream_not_supported', 'stream is not supported in this gateway slice', 'invalid_request_error')
      );
    }

    const principal = await this.auth.authenticate(authorization, 'chat.completions');
    await this.accounting.assertQuota(principal, estimateInputTokens(parsed.data.messages));

    const startedAt = Date.now();
    const relayResponse = await this.relay
      .relay({
        model: parsed.data.model,
        messages: parsed.data.messages,
        stream: false
      })
      .catch(error => {
        throw normalizeOpenAIException(error);
      });
    await this.accounting.recordSuccess(principal, relayResponse.usage, {
      id: `req-${Date.now()}`,
      endpoint: '/v1/chat/completions',
      model: relayResponse.model,
      providerId: relayResponse.providerId,
      statusCode: 200,
      inputTokens: relayResponse.usage.inputTokens,
      outputTokens: relayResponse.usage.outputTokens,
      latencyMs: Date.now() - startedAt
    });

    return {
      id: relayResponse.id,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: relayResponse.model,
      choices: [{ index: 0, message: { role: 'assistant', content: relayResponse.content }, finish_reason: 'stop' }],
      usage: {
        prompt_tokens: relayResponse.usage.inputTokens,
        completion_tokens: relayResponse.usage.outputTokens,
        total_tokens: relayResponse.usage.totalTokens
      }
    };
  }
}

function estimateInputTokens(messages: Array<{ content: string }>): number {
  return messages.reduce((sum, message) => sum + Math.ceil(message.content.length / 4), 0);
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
