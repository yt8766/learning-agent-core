import type {
  DataReportGenerationNode,
  DataReportPreviewStage,
  DataReportSandpackStage
} from '../../types/data-report';

export interface DataReportStageMeta {
  label: string;
  progressPercent: number;
  groupLabel: string;
  stepLabel: string;
  parallelMode?: 'serial' | 'parallel-branch' | 'parallel-worker';
}

export const DATA_REPORT_PREVIEW_STAGE_META: Array<
  {
    stage: DataReportPreviewStage;
  } & DataReportStageMeta
> = [
  {
    stage: 'analysis',
    label: '规划阶段 · 分析报表需求',
    groupLabel: '规划阶段',
    stepLabel: '分析报表需求',
    progressPercent: 5
  },
  {
    stage: 'intent',
    label: '规划阶段 · 识别工作流意图',
    groupLabel: '规划阶段',
    stepLabel: '识别工作流意图',
    progressPercent: 10
  },
  {
    stage: 'capability',
    label: '规划阶段 · 选择预览能力链路',
    groupLabel: '规划阶段',
    stepLabel: '选择预览能力链路',
    progressPercent: 15
  },
  {
    stage: 'blueprint',
    label: '规划阶段 · 规划报表蓝图',
    groupLabel: '规划阶段',
    stepLabel: '规划报表蓝图',
    progressPercent: 30
  },
  {
    stage: 'dependency',
    label: '规划阶段 · 规划依赖与产物边界',
    groupLabel: '规划阶段',
    stepLabel: '规划依赖与产物边界',
    progressPercent: 35
  },
  {
    stage: 'types',
    label: '生成阶段 · 规划类型文件',
    groupLabel: '生成阶段',
    stepLabel: '规划类型文件',
    progressPercent: 42
  },
  {
    stage: 'utils',
    label: '生成阶段 · 规划工具与共享片段',
    groupLabel: '生成阶段',
    stepLabel: '规划工具与共享片段',
    progressPercent: 49
  },
  {
    stage: 'service',
    label: '生成阶段 · 规划服务层契约',
    groupLabel: '生成阶段',
    stepLabel: '规划服务层契约',
    progressPercent: 56
  },
  {
    stage: 'hooks',
    label: '生成阶段 · 规划 Hooks 层',
    groupLabel: '生成阶段',
    stepLabel: '规划 Hooks 层',
    progressPercent: 63
  },
  {
    stage: 'modules',
    label: '生成阶段 · 生成报表模块',
    groupLabel: '生成阶段',
    stepLabel: '生成报表模块',
    progressPercent: 68,
    parallelMode: 'parallel-worker'
  },
  {
    stage: 'component',
    label: '生成阶段 · 整理组件代码',
    groupLabel: '生成阶段',
    stepLabel: '整理组件代码',
    progressPercent: 74
  },
  {
    stage: 'page',
    label: '生成阶段 · 整理页面代码',
    groupLabel: '生成阶段',
    stepLabel: '整理页面代码',
    progressPercent: 80
  },
  {
    stage: 'scaffold',
    label: '组装阶段 · 生成共享骨架',
    groupLabel: '组装阶段',
    stepLabel: '生成共享骨架',
    progressPercent: 86
  },
  {
    stage: 'routes',
    label: '组装阶段 · 生成预览路由',
    groupLabel: '组装阶段',
    stepLabel: '生成预览路由',
    progressPercent: 90
  },
  {
    stage: 'assemble',
    label: '组装阶段 · 组装 Sandpack 文件',
    groupLabel: '组装阶段',
    stepLabel: '组装 Sandpack 文件',
    progressPercent: 95
  },
  {
    stage: 'postprocess',
    label: '后处理阶段 · 执行 AST 修复与兜底',
    groupLabel: '后处理阶段',
    stepLabel: '执行 AST 修复与兜底',
    progressPercent: 100
  }
];

export const DATA_REPORT_SANDPACK_STAGE_META: Array<
  {
    stage: DataReportSandpackStage;
  } & DataReportStageMeta
> = [
  {
    stage: 'generate',
    label: '生成阶段 · 生成 Sandpack 代码',
    groupLabel: '生成阶段',
    stepLabel: '生成 Sandpack 代码',
    progressPercent: 60
  },
  {
    stage: 'parse',
    label: '组装阶段 · 校验 Sandpack JSON',
    groupLabel: '组装阶段',
    stepLabel: '校验 Sandpack JSON',
    progressPercent: 100
  }
];

