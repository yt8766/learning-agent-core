import { describe, expect, it } from 'vitest';
import { TaskStatus, type TaskRecord } from '@agent/shared';

import {
  buildSpecialistFindingOutputInstruction,
  normalizeSpecialistFinding,
  upsertSpecialistFinding
} from '../../../src/shared/schemas/specialist-finding-schema';

function createTask(): TaskRecord {
  const now = new Date().toISOString();
  return {
    id: 'task_specialist_finding_test',
    goal: '验证 specialist finding 归一化',
    status: TaskStatus.RUNNING,
    messages: [],
    trace: [],
    agentStates: [],
    approvals: [],
    specialistFindings: [],
    createdAt: now,
    updatedAt: now
  } as unknown as TaskRecord;
}

describe('specialist finding schema', () => {
  it('会归一化数组、默认 domain 并收敛 confidence', () => {
    const finding = normalizeSpecialistFinding({
      specialistId: 'growth-marketing',
      role: 'support',
      summary: '  增长专项判断已补充。  ',
      blockingIssues: ['  ROI 不稳定  ', 'ROI 不稳定'],
      constraints: ['  只看代理渠道  ', ''],
      suggestions: ['  优先验证 Game Only  ', '优先验证 Game Only'],
      evidenceRefs: [' ev_1 ', 'ev_1', ''],
      confidence: 1.7
    });

    expect(finding).toEqual({
      specialistId: 'growth-marketing',
      role: 'support',
      contractVersion: 'specialist-finding.v1',
      source: 'route',
      stage: 'planning',
      domain: 'growth-marketing',
      summary: '增长专项判断已补充。',
      blockingIssues: ['ROI 不稳定'],
      constraints: ['只看代理渠道'],
      suggestions: ['优先验证 Game Only'],
      evidenceRefs: ['ev_1'],
      confidence: 1
    });
  });

  it('会按 specialistId + role 覆盖写入 task', () => {
    const task = createTask();

    upsertSpecialistFinding(task, {
      specialistId: 'product-strategy',
      role: 'lead',
      summary: '第一版结论',
      confidence: 0.8
    });
    upsertSpecialistFinding(task, {
      specialistId: 'product-strategy',
      role: 'lead',
      summary: '第二版结论',
      confidence: 0.9
    });

    expect(task.specialistFindings).toEqual([
      {
        specialistId: 'product-strategy',
        role: 'lead',
        contractVersion: 'specialist-finding.v1',
        source: 'route',
        stage: 'planning',
        domain: 'product-strategy',
        summary: '第二版结论',
        confidence: 0.9
      }
    ]);
  });

  it('会生成 SpecialistFinding 的结构化输出指令', () => {
    const instruction = buildSpecialistFindingOutputInstruction();

    expect(instruction).toContain('你必须只返回结构化 JSON');
    expect(instruction).toContain('specialist-finding.v1');
    expect(instruction).toContain('riskLevel');
  });
});
