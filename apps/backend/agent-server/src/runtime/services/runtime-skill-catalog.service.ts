import { BadRequestException, NotFoundException } from '@nestjs/common';
import { z } from 'zod/v4';

import type { LlmProvider } from '@agent/agent-core';
import { listBootstrapSkills } from '@agent/agent-core';
import { SkillCard, SkillStatus } from '@agent/shared';

export interface RuntimeSkillCatalogContext {
  skillRegistry: {
    list: (status?: SkillStatus) => Promise<SkillCard[]>;
    getById: (skillId: string) => Promise<SkillCard | undefined>;
    publishToLab: (skill: SkillCard) => Promise<SkillCard>;
    promote: (skillId: string) => Promise<SkillCard>;
    disable: (skillId: string, reason?: string) => Promise<SkillCard>;
    restore: (skillId: string) => Promise<SkillCard>;
    retire: (skillId: string, reason?: string) => Promise<SkillCard>;
  };
  llmProvider?: LlmProvider;
  registerSkillWorker?: (skill: SkillCard) => void;
}

export class RuntimeSkillCatalogService {
  constructor(private readonly getContext: () => RuntimeSkillCatalogContext) {}

  async listSkills(status?: SkillStatus) {
    const skills = await this.ctx().skillRegistry.list(status);
    return sanitizeListedSkills(skills);
  }

  async listLabSkills() {
    const skills = await this.ctx().skillRegistry.list('lab');
    return sanitizeListedSkills(skills);
  }

  listBootstrapSkills() {
    return listBootstrapSkills();
  }

  async getSkill(skillId: string) {
    const skill = await this.ctx().skillRegistry.getById(skillId);
    if (!skill) {
      throw new NotFoundException(`Skill ${skillId} not found`);
    }
    return skill;
  }

  promoteSkill(skillId: string) {
    return this.ctx().skillRegistry.promote(skillId);
  }

  disableSkill(skillId: string) {
    return this.ctx().skillRegistry.disable(skillId, 'disabled_from_admin');
  }

  restoreSkill(skillId: string) {
    return this.ctx().skillRegistry.restore(skillId);
  }

  retireSkill(skillId: string) {
    return this.ctx().skillRegistry.retire(skillId, 'retired_from_admin');
  }

  async createUserSkillDraft(params: { prompt: string; displayName?: string; sessionId?: string; taskId?: string }) {
    const now = new Date().toISOString();
    const prompt = params.prompt.trim();
    if (isLikelyAccidentalSkillPrompt(prompt)) {
      throw new BadRequestException('current_request_is_not_a_reusable_skill');
    }
    const name = params.displayName?.trim() || deriveUserSkillName(prompt);
    const blueprint = await this.generateSkillDraftBlueprint(prompt);
    const skill: SkillCard = {
      id: `user-skill-${Date.now()}`,
      name,
      description: blueprint.description,
      applicableGoals: [prompt, ...blueprint.applicableGoals],
      requiredTools: blueprint.requiredTools,
      requiredCapabilities: blueprint.toolContract.required,
      requiredConnectors: blueprint.connectorContract.required,
      steps: blueprint.steps,
      toolContract: blueprint.toolContract,
      connectorContract: blueprint.connectorContract,
      constraints: [
        'ownerType=user-attached',
        'scope=workspace',
        'status=lab',
        'enabled=true',
        ...blueprint.constraints,
        ...(params.sessionId ? [`sessionId=${params.sessionId}`] : []),
        ...(params.taskId ? [`taskId=${params.taskId}`] : [])
      ],
      successSignals: blueprint.successSignals,
      riskLevel: blueprint.riskLevel,
      source: 'research',
      status: 'lab',
      bootstrap: false,
      ownership: {
        ownerType: 'user-attached',
        ownerId: params.sessionId ? `session:${params.sessionId}` : 'workspace',
        capabilityType: 'skill',
        scope: 'workspace',
        trigger: 'user_requested'
      },
      promotionState: 'lab',
      governanceRecommendation: 'keep-lab',
      preferredConnectors: blueprint.connectorContract.preferred,
      createdAt: now,
      updatedAt: now
    };
    const published = await this.ctx().skillRegistry.publishToLab(skill);
    this.ctx().registerSkillWorker?.(published);
    return published;
  }

  private ctx() {
    return this.getContext();
  }

