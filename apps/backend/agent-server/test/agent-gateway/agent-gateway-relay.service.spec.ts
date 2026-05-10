import { describe, expect, it } from 'vitest';
import { MockAgentGatewayProvider } from '../../src/domains/agent-gateway/providers/mock-agent-gateway-provider';
import { MemoryAgentGatewayRepository } from '../../src/domains/agent-gateway/repositories/memory-agent-gateway.repository';
import { AgentGatewayRelayService } from '../../src/domains/agent-gateway/runtime/agent-gateway-relay.service';

describe('agent gateway relay service', () => {
  it('routes a relay request, returns normalized content, and records usage/logs', async () => {
    const repository = new MemoryAgentGatewayRepository();
    const relayService = new AgentGatewayRelayService(repository, [new MockAgentGatewayProvider()]);

    const response = await relayService.relay({
      model: 'gpt-5.4',
      messages: [{ role: 'user', content: 'ping' }],
      stream: false
    });

    expect(response.providerId).toBe('openai-primary');
    expect(response.content).toBe('mock relay response: ping');
    expect((await repository.listLogs(10)).some(log => log.id === response.logId)).toBe(true);
    expect((await repository.listUsage(10)).some(usage => usage.provider === 'OpenAI 主通道')).toBe(true);
  });
});
