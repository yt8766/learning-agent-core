import { describe, expect, it } from 'vitest';

import {
  buildSupervisorDirectReplySystemPrompt,
  buildSupervisorPlanUserPrompt
} from '../src/flows/supervisor/prompts/supervisor-plan-prompts';

describe('@agent/agents-supervisor supervisor plan prompts', () => {
  it('injects structured specialist route hints into the planning prompt', () => {
    const prompt = buildSupervisorPlanUserPrompt('重构报表 dashboard 架构', {
      specialistLead: {
        displayName: '技术架构专家',
        domain: 'technical-architecture',
        requiredCapabilities: ['specialist.technical-architecture'],
        agentId: 'official.coder',
        candidateAgentIds: ['official.coder', 'official.reviewer', 'official.data-report']
      },
      supportingSpecialists: [
        {
          displayName: '风控合规专家',
          domain: 'risk-compliance',
          requiredCapabilities: ['specialist.risk-compliance'],
          agentId: 'official.reviewer',
          candidateAgentIds: ['official.reviewer']
        }
      ],
      routeConfidence: 0.86
    });

    expect(prompt).toContain('主导专家：技术架构专家(technical-architecture)');
    expect(prompt).toContain('主导能力需求：specialist.technical-architecture');
    expect(prompt).toContain('候选官方 Agent：official.coder, official.reviewer, official.data-report');
    expect(prompt).toContain('支撑专家：风控合规专家(risk-compliance; capabilities=specialist.risk-compliance)');
    expect(prompt).toContain('路由置信度：0.86');
  });

  it('includes system tool answer quality rules for macOS utility questions', () => {
    const prompt = buildSupervisorDirectReplySystemPrompt();

    expect(prompt).toContain('系统/工具类问题');
    expect(prompt).toContain('macOS');
    expect(prompt).toContain('版本差异');
    expect(prompt).toContain('临时命令');
    expect(prompt).toContain('长期设置');
    expect(prompt).toContain('风险提醒');
  });
});