  private async generateSkillDraftBlueprint(prompt: string) {
    const fallback = buildSkillDraftBlueprint(prompt);
    const llm = this.ctx().llmProvider;
    if (!llm?.isConfigured()) {
      return fallback;
    }

    const schema = z.object({
      description: z.string().min(8).max(400),
      applicableGoals: z.array(z.string()).max(6).default([]),
      requiredTools: z.array(z.string()).max(8).default([]),
      optionalTools: z.array(z.string()).max(8).default([]),
      approvalSensitiveTools: z.array(z.string()).max(8).default([]),
      preferredConnectors: z.array(z.string()).max(4).default([]),
      requiredConnectors: z.array(z.string()).max(4).default([]),
      configureIfMissing: z.boolean().default(true),
      successSignals: z.array(z.string()).max(8).default([]),
      riskLevel: z.enum(['low', 'medium', 'high']).default('low'),
      steps: z
        .array(
          z.object({
            title: z.string().min(2).max(80),
            instruction: z.string().min(8).max(400),
            toolNames: z.array(z.string()).max(8).default([])
          })
        )
        .min(3)
        .max(5)
    });

    try {
      const generated = await llm.generateObject(
        [
          {
            role: 'system',
            content: [
              'You are generating a reusable skill draft contract for an autonomous agent platform.',
              'Return only structured content that can be executed by the agent runtime.',
              'Prefer explicit steps, realistic tool requirements, connector affinity, and minimal risk.'
            ].join('\n')
          },
          {
            role: 'user',
            content: `Create a reusable skill draft for this request: ${prompt}`
          }
        ],
        schema,
        {
          role: 'manager',
          maxTokens: 800,
          temperature: 0.2
        }
      );

      return {
        description: generated.description,
        applicableGoals: dedupeStrings([...fallback.applicableGoals, ...generated.applicableGoals]),
        requiredTools: dedupeStrings([...fallback.requiredTools, ...generated.requiredTools]),
        toolContract: {
          required: dedupeStrings([...fallback.toolContract.required, ...generated.requiredTools]),
          optional: dedupeStrings([...(fallback.toolContract.optional ?? []), ...generated.optionalTools]),
          approvalSensitive: dedupeStrings([
            ...(fallback.toolContract.approvalSensitive ?? []),
            ...generated.approvalSensitiveTools
          ])
        },
        connectorContract: {
          preferred: dedupeStrings([...fallback.connectorContract.preferred, ...generated.preferredConnectors]),
          required: dedupeStrings([...(fallback.connectorContract.required ?? []), ...generated.requiredConnectors]),
          configureIfMissing: generated.configureIfMissing
        },
        constraints: dedupeStrings([
          ...fallback.constraints,
          ...generated.preferredConnectors.map(item => `preferredConnector=${item}`),
          ...generated.requiredConnectors.map(item => `requiredConnector=${item}`)
        ]),
        successSignals: dedupeStrings([...fallback.successSignals, ...generated.successSignals]),
        riskLevel: generated.riskLevel,
        steps: generated.steps
      };
    } catch {
      return fallback;
    }
  }
}

