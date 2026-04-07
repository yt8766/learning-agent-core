import { AgentRole, ManagerPlan, WorkflowPresetDefinition, WorkflowVersionRecord } from '@agent/shared';

const GENERAL_PRESET: WorkflowPresetDefinition = {
  id: 'general',
  displayName: '通用协作流程',
  version: '1.0.0',
  intentPatterns: ['默认', '通用', 'general'],
  requiredMinistries: ['libu-governance', 'hubu-search', 'gongbu-code', 'xingbu-review'],
  allowedCapabilities: [
    'search_memory',
    'read_local_file',
    'list_directory',
    'local-analysis',
    'find-skills',
    'write_local_file',
    'delete_local_file',
    'schedule_task'
  ],
  approvalPolicy: 'high-risk-only',
  webLearningPolicy: {
    enabled: true,
    preferredSourceTypes: ['memory', 'official-docs', 'repo'],
    acceptedTrustClasses: ['official', 'curated', 'internal']
  },
  sourcePolicy: {
    mode: 'controlled-first'
  },
  autoPersistPolicy: {
    memory: 'high-confidence',
    rule: 'suggest',
    skill: 'suggest'
  },
  outputContract: {
    type: 'general_delivery',
    requiredSections: ['summary', 'execution', 'review']
  }
};

