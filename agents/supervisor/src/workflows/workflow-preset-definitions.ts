import { type WorkflowPresetDefinition } from '@agent/core';

export const GENERAL_PRESET: WorkflowPresetDefinition = {
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

export const WORKFLOW_PRESETS: WorkflowPresetDefinition[] = [
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
    id: 'data-report',
    command: '/data-report',
    displayName: '数据报表生成子 Agent',
    version: '1.0.0',
    intentPatterns: ['数据报表', '报表页面', '数据看板', '数据大盘', 'bonuscenterdata', 'bonus center data'],
    requiredMinistries: ['libu-governance', 'hubu-search', 'gongbu-code', 'xingbu-review', 'libu-delivery'],
    allowedCapabilities: [
      'plan_data_report_structure',
      'generate_data_report_module',
      'search_memory',
      'read_local_file',
      'list_directory',
      'search_in_files',
      'local-analysis',
      'find-skills',
      'generate_data_report_scaffold',
      'generate_data_report_routes',
      'assemble_data_report_bundle',
      'write_data_report_bundle'
    ],
    approvalPolicy: 'high-risk-only',
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
      type: 'data_report_bundle',
      requiredSections: ['template_mapping', 'report_modules', 'shared_artifacts', 'delivery_manifest']
    }
  },
  {
    id: 'scaffold',
    command: '/scaffold',
    explicitOnly: true,
    displayName: '通用脚手架生成流程',
    version: '1.0.0',
    intentPatterns: ['scaffold', '脚手架', 'template'],
    requiredMinistries: ['libu-governance', 'gongbu-code', 'libu-delivery'],
    allowedCapabilities: [
      'list_scaffold_templates',
      'preview_scaffold',
      'write_scaffold',
      'read_local_file',
      'list_directory',
      'local-analysis'
    ],
    approvalPolicy: 'high-risk-only',
    webLearningPolicy: {
      enabled: false,
      preferredSourceTypes: ['memory', 'repo'],
      acceptedTrustClasses: ['official', 'curated', 'internal']
    },
    sourcePolicy: {
      mode: 'controlled-first'
    },
    autoPersistPolicy: {
      memory: 'manual',
      rule: 'manual',
      skill: 'manual'
    },
    outputContract: {
      type: 'scaffold_generation',
      requiredSections: ['plan', 'preview', 'write_result']
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