function buildSkillDraftBlueprint(prompt: string) {
  const normalized = prompt.toLowerCase();
  const wantsLark = /lark|飞书|通知|消息|提醒/.test(normalized);
  const wantsGithub = /github|仓库|pull request|pr|issue/.test(normalized);
  const wantsBrowser = /browser|网页|官网|页面|爬取|截图/.test(normalized);
  const wantsArchitecture = /架构|architecture|代码库|重构|依赖/.test(normalized);

  const requiredTools = Array.from(
    new Set([
      ...(wantsGithub ? ['github.search_repos'] : []),
      ...(wantsBrowser ? ['browser.open_page'] : []),
      ...(wantsLark ? ['notify.send_message'] : [])
    ])
  );
  const preferredConnectors = Array.from(
    new Set([
      ...(wantsGithub ? ['github-mcp-template'] : []),
      ...(wantsBrowser ? ['browser-mcp-template'] : []),
      ...(wantsLark ? ['lark-mcp-template'] : [])
    ])
  );
  const riskLevel: 'low' | 'medium' = wantsLark ? 'medium' : 'low';

  return {
    description: wantsArchitecture
      ? `${prompt}。这个草稿会优先按技术架构视角拆解问题、检查依赖与实现边界。`
      : `${prompt}。这个草稿会先做上下文理解，再根据缺失能力选择 skill / MCP / 审批链路。`,
    applicableGoals: preferredConnectors.map(item => `preferredConnector=${item}`),
    requiredTools,
    toolContract: {
      required: requiredTools,
      optional: wantsArchitecture ? ['repo.map_dependencies', 'repo.trace_callers'] : [],
      approvalSensitive: wantsLark ? ['lark.send_message'] : []
    },
    connectorContract: {
      preferred: preferredConnectors,
      required: wantsLark ? ['lark-mcp-template'] : [],
      configureIfMissing: preferredConnectors.length > 0
    },
    constraints: preferredConnectors.map(item => `preferredConnector=${item}`),
    successSignals: [
      'skill_draft_created',
      'lab_ready',
      'chat_reusable',
      ...(preferredConnectors.length ? ['connector_affinity_captured'] : [])
    ],
    riskLevel,
    steps: [
      {
        title: 'Intent framing',
        instruction: `Clarify the exact outcome for "${prompt}" and identify whether the current round needs specialist input, extra skills, or MCP connectors before acting.`,
        toolNames: []
      },
      {
        title: 'Capability check',
        instruction: preferredConnectors.length
          ? `Prioritize these connectors when available: ${preferredConnectors.join(', ')}. If they are missing, surface a connector recommendation instead of silently failing.`
          : 'Check whether built-in tools are sufficient. If not, surface the missing skill or MCP dependency before execution.',
        toolNames: requiredTools
      },
      {
        title: 'Execution plan',
        instruction: wantsArchitecture
          ? 'Use a technical-architecture lens: map the codebase area, call out dependencies, evaluate risk, then propose the safest execution sequence.'
          : wantsLark
            ? 'Prepare the content, receiver context, and approval requirements before sending any external notification.'
            : 'Break the job into the minimum reliable steps, keeping approvals and evidence visible in the chat thread.',
        toolNames: requiredTools
      },
      {
        title: 'Deliver and report',
        instruction:
          'Execute the approved path, keep the chat thread updated, and finish with a concise result summary plus any reusable follow-up guidance.',
        toolNames: requiredTools
      }
    ]
  };
}

function sanitizeListedSkills(skills: SkillCard[]) {
  const filtered = skills.filter(skill => !isAccidentalSkillCard(skill));
  const deduped = new Map<string, SkillCard>();
  for (const skill of filtered) {
    const key = buildSkillDedupKey(skill);
    const existing = deduped.get(key);
    if (!existing || compareSkillPriority(skill, existing) < 0) {
      deduped.set(key, skill);
    }
  }
  return Array.from(deduped.values());
}

function buildSkillDedupKey(skill: SkillCard) {
  return [
    (typeof skill.name === 'string' ? skill.name : '').trim().toLowerCase(),
    (skill.description ?? '').trim().toLowerCase(),
    skill.ownership?.ownerType ?? '',
    skill.source ?? ''
  ].join('::');
}

function compareSkillPriority(candidate: SkillCard, current: SkillCard) {
  return scoreSkillPriority(candidate) - scoreSkillPriority(current);
}

function scoreSkillPriority(skill: SkillCard) {
  const statusScore = skill.status === 'stable' ? 0 : skill.status === 'lab' ? 1 : 2;
  const createdScore = skill.createdAt ? -Date.parse(skill.createdAt) || 0 : 0;
  return statusScore * 1_000_000_000_000 + createdScore;
}

function isAccidentalSkillCard(skill: SkillCard) {
  const corpus = [
    skill.name,
    skill.description,
    ...(skill.applicableGoals ?? []),
    ...(skill.steps ?? []).map(step => step.instruction)
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();

  if (skill.name === '多 Agent 执行模式' && skill.status === 'lab' && skill.ownership?.ownerType !== 'shared') {
    return true;
  }

  return isLikelyAccidentalSkillPrompt(corpus);
}

function isLikelyAccidentalSkillPrompt(prompt: string) {
  const normalized = prompt.trim().toLowerCase();
  const weeklyReportPatterns = [
    /周报/,
    /日报/,
    /月报/,
    /年报/,
    /工作总结/,
    /生成.*周报/,
    /写.*周报/,
    /整理.*周报/,
    /参考上面的.*生成/,
    /参考上面的.*周报/,
    /这个草稿会先做上下文理解/,
    /润色/,
    /文案/,
    /邮件/,
    /翻译/
  ];
  return weeklyReportPatterns.some(pattern => pattern.test(normalized));
}

function deriveUserSkillName(prompt: string) {
  const normalized = prompt
    .replace(/帮我|请|创建|生成|做一个|做个|skill|技能|用于|用来/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) {
    return 'My Custom Skill';
  }
  const title = normalized.length > 28 ? `${normalized.slice(0, 28)}...` : normalized;
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function dedupeStrings(items: string[]) {
  return Array.from(new Set(items.map(item => item.trim()).filter(Boolean)));
}
