export type DataReportScope = 'single' | 'multiple' | 'shell-first';

export interface DataReportContract {
  scope: DataReportScope;
  templateRef: 'bonusCenterData' | 'generic-report';
  templatePathHint?: string;
  componentPattern: string[];
  implementationNotes: string[];
  executionStages: string[];
  contextBlock: string;
}

function normalize(text: string) {
  return text.trim().toLowerCase();
}

function resolveScope(goal: string, context?: string): DataReportScope {
  const text = normalize(`${goal}\n${context ?? ''}`);
  if (/(多个|多张|多页|multi|批量|一组|多个报表)/i.test(text)) {
    return 'multiple';
  }
  if (/(骨架|shell|框架|容器|先搭)/i.test(text)) {
    return 'shell-first';
  }
  return 'single';
}

function resolveTemplate(goal: string, context?: string): DataReportContract['templateRef'] {
  const text = normalize(`${goal}\n${context ?? ''}`);
  return /bonuscenterdata|bonus center data/i.test(text) ? 'bonusCenterData' : 'generic-report';
}

function buildScopeNote(scope: DataReportScope) {
  switch (scope) {
    case 'multiple':
      return '优先按统一骨架拆出多个报表模块，并保持模块间配置、筛选和展示结构一致。';
    case 'shell-first':
      return '先生成共享容器、搜索区和切换结构，报表明细模块可以留好扩展位。';
    case 'single':
    default:
      return '先完成一个可运行的单报表模块，同时保持结构可扩展到多个模块。';
  }
}

export function buildDataReportContract(goal: string, context?: string): DataReportContract {
  const scope = resolveScope(goal, context);
  const templateRef = resolveTemplate(goal, context);
  const templatePathHint = templateRef === 'bonusCenterData' ? 'src/pages/dataDashboard/bonusCenterData' : undefined;
  const componentPattern = ['页面容器', '共享搜索/筛选区', 'Tab 或分段切换', '指标卡', '图表区', '表格区'];
  const implementationNotes = [
    buildScopeNote(scope),
    templateRef === 'bonusCenterData'
      ? '模板参考优先对齐 bonusCenterData 的目录分层、共享搜索区和子模块拆分方式。'
      : '可按本项目约定抽取通用报表骨架，但保留搜索区、指标、图表、表格的经典组合。',
    '避免把所有报表逻辑堆到单文件，优先拆分 config、search、module 组件和数据适配层。'
  ];
  const executionStages = ['先规划结构蓝图', '再按模块逐个生成', '最后组装共享文件与交付清单'];
  const contextBlock = [
    '数据报表任务契约：',
    `- 范围：${scope === 'multiple' ? '多个报表' : scope === 'shell-first' ? '先搭骨架' : '单个报表'}`,
    `- 模板：${templateRef === 'bonusCenterData' ? 'bonusCenterData' : '通用报表模板'}`,
    templatePathHint ? `- 模板路径提示：${templatePathHint}` : '',
    `- 推荐结构：${componentPattern.join(' / ')}`,
    `- 实施建议：${implementationNotes.join('；')}`,
    `- 执行阶段：${executionStages.join(' -> ')}`,
    templateRef === 'bonusCenterData'
      ? '- 模块来源：components/* 目录；Search、services/data、types/data、routes.ts 视为共享产物。'
      : ''
  ]
    .filter(Boolean)
    .join('\n');

  return {
    scope,
    templateRef,
    templatePathHint,
    componentPattern,
    implementationNotes,
    executionStages,
    contextBlock
  };
}

export function appendDataReportContext(taskContext: string | undefined, contract: DataReportContract): string {
  return [taskContext?.trim(), contract.contextBlock].filter(Boolean).join('\n\n');
}
