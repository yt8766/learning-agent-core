import type { DataReportSandpackGraphState } from '../../../types/data-report';

export const DATA_REPORT_ANALYSIS_PROMPT =
  '你是数据报表生成子 Agent 的需求分析节点。请只输出符合 schema 的分析结果，提炼标题、英文路由名、模板 templateId、单模块或多模块 referenceMode、数据源线索和关键词。';

export const DATA_REPORT_INTENT_PROMPT =
  '你是数据报表生成子 Agent 的意图识别节点。请根据 analysis 结果输出当前报表模块的路由名、模块目录和服务名。';

export const DATA_REPORT_COMPONENT_PROMPT =
  '你是数据报表生成子 Agent 的组件规格节点。单报表必须先判断结构模式：如果需求明确需要指标卡或图表，返回 singleReportMode=component-files，并直接规划 /pages/dataDashboard/<route>/components/<Name>Chart.tsx、<Name>Metrics.tsx、<Name>Table.tsx 这类文件；如果需求本质是查询+表格报表，不需要图表/指标，则返回 singleReportMode=page-only，并让 planned 为空数组。多模块继续参考 bonusCenterData 结构。请规划组件名、文件路径和用途，路径必须遵守项目目录结构。';

export const DATA_REPORT_SERVICE_PROMPT =
  '你是数据报表生成子 Agent 的服务层规划节点。请输出 service 文件路径和导出函数名。';

export const DATA_REPORT_HOOKS_PROMPT =
  '你是数据报表生成子 Agent 的 Hooks 规划节点。请输出 hooks 文件路径和 hook 名称。';

export const DATA_REPORT_STYLE_PROMPT =
  '你是数据报表生成子 Agent 的样式规划节点。报表预览默认直接使用 Tailwind 原子类，不生成独立 styles.css。请只返回 tailwind-inline 目标信息和固定主题 bonus-center。';

export function buildDataReportPlanningContext(state: DataReportSandpackGraphState) {
  return JSON.stringify(
    {
      goal: state.goal,
      analysis: state.analysis,
      scopeDecision: state.scopeDecision,
      intent: state.intent,
      blueprint: state.blueprint,
      components: state.components,
      structure: state.structure,
      service: state.service,
      hooks: state.hooks
    },
    null,
    2
  );
}
