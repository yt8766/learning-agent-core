import { describe, expect, it } from 'vitest';

import { ApprovalDecision, TaskStatus } from '@agent/shared';

import { createOrchestrator } from './orchestrator.test.utils';

// task.activeInterrupt remains the persisted 司礼监 / InterruptController projection in orchestrator fixtures.
describe('AgentOrchestrator skill and knowledge flows', () => {
  it('显式 Skill 命令会解析成流程模板并写入任务状态', async () => {
    const orchestrator = createOrchestrator();
    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '/review 请审查这个仓库的潜在风险',
      constraints: [],
      sessionId: 'session-review'
    });

    expect(task.goal).toBe('请审查这个仓库的潜在风险');
    expect(task.skillId).toBe('review');
    expect(task.skillStage).toBe('completed');
    expect(task.resolvedWorkflow).toEqual(expect.objectContaining({ id: 'review', displayName: '代码审查流程' }));
    expect(task.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ node: 'skill_resolved' }),
        expect.objectContaining({ node: 'skill_stage_started' }),
        expect.objectContaining({ node: 'skill_stage_completed' })
      ])
    );
  });

  it('创建任务时会把 memory search 命中的规则也写入复用状态与证据', async () => {
    const orchestrator = createOrchestrator(undefined, {
      memorySearchResults: [
        {
          id: 'mem_release_check',
          type: 'success_case',
          summary: '发布前先跑 build',
          content: 'Run build first.',
          tags: ['release'],
          createdAt: '2026-03-22T00:00:00.000Z',
          status: 'active'
        }
      ],
      ruleSearchResults: [
        {
          id: 'rule_release_gate',
          name: 'release_gate',
          summary: '发布前必须通过 build',
          conditions: ['before release'],
          action: 'run build',
          createdAt: '2026-03-22T00:00:00.000Z',
          status: 'active'
        }
      ]
    });

    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '/ship 帮我整理发布前检查',
      constraints: [],
      sessionId: 'session-ship'
    });

    expect(task.reusedMemories).toContain('mem_release_check');
    expect(task.reusedRules).toContain('rule_release_gate');
    expect(task.externalSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceType: 'memory_reuse' }),
        expect.objectContaining({ sourceType: 'rule_reuse' })
      ])
    );
  });

  it('创建任务时会把本地 skill search 结果写入 task.skillSearch', async () => {
    const orchestrator = createOrchestrator();

    orchestrator.setLocalSkillSuggestionResolver(async () => ({
      capabilityGapDetected: true,
      status: 'suggested',
      safetyNotes: ['Release Check：installable，不依赖额外连接器。'],
      suggestions: [
        {
          id: 'release_check',
          kind: 'manifest',
          displayName: 'Release Check',
          summary: '执行发布前检查',
          sourceId: 'workspace-skills',
          score: 0.9,
          availability: 'installable',
          reason: '当前 profile 可从本地来源安装。',
          requiredCapabilities: ['release-ops'],
          requiredConnectors: ['ci'],
          version: '0.1.0'
        }
      ]
    }));

    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '/ship 帮我做发布前检查',
      constraints: [],
      sessionId: 'session-ship-skill-search'
    });

    expect(task.skillSearch).toEqual(
      expect.objectContaining({
        capabilityGapDetected: true,
        status: 'suggested',
        suggestions: [expect.objectContaining({ id: 'release_check' })]
      })
    );
  });

  it('创建任务时会在执行前补齐远程 skill 并写回当前任务能力链', async () => {
    const orchestrator = createOrchestrator();

    orchestrator.setLocalSkillSuggestionResolver(async () => ({
      capabilityGapDetected: true,
      status: 'suggested',
      safetyNotes: ['发现远程候选。'],
      suggestions: [
        {
          id: 'remote:vercel-labs/skills:find-skills',
          kind: 'remote-skill',
          displayName: 'find-skills',
          summary: '安装后可继续补技能。',
          score: 0.93,
          availability: 'installable-remote',
          reason: '当前轮需要先补专业 skill。',
          requiredCapabilities: [],
          repo: 'vercel-labs/skills',
          skillName: 'find-skills',
          sourceLabel: 'skills.sh',
          installCommand: 'npx skills add vercel-labs/skills@find-skills -g -y'
        }
      ]
    }));
    orchestrator.setPreExecutionSkillInterventionResolver(async () => ({
      skillSearch: {
        capabilityGapDetected: false,
        status: 'auto-installed',
        safetyNotes: ['已在执行前自动安装远程 skill。'],
        suggestions: [
          {
            id: 'remote-vercel-labs-skills-find-skills',
            kind: 'installed',
            displayName: 'find-skills',
            summary: '已安装并可参与本轮执行。',
            score: 1,
            availability: 'ready',
            reason: '当前轮已补齐 skill。',
            requiredCapabilities: []
          }
        ]
      },
      usedInstalledSkills: ['installed-skill:remote-vercel-labs-skills-find-skills'],
      traceSummary: '已在执行前自动安装远程 skill。',
      progressSummary: '执行前已补齐 find-skills。'
    }));

    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '请帮我找更专业的 OpenClaw skill 再继续回答',
      constraints: [],
      sessionId: 'session-runtime-skill-auto-install'
    });

    expect(task.usedInstalledSkills).toContain('installed-skill:remote-vercel-labs-skills-find-skills');
    expect(task.skillSearch).toEqual(
      expect.objectContaining({
        status: 'auto-installed',
        suggestions: [expect.objectContaining({ availability: 'ready', displayName: 'find-skills' })]
      })
    );
    expect(task.trace).toEqual(
      expect.arrayContaining([expect.objectContaining({ node: 'skill_runtime_intervention' })])
    );
  });

  it('远程 skill 安装需要审批时，批准后会继续当前轮执行', async () => {
    const orchestrator = createOrchestrator();

    orchestrator.setLocalSkillSuggestionResolver(async () => ({
      capabilityGapDetected: true,
      status: 'suggested',
      safetyNotes: ['发现远程候选。'],
      suggestions: [
        {
          id: 'remote:vercel-labs/skills:find-skills',
          kind: 'remote-skill',
          displayName: 'find-skills',
          summary: '安装后可继续补技能。',
          score: 0.93,
          availability: 'installable-remote',
          reason: '当前轮需要先补专业 skill。',
          requiredCapabilities: [],
          repo: 'vercel-labs/skills',
          skillName: 'find-skills',
          sourceLabel: 'skills.sh'
        }
      ]
    }));
    orchestrator.setPreExecutionSkillInterventionResolver(async () => ({
      pendingApproval: {
        toolName: 'npx skills add',
        reason: '当前轮需要先安装 find-skills 才能继续。',
        preview: [{ label: 'Skill', value: 'find-skills' }]
      },
      pendingExecution: {
        receiptId: 'receipt-find-skills',
        skillDisplayName: 'find-skills'
      },
      traceSummary: '当前轮等待远程 skill 安装审批。',
      progressSummary: '当前轮已暂停等待远程 skill 安装审批。'
    }));
    orchestrator.setSkillInstallApprovalResolver(async () => ({
      skillSearch: {
        capabilityGapDetected: false,
        status: 'auto-installed',
        safetyNotes: ['已安装完成。'],
        suggestions: [
          {
            id: 'remote-vercel-labs-skills-find-skills',
            kind: 'installed',
            displayName: 'find-skills',
            summary: '已安装并可参与本轮执行。',
            score: 1,
            availability: 'ready',
            reason: '当前轮已补齐 skill。',
            requiredCapabilities: []
          }
        ]
      },
      usedInstalledSkills: ['installed-skill:remote-vercel-labs-skills-find-skills'],
      traceSummary: '已批准并完成远程 skill 安装。',
      progressSummary: 'find-skills 已安装完成。'
    }));

    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '请先找 skill 再继续回答',
      constraints: [],
      sessionId: 'session-runtime-skill-approval'
    });

    expect(task.status).toBe(TaskStatus.WAITING_APPROVAL);
    expect(task.pendingApproval?.intent).toBe('install_skill');
    expect(task.activeInterrupt).toEqual(
      expect.objectContaining({
        kind: 'skill-install',
        source: 'graph',
        resumeStrategy: 'command',
        status: 'pending'
      })
    );

    const resumed = await orchestrator.applyApproval(
      task.id,
      { intent: task.pendingApproval!.intent, actor: 'agent-chat-user' },
      ApprovalDecision.APPROVED
    );

    expect(resumed?.pendingApproval).toBeUndefined();
    expect(resumed?.usedInstalledSkills).toContain('installed-skill:remote-vercel-labs-skills-find-skills');
    expect(resumed?.trace).toEqual(
      expect.arrayContaining([expect.objectContaining({ node: 'skill_runtime_intervention' })])
    );
    expect(resumed?.status).not.toBe(TaskStatus.WAITING_APPROVAL);
  });

  it('运行中发现能力缺口时会插入 skill 安装子阶段，而不是等整轮结束', async () => {
    const orchestrator = createOrchestrator();
    let preExecutionCalls = 0;
    let runtimeCalls = 0;

    orchestrator.setLocalSkillSuggestionResolver(async () => ({
      capabilityGapDetected: true,
      status: 'suggested',
      safetyNotes: ['发现远程候选。'],
      suggestions: [
        {
          id: 'remote:vercel-labs/skills:find-skills',
          kind: 'remote-skill',
          displayName: 'find-skills',
          summary: '安装后可继续补技能。',
          score: 0.93,
          availability: 'installable-remote',
          reason: '当前轮需要先补专业 skill。',
          requiredCapabilities: [],
          repo: 'vercel-labs/skills',
          skillName: 'find-skills',
          sourceLabel: 'skills.sh'
        }
      ]
    }));
    orchestrator.setPreExecutionSkillInterventionResolver(async () => {
      preExecutionCalls += 1;
      return undefined;
    });
    orchestrator.setRuntimeSkillInterventionResolver(async () => {
      runtimeCalls += 1;
      return {
        pendingApproval: {
          toolName: 'npx skills add',
          reason: '研究过程中识别到需要先安装 find-skills 才能继续。',
          preview: [{ label: 'Skill', value: 'find-skills' }]
        },
        pendingExecution: {
          receiptId: 'receipt-runtime-find-skills',
          skillDisplayName: 'find-skills'
        },
        traceSummary: '运行中触发远程 skill 安装审批。',
        progressSummary: '当前轮已切入远程 skill 安装审批。'
      };
    });
    orchestrator.setSkillInstallApprovalResolver(async () => ({
      skillSearch: {
        capabilityGapDetected: false,
        status: 'auto-installed',
        safetyNotes: ['已安装完成。'],
        suggestions: [
          {
            id: 'remote-vercel-labs-skills-find-skills',
            kind: 'installed',
            displayName: 'find-skills',
            summary: '已安装并可参与本轮执行。',
            score: 1,
            availability: 'ready',
            reason: '当前轮已补齐 skill。',
            requiredCapabilities: []
          }
        ]
      },
      usedInstalledSkills: ['installed-skill:remote-vercel-labs-skills-find-skills'],
      traceSummary: '运行中审批已通过，远程 skill 已安装。',
      progressSummary: 'find-skills 已安装完成，当前轮继续执行。'
    }));

    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '/review 请研究一下这个复杂系统设计，再给我更专业的回答',
      constraints: [],
      sessionId: 'session-runtime-intervention'
    });

    expect(preExecutionCalls).toBe(1);
    expect(runtimeCalls).toBeGreaterThan(0);
    expect(task.status).toBe(TaskStatus.WAITING_APPROVAL);
    expect(task.pendingApproval?.intent).toBe('install_skill');
    expect(task.activeInterrupt).toEqual(
      expect.objectContaining({
        kind: 'skill-install',
        source: 'graph',
        resumeStrategy: 'command',
        status: 'pending'
      })
    );
    expect(task.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ node: 'skill_runtime_intervention' }),
        expect.objectContaining({ node: 'approval_gate' })
      ])
    );

    const resumed = await orchestrator.applyApproval(
      task.id,
      { intent: task.pendingApproval!.intent, actor: 'agent-chat-user' },
      ApprovalDecision.APPROVED
    );

    expect(resumed?.pendingApproval).toBeUndefined();
    expect(resumed?.activeInterrupt).toBeUndefined();
    expect(resumed?.usedInstalledSkills).toContain('installed-skill:remote-vercel-labs-skills-find-skills');
    expect(resumed?.status).not.toBe(TaskStatus.WAITING_APPROVAL);
  });

  it('direct-reply 路线发现 skill gap 时会先触发 graph interrupt，再恢复直答', async () => {
    const orchestrator = createOrchestrator();

    orchestrator.setLocalSkillSuggestionResolver(async () => ({
      capabilityGapDetected: true,
      status: 'suggested',
      safetyNotes: ['发现远程候选。'],
      suggestions: [
        {
          id: 'remote:vercel-labs/skills:find-skills',
          kind: 'remote-skill',
          displayName: 'find-skills',
          summary: '安装后可继续补技能。',
          score: 0.93,
          availability: 'installable-remote',
          reason: '当前轮需要先补专业 skill。',
          requiredCapabilities: [],
          repo: 'vercel-labs/skills',
          skillName: 'find-skills',
          sourceLabel: 'skills.sh'
        }
      ]
    }));
    orchestrator.setRuntimeSkillInterventionResolver(
      async ({ currentStep }: { currentStep: 'direct_reply' | 'research' }) =>
        currentStep === 'direct_reply'
          ? {
              pendingApproval: {
                toolName: 'npx skills add',
                reason: '直答前需要先安装 find-skills。',
                preview: [{ label: 'Skill', value: 'find-skills' }]
              },
              pendingExecution: {
                receiptId: 'receipt-direct-reply-find-skills',
                skillDisplayName: 'find-skills'
              },
              traceSummary: '直答前发现需要先安装远程 skill。',
              progressSummary: '直答前已暂停等待远程 skill 安装审批。'
            }
          : undefined
    );
    orchestrator.setSkillInstallApprovalResolver(async () => ({
      skillSearch: {
        capabilityGapDetected: false,
        status: 'installed',
        safetyNotes: ['审批通过后已安装。'],
        suggestions: [
          {
            id: 'installed-skill:find-skills',
            kind: 'installed',
            displayName: 'find-skills',
            summary: '已安装完成。',
            score: 1,
            availability: 'ready',
            reason: '审批后已安装。',
            requiredCapabilities: []
          }
        ]
      },
      usedInstalledSkills: ['installed-skill:find-skills'],
      traceSummary: '审批通过后已恢复直答并装入 find-skills。',
      progressSummary: 'find-skills 已装入当前直答能力链。'
    }));

    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '请简单介绍一下这个系统的能力边界',
      constraints: [],
      sessionId: 'session-direct-reply-interrupt'
    });

    expect(task.chatRoute?.flow).toBe('direct-reply');
    expect(task.status).toBe(TaskStatus.WAITING_APPROVAL);
    expect(task.activeInterrupt).toEqual(
      expect.objectContaining({
        kind: 'skill-install',
        source: 'graph',
        resumeStrategy: 'command',
        status: 'pending'
      })
    );

    const resumed = await orchestrator.applyApproval(
      task.id,
      { intent: task.pendingApproval!.intent, actor: 'agent-chat-user' },
      ApprovalDecision.APPROVED
    );

    expect(resumed?.pendingApproval).toBeUndefined();
    expect(resumed?.activeInterrupt).toBeUndefined();
    expect(resumed?.usedInstalledSkills).toContain('installed-skill:find-skills');
    expect(resumed?.status).toBe(TaskStatus.COMPLETED);
    expect(resumed?.result).toBeTruthy();
  });

  it('后台任务在 runner 消费前也会先走 bootstrap interrupt', async () => {
    const orchestrator = createOrchestrator();

    orchestrator.setLocalSkillSuggestionResolver(async () => ({
      capabilityGapDetected: true,
      status: 'suggested',
      safetyNotes: ['发现远程候选。'],
      suggestions: [
        {
          id: 'remote:vercel-labs/skills:find-skills',
          kind: 'remote-skill',
          displayName: 'find-skills',
          summary: '安装后可继续补技能。',
          score: 0.93,
          availability: 'installable-remote',
          reason: '当前轮需要先补专业 skill。',
          requiredCapabilities: [],
          repo: 'vercel-labs/skills',
          skillName: 'find-skills',
          sourceLabel: 'skills.sh'
        }
      ]
    }));
    orchestrator.setPreExecutionSkillInterventionResolver(async () => ({
      pendingApproval: {
        toolName: 'npx skills add',
        reason: '后台任务启动前需要先安装 find-skills。',
        preview: [{ label: 'Skill', value: 'find-skills' }]
      },
      pendingExecution: {
        receiptId: 'receipt-background-find-skills',
        skillDisplayName: 'find-skills'
      },
      traceSummary: '后台任务在启动前识别到需要安装远程 skill。',
      progressSummary: '后台任务启动前已暂停等待远程 skill 安装审批。'
    }));
    orchestrator.setSkillInstallApprovalResolver(async () => ({
      skillSearch: {
        capabilityGapDetected: false,
        status: 'installed',
        safetyNotes: ['审批通过后已安装。'],
        suggestions: [
          {
            id: 'installed-skill:find-skills',
            kind: 'installed',
            displayName: 'find-skills',
            summary: '已安装完成。',
            score: 1,
            availability: 'ready',
            reason: '审批后已安装。',
            requiredCapabilities: []
          }
        ]
      },
      usedInstalledSkills: ['installed-skill:find-skills'],
      traceSummary: '后台任务审批通过后已装入 find-skills。',
      progressSummary: 'find-skills 已装入后台任务能力链。'
    }));

    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '请在后台为我整理一份更专业的调研方案',
      constraints: []
    });

    expect(task.sessionId).toBeUndefined();
    expect(task.status).toBe(TaskStatus.QUEUED);

    const started = await orchestrator.runBackgroundTask(task.id);
    expect(started?.status).toBe(TaskStatus.WAITING_APPROVAL);
    expect(started?.activeInterrupt).toEqual(
      expect.objectContaining({
        kind: 'skill-install',
        source: 'graph',
        resumeStrategy: 'command',
        status: 'pending'
      })
    );

    const resumed = await orchestrator.applyApproval(
      task.id,
      { intent: 'install_skill', actor: 'background-runner-user' },
      ApprovalDecision.APPROVED
    );

    expect(resumed?.pendingApproval).toBeUndefined();
    expect(resumed?.activeInterrupt).toBeUndefined();
    expect(resumed?.usedInstalledSkills).toContain('installed-skill:find-skills');
  });

  it('创建 freshness-sensitive 任务时会写入 freshness 元证据', async () => {
    const orchestrator = createOrchestrator();
    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '最近 AI 有没有什么新的技术进展',
      constraints: [],
      sessionId: 'session-freshness'
    });

    expect(task.externalSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: 'freshness_meta',
          trustClass: 'internal',
          summary: expect.stringContaining('信息基准日期：'),
          detail: expect.objectContaining({
            freshnessSensitive: true,
            sourceCount: expect.any(Number)
          })
        })
      ])
    );
  });

  it('诊断任务会优先解析到 review 流程模板', async () => {
    const orchestrator = createOrchestrator();
    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '请诊断任务 task-agent-error 的 agent 错误并给出恢复方案。',
      context: 'diagnosis_for:task-agent-error',
      constraints: ['prefer-xingbu-diagnosis', 'preserve-trace-context'],
      sessionId: 'session-diagnosis'
    });

    expect(task.skillId).toBe('review');
    expect(task.resolvedWorkflow).toEqual(expect.objectContaining({ id: 'review', displayName: '代码审查流程' }));
    expect(task.currentStep).not.toBe('direct_reply');
    expect(task.status).toBe(TaskStatus.WAITING_APPROVAL);
    expect(task.activeInterrupt).toEqual(
      expect.objectContaining({
        kind: 'user-input',
        status: 'pending',
        resumeStrategy: 'command'
      })
    );

    const resumed = await orchestrator.applyApproval(task.id, { actor: 'agent-chat-user' }, ApprovalDecision.APPROVED);

    expect(resumed?.externalSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: 'diagnosis_result',
          trustClass: 'internal',
          summary: expect.stringContaining('agent 故障诊断结论')
        })
      ])
    );
    expect(resumed?.learningEvaluation?.notes).toEqual(
      expect.arrayContaining([expect.stringContaining('agent 故障诊断沉淀')])
    );
  });

  it('发布类 Skill 会优先路由兵部执行链路', async () => {
    const orchestrator = createOrchestrator();
    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '/ship 请整理本次发布前检查',
      constraints: [],
      sessionId: 'session-ship'
    });

    expect(task.skillId).toBe('ship');
    expect(task.modelRoute).toEqual(expect.arrayContaining([expect.objectContaining({ ministry: 'bingbu-ops' })]));
    expect(task.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          node: 'ministry_started',
          data: expect.objectContaining({ ministry: 'bingbu-ops' })
        })
      ])
    );
    expect(task.pendingAction?.toolName).toBe('ship_release');
  });

  it('智能搜索类 Skill 会优先选择 webSearchPrime，并继续读取正文形成可引用来源', async () => {
    const orchestrator = createOrchestrator();
    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '/browse 帮我打开首页并检查按钮',
      constraints: [],
      sessionId: 'session-browse'
    });

    expect(task.skillId).toBe('browse');
    expect(task.status).toBe(TaskStatus.COMPLETED);
    expect(task.pendingAction).toBeUndefined();
    expect(task.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          node: 'execute',
          data: expect.objectContaining({ toolName: 'webSearchPrime' })
        })
      ])
    );
    expect(task.externalSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: 'web_search_result',
          sourceUrl: expect.stringMatching(/^https?:\/\//),
          trustClass: 'official',
          summary: expect.any(String)
        }),
        expect.objectContaining({
          sourceType: 'document',
          sourceUrl: 'https://docs.example.com/product-plan-review',
          trustClass: 'official',
          summary: expect.stringContaining('网页正文')
        })
      ])
    );
  });

  it('QA Skill 会优先选择 run_terminal 能力', async () => {
    const orchestrator = createOrchestrator();
    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '/qa 帮我回归测试聊天主链路',
      constraints: [],
      sessionId: 'session-qa'
    });

    expect(task.skillId).toBe('qa');
    expect(task.pendingAction).toEqual(expect.objectContaining({ toolName: 'run_terminal' }));
  });

  it('后续任务会优先命中已沉淀的 research memory', async () => {
    const orchestrator = createOrchestrator(undefined, {
      memorySearchResults: [
        {
          id: 'mem_research_existing',
          type: 'fact',
          taskId: 'learn_job_1',
          summary: 'React 官方文档关于流式渲染的研究结论',
          content: '优先复用此前主动研究沉淀的结论。',
          tags: ['research-job', 'auto-persist', 'react'],
          qualityScore: 92,
          createdAt: '2026-03-23T00:00:00.000Z'
        }
      ]
    });

    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '/review 请审查 React 聊天页的流式渲染体验',
      constraints: [],
      sessionId: 'session-memory'
    });

    expect(task.reusedMemories).toEqual(['mem_research_existing']);
    expect(task.externalSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: 'memory_reuse',
          trustClass: 'internal',
          detail: expect.objectContaining({
            memoryId: 'mem_research_existing'
          })
        })
      ])
    );
    expect(task.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          node: 'research',
          summary: expect.stringContaining('优先命中 1 条历史记忆')
        })
      ])
    );
  });
});