const WORKFLOW_PRESETS: WorkflowPresetDefinition[] = [
  GENERAL_PRESET,
  {
    id: 'plan-ceo-review',
    command: '/plan-ceo-review',
    displayName: 'CEO 评审流程',
    version: '1.0.0',
    intentPatterns: ['商业价值', '用户价值', '产品方向', 'ceo'],
    requiredMinistries: ['libu-governance', 'hubu-search', 'libu-delivery'],
    allowedCapabilities: ['search_memory', 'read_local_file', 'list_directory', 'local-analysis', 'find-skills'],
    approvalPolicy: 'none',
    webLearningPolicy: {
      enabled: true,
      preferredSourceTypes: ['official-docs', 'market', 'repo'],
      acceptedTrustClasses: ['official', 'curated', 'internal']
    },
    sourcePolicy: {
      mode: 'controlled-first'
    },
    autoPersistPolicy: {
      memory: 'high-confidence',
      rule: 'suggest',
      skill: 'manual'
    },
    outputContract: {
      type: 'ceo_review',
      requiredSections: ['user_value', 'business_risk', 'recommendation']
    }
  },
  {
    id: 'plan-eng-review',
    command: '/plan-eng-review',
    displayName: '工程方案评审',
    version: '1.0.0',
    intentPatterns: ['架构设计', '工程评审', 'eng review', 'architecture'],
    requiredMinistries: ['libu-governance', 'gongbu-code', 'libu-delivery'],
    allowedCapabilities: [
      'search_memory',
      'read_local_file',
      'list_directory',
      'local-analysis',
      'find-skills',
      'write_local_file',
      'delete_local_file',
      'schedule_task'
    ],
    approvalPolicy: 'high-risk-only',
    webLearningPolicy: {
      enabled: true,
      preferredSourceTypes: ['official-docs', 'repo', 'community'],
      acceptedTrustClasses: ['official', 'curated', 'internal']
    },
    sourcePolicy: {
      mode: 'controlled-first'
    },
    autoPersistPolicy: {
      memory: 'high-confidence',
      rule: 'suggest',
      skill: 'suggest'
    },
    outputContract: {
      type: 'engineering_review',
      requiredSections: ['architecture', 'risks', 'implementation_plan']
    }
  },
  {
    id: 'review',
    command: '/review',
    displayName: '代码审查流程',
    version: '1.0.0',
    intentPatterns: ['代码审查', 'review', '安全审计', '漏洞'],
    requiredMinistries: ['libu-governance', 'xingbu-review', 'gongbu-code'],
    allowedCapabilities: ['search_memory', 'read_local_file', 'list_directory', 'local-analysis', 'find-skills'],
    approvalPolicy: 'none',
    webLearningPolicy: {
      enabled: true,
      preferredSourceTypes: ['memory', 'repo', 'official-docs'],
      acceptedTrustClasses: ['official', 'curated', 'internal']
    },
    sourcePolicy: {
      mode: 'controlled-first'
    },
    autoPersistPolicy: {
      memory: 'high-confidence',
      rule: 'suggest',
      skill: 'manual'
    },
    outputContract: {
      type: 'code_review',
      requiredSections: ['findings', 'risks', 'followups']
    }
  },
  {
    id: 'qa',
    command: '/qa',
    displayName: 'QA 测试流程',
    version: '1.0.0',
    intentPatterns: ['qa', '测试', '回归', '验收'],
    requiredMinistries: ['libu-governance', 'bingbu-ops', 'hubu-search', 'libu-delivery'],
    allowedCapabilities: [
      'search_memory',
      'read_local_file',
      'list_directory',
      'run_terminal',
      'local-analysis',
      'find-skills',
      'schedule_task'
    ],
    approvalPolicy: 'high-risk-only',
    webLearningPolicy: {
      enabled: true,
      preferredSourceTypes: ['official-docs', 'repo', 'community'],
      acceptedTrustClasses: ['official', 'curated', 'internal']
    },
    sourcePolicy: {
      mode: 'controlled-first'
    },
    autoPersistPolicy: {
      memory: 'high-confidence',
      rule: 'suggest',
      skill: 'suggest'
    },
    outputContract: {
      type: 'qa_report',
      requiredSections: ['coverage', 'results', 'regressions']
    }
  },
  {
    id: 'browse',
    command: '/browse',
    displayName: '浏览器自动化流程',
    version: '1.0.0',
    intentPatterns: ['浏览器', '截图', '页面测试', 'browse'],
    requiredMinistries: ['libu-governance', 'bingbu-ops', 'libu-delivery'],
    allowedCapabilities: [
      'webSearchPrime',
      'webReader',
      'search_doc',
      'collect_research_source',
      'browse_page',
      'http_request',
      'read_local_file',
      'list_directory',
      'local-analysis',
      'find-skills'
    ],
    approvalPolicy: 'all-actions',
    webLearningPolicy: {
      enabled: true,
      preferredSourceTypes: ['official-docs', 'web', 'community'],
      acceptedTrustClasses: ['official', 'curated', 'community', 'internal']
    },
    sourcePolicy: {
      mode: 'open-web-allowed'
    },
    autoPersistPolicy: {
      memory: 'high-confidence',
      rule: 'suggest',
      skill: 'suggest'
    },
    outputContract: {
      type: 'browser_report',
      requiredSections: ['journey', 'screenshots', 'issues']
    }
  },
  {
    id: 'ship',
    command: '/ship',
    displayName: '发布流程',
    version: '1.0.0',
    intentPatterns: ['发布', '上线', 'ship', 'merge', 'deploy'],
    requiredMinistries: ['libu-governance', 'bingbu-ops', 'libu-delivery', 'xingbu-review'],
    allowedCapabilities: [
      'ship_release',
      'run_terminal',
      'write_local_file',
      'delete_local_file',
      'schedule_task',
      'http_request',
      'read_local_file',
      'list_directory',
      'local-analysis',
      'find-skills'
    ],
    approvalPolicy: 'all-actions',
    webLearningPolicy: {
      enabled: true,
      preferredSourceTypes: ['official-docs', 'repo', 'community'],
      acceptedTrustClasses: ['official', 'curated', 'internal']
    },
    sourcePolicy: {
      mode: 'controlled-first',
      preferredUrls: ['https://docs.github.com/', 'https://docs.npmjs.com/']
    },
    autoPersistPolicy: {
      memory: 'high-confidence',
      rule: 'suggest',
      skill: 'suggest'
    },
    outputContract: {
      type: 'release_report',
      requiredSections: ['checks', 'artifacts', 'release_notes']
    }
  },
  {
    id: 'retro',
    command: '/retro',
    displayName: '复盘流程',
    version: '1.0.0',
    intentPatterns: ['复盘', 'retro', '总结经验', '回顾'],
    requiredMinistries: ['libu-governance', 'libu-delivery', 'xingbu-review', 'gongbu-code'],
    allowedCapabilities: ['search_memory', 'read_local_file', 'list_directory', 'local-analysis', 'find-skills'],
    approvalPolicy: 'none',
    webLearningPolicy: {
      enabled: true,
      preferredSourceTypes: ['memory', 'repo', 'official-docs'],
      acceptedTrustClasses: ['official', 'curated', 'internal']
    },
    sourcePolicy: {
      mode: 'controlled-first'
    },
    autoPersistPolicy: {
      memory: 'high-confidence',
      rule: 'suggest',
      skill: 'suggest'
    },
    outputContract: {
      type: 'retro_report',
      requiredSections: ['wins', 'issues', 'next_actions']
    }
  }
];

