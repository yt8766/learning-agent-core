import { AgentRole } from '@agent/core';
import { describe, expect, it } from 'vitest';

import { compileSkillContractIntoPlan } from '../src/flows/supervisor/pipeline-stage-nodes';
import type { TaskRecord } from '@agent/core';

describe('pipeline stage nodes', () => {
  it('将挂载技能步骤编译进执行计划并为不同角色补足子任务', () => {
    const task = {
      capabilityAttachments: [
        {
          id: 'skill-1',
          kind: 'skill',
          enabled: true,
          displayName: 'Lark 发布技能',
          sourceId: 'lark-publish',
          owner: { ownerType: 'user-attached' },
          metadata: {
            requiredConnectors: ['lark'],
            approvalSensitiveTools: ['send_message'],
            steps: [
              { title: '检索消息', instruction: '先读取发布渠道状态', toolNames: ['search_doc'] },
              { title: '发送通知', instruction: '把结果同步到飞书', toolNames: ['send_message'] },
              { title: '安全复核', instruction: '检查是否命中审批规则', toolNames: ['security_review'] }
            ]
          }
        }
      ],
      requestedHints: {
        requestedSkill: 'lark'
      }
    } as unknown as TaskRecord;

    const plan = compileSkillContractIntoPlan(task, {
      summary: '原始计划',
      steps: ['初始步骤'],
      subTasks: [
        {
          id: 'task-1',
          title: '研究需求',
          description: '先完成背景调查',
          assignedTo: AgentRole.RESEARCH,
          status: 'pending'
        }
      ]
    });

    expect(plan.summary).toContain('已挂载技能：Lark 发布技能');
    expect(plan.summary).toContain('依赖连接器：lark');
    expect(plan.steps).toEqual(
      expect.arrayContaining([
        '初始步骤',
        '1. 检索消息: 先读取发布渠道状态',
        '2. 发送通知: 把结果同步到飞书',
        '3. 安全复核: 检查是否命中审批规则'
      ])
    );
    expect(plan.subTasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Lark 发布技能 · 检索消息',
          assignedTo: AgentRole.RESEARCH
        }),
        expect.objectContaining({
          title: 'Lark 发布技能 · 发送通知',
          assignedTo: AgentRole.EXECUTOR
        }),
        expect.objectContaining({
          title: 'Lark 发布技能 · 安全复核',
          assignedTo: AgentRole.REVIEWER
        })
      ])
    );
    expect(plan.subTasks[0]?.description).toContain('技能步骤：检索消息(先读取发布渠道状态)');
  });
});
