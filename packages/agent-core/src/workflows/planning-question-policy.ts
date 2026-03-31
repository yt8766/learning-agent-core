import type {
  CreateTaskDto,
  PlanDraftRecord,
  PlanMode,
  PlanQuestionRecord,
  TaskRecord,
  WorkflowPresetDefinition
} from '@agent/shared';

type PlanningScenario =
  | 'ceo-review'
  | 'engineering-review'
  | 'code-review'
  | 'qa'
  | 'browse'
  | 'ship'
  | 'retro'
  | 'implementation'
  | 'general-plan';

export interface PlanningPolicy {
  scenario: PlanningScenario;
  planMode: PlanMode;
  questionSet: NonNullable<PlanDraftRecord['questionSet']>;
  questions: PlanQuestionRecord[];
  autoResolved: string[];
  assumptions: string[];
  microBudget: NonNullable<PlanDraftRecord['microBudget']>;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function resolveScenario(task: TaskRecord, dto: CreateTaskDto): PlanningScenario {
  const workflowId = task.resolvedWorkflow?.id;
  if (workflowId === 'plan-ceo-review') return 'ceo-review';
  if (workflowId === 'plan-eng-review') return 'engineering-review';
  if (workflowId === 'review') return 'code-review';
  if (workflowId === 'qa') return 'qa';
  if (workflowId === 'browse') return 'browse';
  if (workflowId === 'ship') return 'ship';
  if (workflowId === 'retro') return 'retro';

  const goal = normalize(dto.goal);
  if (
    ['修改', '修复', '实现', '重构', '优化', 'fix', 'implement', 'refactor'].some(keyword => goal.includes(keyword))
  ) {
    return 'implementation';
  }

  return 'general-plan';
}

function buildBaseAutoResolved(task: TaskRecord, workflow?: WorkflowPresetDefinition, dto?: CreateTaskDto) {
  return [
    workflow ? `已命中流程模板：${workflow.displayName}` : '',
    workflow?.requiredMinistries?.length ? `默认会调动：${workflow.requiredMinistries.join(' / ')}` : '',
    workflow?.outputContract?.requiredSections?.length
      ? `输出至少包含：${workflow.outputContract.requiredSections.join(' / ')}`
      : '',
    task.specialistLead ? `主导专家已确定为：${task.specialistLead.displayName}` : '',
    dto?.context?.trim() ? '用户已提供额外上下文，可直接纳入方案' : ''
  ].filter(Boolean);
}

function buildBaseAssumptions(scenario: PlanningScenario) {
  const assumptions = ['计划模式下默认先收敛方案，不直接改写工作区。'];
  if (scenario === 'engineering-review' || scenario === 'implementation') {
    assumptions.push('默认优先低风险和最小改动，再考虑速度。');
  } else if (scenario === 'qa') {
    assumptions.push('默认优先最小可证明检查，不展开全量回归。');
  } else if (scenario === 'ship') {
    assumptions.push('默认不直接发布，而是先收敛发布条件与回滚方案。');
  } else {
    assumptions.push('若用户回答模糊，将按推荐项与默认假设收口。');
  }
  return assumptions;
}

function buildScenarioQuestions(scenario: PlanningScenario, workflow?: WorkflowPresetDefinition): PlanQuestionRecord[] {
  switch (scenario) {
    case 'ceo-review':
      return [
        {
          id: 'review_scope',
          question: '这轮 CEO 评审更希望我先聚焦哪一层？',
          questionType: 'direction',
          options: [
            { id: 'user_value', label: '用户价值', description: '先判断用户需求是否成立、场景是否足够强。' },
            { id: 'business_risk', label: '商业风险', description: '优先识别投入产出、竞争和时机风险。' },
            { id: 'balanced', label: '平衡评审', description: '同时给出用户价值、商业风险和建议。' }
          ],
          recommendedOptionId: 'balanced',
          allowFreeform: true,
          defaultAssumption: '默认做平衡评审，同时覆盖用户价值与商业风险。',
          whyAsked: '这会决定最终方案更偏价值判断、风险判断还是综合建议。',
          impactOnPlan: '影响输出结构和论证重点。'
        },
        {
          id: 'decision_bar',
          question: '你希望我给出的结论粒度到哪一层？',
          questionType: 'tradeoff',
          options: [
            { id: 'go_no_go', label: '拍板建议', description: '直接给出“做/不做/延后”的建议。' },
            { id: 'options_compare', label: '方案对比', description: '列出多个方向并比较优缺点。' },
            { id: 'open_questions', label: '未决问题', description: '重点指出还需补齐的信息。' }
          ],
          recommendedOptionId: 'go_no_go',
          defaultAssumption: '默认给出可执行的拍板建议。',
          whyAsked: '这会决定结论是更像决策 memo，还是备选方案清单。',
          impactOnPlan: '影响结论样式与证据组织。'
        }
      ];
    case 'engineering-review':
      return [
        {
          id: 'delivery_mode',
          question: '这一轮你更希望我先做到哪一步？',
          questionType: 'direction',
          options: [
            { id: 'plan_then_wait', label: '先给方案', description: '先收敛架构、风险和验收，再决定是否实现。' },
            { id: 'smallest_safe_change', label: '直接最小改动', description: '默认按低风险、最小改动路线推进。' },
            { id: 'implement_now', label: '按推荐直接做', description: '跳过计划提问，直接进入执行。' }
          ],
          recommendedOptionId: 'smallest_safe_change',
          allowFreeform: true,
          defaultAssumption: '按最小改动、低风险路径推进。',
          whyAsked: '这会直接决定本轮止于方案，还是继续进入实现主链。',
          impactOnPlan: '影响交付范围和执行深度。'
        },
        {
          id: 'verification_depth',
          question: '如果后续需要落地，这一轮的验证深度希望到哪一层？',
          questionType: 'detail',
          options: [
            { id: 'types_only', label: '只做类型检查', description: '最快，但覆盖较浅。' },
            { id: 'targeted_checks', label: '最小验证', description: '优先跑相关测试或最小可证明检查。' },
            { id: 'broader_validation', label: '尽量完整', description: '在成本允许时做更完整的验证。' }
          ],
          recommendedOptionId: 'targeted_checks',
          allowFreeform: true,
          defaultAssumption: '默认做最小可证明检查，不展开全量回归。',
          whyAsked: '验证深度会改变测试步骤、时间预估与风险说明。',
          impactOnPlan: '影响测试策略与成本。'
        },
        {
          id: 'tradeoff_priority',
          question: '这轮你希望我优先平衡哪件事？',
          questionType: 'tradeoff',
          options: [
            { id: 'low_risk', label: '低风险', description: '优先稳妥和兼容，不追求最快。' },
            { id: 'minimal_diff', label: '最小改动', description: '尽量少改主链，降低回归面。' },
            { id: 'speed', label: '速度优先', description: '先尽快推进，必要时接受更多假设。' }
          ],
          recommendedOptionId: 'low_risk',
          allowFreeform: true,
          defaultAssumption: '默认优先低风险，再兼顾最小改动。',
          whyAsked: '优先级不同，会改变方案中的取舍、回滚策略和测试覆盖。',
          impactOnPlan: '影响方案排序、验证范围与风险兜底。'
        }
      ];
    case 'code-review':
      return [
        {
          id: 'review_goal',
          question: '这轮 review 你更关心哪类风险？',
          questionType: 'direction',
          options: [
            { id: 'bugs', label: 'Bug / 回归', description: '优先找功能错误和行为回退。' },
            { id: 'security', label: '安全 / 合规', description: '优先找高风险安全与治理问题。' },
            { id: 'balanced', label: '综合 review', description: '按严重级别综合输出发现。' }
          ],
          recommendedOptionId: 'balanced',
          defaultAssumption: '默认做综合 review，但优先列高严重度问题。',
          whyAsked: '不同 review 目标会改变发现排序和分析重点。',
          impactOnPlan: '影响审查策略与输出结构。'
        }
      ];
    case 'qa':
      return [
        {
          id: 'qa_depth',
          question: '这轮 QA 更希望我做到哪一层？',
          questionType: 'direction',
          options: [
            { id: 'smoke', label: '冒烟验证', description: '快速判断主链是否可用。' },
            { id: 'targeted_regression', label: '定向回归', description: '围绕改动点做重点验证。' },
            { id: 'broader_matrix', label: '更广覆盖', description: '在时间允许时拉宽验证范围。' }
          ],
          recommendedOptionId: 'targeted_regression',
          defaultAssumption: '默认先做定向回归。',
          whyAsked: '验证范围直接影响测试成本和回归结论的可信度。',
          impactOnPlan: '影响测试矩阵和产出时间。'
        }
      ];
    case 'browse':
      return [
        {
          id: 'browse_goal',
          question: '浏览器自动化这轮更关注什么？',
          questionType: 'direction',
          options: [
            { id: 'journey', label: '用户路径', description: '验证完整流程与关键节点。' },
            { id: 'screenshots', label: '页面截图', description: '重点拿到页面状态与证据。' },
            { id: 'issues', label: '问题定位', description: '优先复现问题并提取证据。' }
          ],
          recommendedOptionId: 'journey',
          defaultAssumption: '默认优先验证用户路径并附关键截图。',
          whyAsked: '这会决定浏览器步骤是偏证据采集还是偏问题诊断。',
          impactOnPlan: '影响操作路径与输出格式。'
        }
      ];
    case 'ship':
      return [
        {
          id: 'ship_scope',
          question: '发布流程这轮更希望我推进到哪一步？',
          questionType: 'direction',
          options: [
            { id: 'release_plan', label: '只出发布方案', description: '先收敛检查项、风险和回滚，不直接动线上。' },
            { id: 'preflight', label: '做到预检', description: '允许跑发布前检查，但不真正发布。' },
            { id: 'ship_now', label: '直接发布', description: '按推荐项继续推进到执行。' }
          ],
          recommendedOptionId: 'release_plan',
          defaultAssumption: '默认只出发布方案，不直接上线。',
          whyAsked: '发布场景对风险容忍度差异很大，必须明确边界。',
          impactOnPlan: '影响是否进入高风险治理动作。'
        }
      ];
    case 'retro':
      return [
        {
          id: 'retro_focus',
          question: '这轮复盘更希望我先沉淀哪类内容？',
          questionType: 'direction',
          options: [
            { id: 'what_worked', label: '成功经验', description: '优先沉淀可复用的做法。' },
            { id: 'failures', label: '失败原因', description: '优先分析问题与可避免点。' },
            { id: 'balanced', label: '完整复盘', description: '同时覆盖亮点、问题与改进项。' }
          ],
          recommendedOptionId: 'balanced',
          defaultAssumption: '默认做完整复盘。',
          whyAsked: '复盘目标不同，会改变学习沉淀与后续建议的重点。',
          impactOnPlan: '影响输出结构与学习候选。'
        }
      ];
    case 'implementation':
    case 'general-plan':
    default:
      return [
        {
          id: 'delivery_mode',
          question: '这一轮你更希望我先做到哪一步？',
          questionType: 'direction',
          options: [
            { id: 'plan_then_wait', label: '先给方案', description: '先收敛思路与步骤，等你看完再决定是否实现。' },
            { id: 'smallest_safe_change', label: '直接最小改动', description: '默认按低风险、最小改动路线推进。' },
            { id: 'implement_now', label: '按推荐直接做', description: '跳过计划提问，直接进入执行。' }
          ],
          recommendedOptionId: 'smallest_safe_change',
          allowFreeform: true,
          defaultAssumption: '按最小改动、低风险路径推进。',
          whyAsked: '这会决定本轮是止于方案，还是继续进入执行主链。',
          impactOnPlan: '影响交付边界。'
        },
        {
          id: 'tradeoff_priority',
          question: '这轮更希望我优先平衡哪件事？',
          questionType: 'tradeoff',
          options: [
            { id: 'low_risk', label: '低风险', description: '优先稳妥和兼容。' },
            { id: 'minimal_diff', label: '最小改动', description: '尽量少改主链。' },
            { id: 'speed', label: '速度优先', description: '先快速推进，再逐步补强。' }
          ],
          recommendedOptionId: 'low_risk',
          defaultAssumption: '默认优先低风险。',
          whyAsked: '这会影响计划的排序、fallback 和验证范围。',
          impactOnPlan: '影响取舍与风险兜底。'
        }
      ];
  }
}

export function buildPlanningPolicy(task: TaskRecord, dto: CreateTaskDto): PlanningPolicy {
  const scenario = resolveScenario(task, dto);
  const workflow = task.resolvedWorkflow;
  const questionSetTitle =
    scenario === 'engineering-review'
      ? '工程方案确认'
      : scenario === 'ceo-review'
        ? '战略方案确认'
        : scenario === 'qa'
          ? '测试策略确认'
          : scenario === 'browse'
            ? '浏览目标确认'
            : scenario === 'ship'
              ? '发布边界确认'
              : '计划问题';
  const questionSetSummary = workflow
    ? `当前流程模板为 ${workflow.displayName}，还存在少量会改变执行路径的关键未知项。`
    : '存在少量会改变执行路径的关键未知项，需要先确认。';

  return {
    scenario,
    planMode: scenario === 'ceo-review' ? 'intent' : 'implementation',
    questionSet: {
      title: questionSetTitle,
      summary: questionSetSummary
    },
    questions: buildScenarioQuestions(scenario, workflow),
    autoResolved: buildBaseAutoResolved(task, workflow, dto),
    assumptions: buildBaseAssumptions(scenario),
    microBudget: {
      readOnlyToolLimit: scenario === 'qa' || scenario === 'browse' ? 2 : 3,
      readOnlyToolsUsed: 0,
      tokenBudgetUsd: scenario === 'ceo-review' ? 0.03 : 0.05,
      budgetTriggered: false
    }
  };
}