export const DATA_REPORT_SANDPACK_GENERATE_HEARTBEAT_MS = 2000;

export const DATA_REPORT_GENERATION_NODE_META: Array<
  {
    node: DataReportGenerationNode;
  } & DataReportStageMeta
> = [
  {
    node: 'analysisNode',
    label: '规划阶段 · 需求分析',
    groupLabel: '规划阶段',
    stepLabel: '需求分析',
    progressPercent: 5
  },
  {
    node: 'scopeNode',
    label: '规划阶段 · 报表范围判断',
    groupLabel: '规划阶段',
    stepLabel: '报表范围判断',
    progressPercent: 10
  },
  {
    node: 'intentNode',
    label: '规划阶段 · 意图识别',
    groupLabel: '规划阶段',
    stepLabel: '意图识别',
    progressPercent: 15
  },
  {
    node: 'capabilityNode',
    label: '规划阶段 · 能力规划',
    groupLabel: '规划阶段',
    stepLabel: '能力规划',
    progressPercent: 20
  },
  {
    node: 'componentNode',
    label: '规划阶段 · 组件规格',
    groupLabel: '规划阶段',
    stepLabel: '组件规格',
    progressPercent: 27
  },
  {
    node: 'structureNode',
    label: '规划阶段 · 目录结构',
    groupLabel: '规划阶段',
    stepLabel: '目录结构',
    progressPercent: 35
  },
  {
    node: 'dependencyNode',
    label: '规划阶段 · 依赖规划',
    groupLabel: '规划阶段',
    stepLabel: '依赖规划',
    progressPercent: 40
  },
  {
    node: 'typeNode',
    label: '生成阶段 · 类型文件',
    groupLabel: '生成阶段',
    stepLabel: '类型文件',
    progressPercent: 45,
    parallelMode: 'parallel-branch'
  },
  {
    node: 'utilsNode',
    label: '生成阶段 · 工具与配置',
    groupLabel: '生成阶段',
    stepLabel: '工具与配置',
    progressPercent: 50,
    parallelMode: 'parallel-branch'
  },
  {
    node: 'mockDataNode',
    label: '生成阶段 · Mock 数据策略',
    groupLabel: '生成阶段',
    stepLabel: 'Mock 数据策略',
    progressPercent: 55,
    parallelMode: 'parallel-branch'
  },
  { node: 'serviceNode', label: '生成阶段 · 服务层', groupLabel: '生成阶段', stepLabel: '服务层', progressPercent: 60 },
  {
    node: 'hooksNode',
    label: '生成阶段 · Hooks 层',
    groupLabel: '生成阶段',
    stepLabel: 'Hooks 层',
    progressPercent: 65,
    parallelMode: 'parallel-branch'
  },
  {
    node: 'componentSubgraph',
    label: '生成阶段 · 组件文件',
    groupLabel: '生成阶段',
    stepLabel: '组件文件',
    progressPercent: 72,
    parallelMode: 'parallel-worker'
  },
  {
    node: 'pageSubgraph',
    label: '生成阶段 · 页面文件',
    groupLabel: '生成阶段',
    stepLabel: '页面文件',
    progressPercent: 78,
    parallelMode: 'parallel-worker'
  },
  {
    node: 'layoutNode',
    label: '生成阶段 · 布局骨架',
    groupLabel: '生成阶段',
    stepLabel: '布局骨架',
    progressPercent: 84
  },
  {
    node: 'styleGenNode',
    label: '生成阶段 · 样式与主题',
    groupLabel: '生成阶段',
    stepLabel: '样式与主题',
    progressPercent: 88
  },
  {
    node: 'appGenNode',
    label: '生成阶段 · 根入口与路由',
    groupLabel: '生成阶段',
    stepLabel: '根入口与路由',
    progressPercent: 92
  },
  {
    node: 'assembleNode',
    label: '组装阶段 · 汇总 Sandpack 文件',
    groupLabel: '组装阶段',
    stepLabel: '汇总 Sandpack 文件',
    progressPercent: 97
  },
  {
    node: 'postProcessNode',
    label: '后处理阶段 · AST 修复与兜底',
    groupLabel: '后处理阶段',
    stepLabel: 'AST 修复与兜底',
    progressPercent: 100
  }
];
