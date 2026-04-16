import { AgentRole, type ManagerPlan, type WorkflowPresetDefinition } from '../types';

export function buildWorkflowPresetPlan(taskId: string, goal: string, preset: WorkflowPresetDefinition): ManagerPlan {
  if (preset.id === 'data-report') {
    return {
      id: `plan_${taskId}`,
      goal,
      summary: `${preset.displayName}已生效，系统会围绕数据报表模板拆解共享骨架，并支持单个或多个报表模块生成。`,
      steps: ['映射参考模板结构', '拆分共享搜索/配置与报表模块', '生成报表代码并整理交付清单'],
      subTasks: [
        {
          id: `sub_${taskId}_1`,
          title: '提炼报表模板',
          description: `从现有参考目录中抽取搜索区、Tab/分段切换、指标/图表/表格组合等稳定结构：${goal}`,
          assignedTo: AgentRole.RESEARCH,
          status: 'pending'
        },
        {
          id: `sub_${taskId}_2`,
          title: '生成报表模块',
          description: `按模板生成单个或多个数据报表模块，优先复用共享配置、查询参数和组件分层：${goal}`,
          assignedTo: AgentRole.EXECUTOR,
          status: 'pending'
        },
        {
          id: `sub_${taskId}_3`,
          title: '校验交付结构',
          description: `复核报表代码的模块边界、命名、可扩展性与最终交付清单：${goal}`,
          assignedTo: AgentRole.REVIEWER,
          status: 'pending'
        }
      ],
      createdAt: new Date().toISOString()
    };
  }

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