export interface WorkflowResolution {
  normalizedGoal: string;
  preset: WorkflowPresetDefinition;
  source: 'explicit' | 'inferred' | 'default';
  command?: string;
}

interface WorkflowResolutionOptions {
  constraints?: string[];
  context?: string;
}

export function listWorkflowPresets(): WorkflowPresetDefinition[] {
  return WORKFLOW_PRESETS;
}

export function listWorkflowVersions(): WorkflowVersionRecord[] {
  const updatedAt = new Date().toISOString();
  return WORKFLOW_PRESETS.map(preset => ({
    workflowId: preset.id,
    version: preset.version ?? '1.0.0',
    status: 'active',
    updatedAt,
    changelog: ['initial-registry-baseline']
  }));
}

export function resolveWorkflowPreset(goal: string, options?: WorkflowResolutionOptions): WorkflowResolution {
  const normalizedGoal = goal.trim();
  const constraints = options?.constraints ?? [];
  const prefersDiagnosis =
    constraints.includes('prefer-xingbu-diagnosis') || String(options?.context ?? '').includes('diagnosis_for:');
  if (prefersDiagnosis) {
    const diagnosisPreset = WORKFLOW_PRESETS.find(item => item.id === 'review') ?? GENERAL_PRESET;
    return {
      normalizedGoal,
      preset: diagnosisPreset,
      source: diagnosisPreset === GENERAL_PRESET ? 'default' : 'inferred'
    };
  }

  const explicit = normalizedGoal.match(/^(\/[a-z-]+)\b\s*(.*)$/i);
  if (explicit) {
    const command = (explicit[1] ?? '').toLowerCase();
    const preset = WORKFLOW_PRESETS.find(item => item.command === command) ?? GENERAL_PRESET;
    return {
      normalizedGoal: explicit[2]?.trim() || normalizedGoal,
      preset,
      source: preset === GENERAL_PRESET ? 'default' : 'explicit',
      command
    };
  }

  const lowered = normalizedGoal.toLowerCase();
  const inferred =
    WORKFLOW_PRESETS.find(
      item => Boolean(item.command) && item.intentPatterns.some(pattern => lowered.includes(pattern.toLowerCase()))
    ) ?? GENERAL_PRESET;

  return {
    normalizedGoal,
    preset: inferred,
    source: inferred === GENERAL_PRESET ? 'default' : 'inferred'
  };
}

export function buildWorkflowPresetPlan(taskId: string, goal: string, preset: WorkflowPresetDefinition): ManagerPlan {
  const ministrySummary =
    preset.requiredMinistries.length > 0 ? preset.requiredMinistries.join('、') : '当前无需额外尚书';
  const summary = `${preset.displayName}已生效，系统将优先联动 ${ministrySummary} 处理目标。`;
  const researchObjective =
    preset.requiredMinistries.includes('hubu-search') ||
    preset.requiredMinistries.includes('libu-delivery') ||
    preset.requiredMinistries.includes('libu-docs')
      ? `收集与目标相关的上下文、文档与规范：${goal}`
      : `整理完成目标所需的上下文与约束：${goal}`;
  const executeObjective = preset.requiredMinistries.includes('bingbu-ops')
    ? `在受控环境中验证、执行或模拟运行目标：${goal}`
    : preset.requiredMinistries.includes('gongbu-code')
      ? `生成或调整实现方案并推进目标：${goal}`
      : `围绕目标执行最合适的方案：${goal}`;
  const reviewObjective = preset.requiredMinistries.includes('xingbu-review')
    ? `审查结果质量、安全性与可交付性：${goal}`
    : `总结结果并整理为最终交付：${goal}`;

  return {
    id: `plan_${taskId}`,
    goal,
    summary,
    steps: ['解析 Skill 模板', '按模板协同执行', '汇总结果并形成最终交付'],
    subTasks: [
      {
        id: `sub_${taskId}_1`,
        title: '整理上下文',
        description: researchObjective,
        assignedTo: AgentRole.RESEARCH,
        status: 'pending'
      },
      {
        id: `sub_${taskId}_2`,
        title: '执行模板任务',
        description: executeObjective,
        assignedTo: AgentRole.EXECUTOR,
        status: 'pending'
      },
      {
        id: `sub_${taskId}_3`,
        title: '审查与交付',
        description: reviewObjective,
        assignedTo: AgentRole.REVIEWER,
        status: 'pending'
      }
    ],
    createdAt: new Date().toISOString()
  };
}
