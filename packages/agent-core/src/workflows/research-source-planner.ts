import { EvidenceRecord, TrustClass, WorkflowPresetDefinition } from '@agent/shared';

interface ResearchSourcePlanInput {
  taskId: string;
  runId?: string;
  goal: string;
  workflow?: WorkflowPresetDefinition;
  preferredUrls?: string[];
  createdAt?: string;
}

export function buildResearchSourcePlan(input: ResearchSourcePlanInput): EvidenceRecord[] {
  const { taskId, runId, goal, workflow, preferredUrls = [], createdAt = new Date().toISOString() } = input;
  if (!workflow?.webLearningPolicy?.enabled) {
    return [];
  }

  const sources: EvidenceRecord[] = [];
  const pushSource = (sourceUrl: string, summary: string, trustClass: TrustClass = 'official') => {
    sources.push({
      id: `source_${taskId}_${sources.length + 1}`,
      taskId,
      sourceType: 'web_research_plan',
      sourceUrl,
      trustClass,
      summary,
      linkedRunId: runId,
      createdAt
    });
  };

  for (const preferredUrl of [...(workflow.sourcePolicy?.preferredUrls ?? []), ...preferredUrls]) {
    pushSource(preferredUrl, `来自研究策略的优先来源：${preferredUrl}`);
  }

  const loweredGoal = goal.toLowerCase();
  if (loweredGoal.includes('react') || loweredGoal.includes('vite')) {
    pushSource('https://react.dev/', 'React 官方文档，优先核对框架能力与最新用法。');
    pushSource('https://vite.dev/', 'Vite 官方文档，优先核对构建与开发环境配置。');
  }
  if (loweredGoal.includes('ant') || loweredGoal.includes('ant design')) {
    pushSource('https://ant.design/', 'Ant Design 官方文档，优先核对组件规范与 API。');
    pushSource('https://ant-design-x.antgroup.com/', 'Ant Design X 官方文档，优先核对智能体组件能力。');
  }
  if (loweredGoal.includes('openai') || loweredGoal.includes('gpt')) {
    pushSource('https://platform.openai.com/docs', 'OpenAI 官方文档，优先核对模型与 API 规范。');
  }
  if (loweredGoal.includes('langgraph') || loweredGoal.includes('langchain')) {
    pushSource('https://langchain-ai.github.io/langgraph/', 'LangGraph 官方文档，优先核对编排与中断恢复能力。');
  }
  if (
    loweredGoal.includes('测试') ||
    loweredGoal.includes('qa') ||
    loweredGoal.includes('playwright') ||
    loweredGoal.includes('vitest')
  ) {
    pushSource('https://playwright.dev/', 'Playwright 官方文档，优先核对浏览器自动化与测试场景。');
    pushSource('https://vitest.dev/', 'Vitest 官方文档，优先核对测试命令与断言能力。');
  }
  if (loweredGoal.includes('发布') || loweredGoal.includes('ship') || loweredGoal.includes('deploy')) {
    pushSource('https://docs.github.com/', 'GitHub 官方文档，优先核对发布、PR 与 Actions 流程。');
    pushSource('https://docs.npmjs.com/', 'npm 官方文档，优先核对包发布与版本管理流程。');
  }

  return mergeEvidence([], sources).slice(0, 8);
}

export function mergeEvidence(existing: EvidenceRecord[], incoming: EvidenceRecord[]): EvidenceRecord[] {
  const merged = [...existing];
  for (const item of incoming) {
    const key = `${item.sourceType}:${item.sourceUrl ?? item.summary}`;
    if (!merged.some(candidate => `${candidate.sourceType}:${candidate.sourceUrl ?? candidate.summary}` === key)) {
      merged.push(item);
    }
  }
  return merged;
}
