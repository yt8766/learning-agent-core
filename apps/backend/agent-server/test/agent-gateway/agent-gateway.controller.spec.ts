import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AgentGatewayController } from '../../src/api/agent-gateway/agent-gateway.controller';
import { AgentGatewayService } from '../../src/domains/agent-gateway/services/agent-gateway.service';

describe('AgentGatewayController', () => {
  it('returns gateway snapshot data', () => {
    const controller = new AgentGatewayController(new AgentGatewayService());

    expect(controller.snapshot().providerCredentialSets.length).toBeGreaterThan(0);
  });

  it('normalizes logs list limits', () => {
    const controller = new AgentGatewayController(new AgentGatewayService());

    expect(controller.logs({ limit: '1' }).items).toHaveLength(1);
  });

  it('runs preprocess and postprocess token accounting', () => {
    const controller = new AgentGatewayController(new AgentGatewayService());

    const preprocess = controller.preprocess({ prompt: ' hello   gateway ' });
    const accounting = controller.accounting({ providerId: 'openai-primary', inputText: 'hello', outputText: 'world' });
    expect(preprocess.normalizedPrompt).toBe('hello gateway');
    expect(accounting.totalTokens).toBe(accounting.inputTokens + accounting.outputTokens);
  });

  it('rejects malformed probe requests', () => {
    const controller = new AgentGatewayController(new AgentGatewayService());

    expect(() => controller.probe({ providerId: '' })).toThrow(BadRequestException);
  });
});
