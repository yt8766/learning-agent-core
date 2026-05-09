import { Injectable } from '@nestjs/common';
import type { GatewayRelayRequest } from '@agent/core';
import type { AgentGatewayProvider } from './agent-gateway-provider';

@Injectable()
export class MockAgentGatewayProvider implements AgentGatewayProvider {
  readonly providerId = 'openai-primary';

  async complete(request: GatewayRelayRequest) {
    const lastUserMessage = [...request.messages].reverse().find(message => message.role === 'user')?.content ?? '';
    const content = `mock relay response: ${lastUserMessage}`;
    const inputTokens = Math.ceil(lastUserMessage.length / 4);
    const outputTokens = Math.ceil(content.length / 4);

    return {
      model: request.model,
      content,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens
      }
    };
  }
}
