interface BenchmarkTaskLike {
  id: string;
  skillId?: string;
  createdAt?: string;
  updatedAt?: string;
  reusedMemories?: unknown[];
  externalSources?: Array<{
    sourceType?: string;
  }>;
  approvals: Array<{
    decision?: string;
  }>;
  trace: Array<{
    node?: string;
  }>;
}

export interface BenchmarkScenarioDefinition {
  id: string;
  label: string;
  description: string;
  category: 'coding' | 'research' | 'ops' | 'learning';
  matcher: {
    skillId?: string;
    traceNodes?: string[];
    requiresApproval?: boolean;
    requiresEvidence?: boolean;
  };
}

export interface BenchmarkScenarioResult {
  scenarioId: string;
  label: string;
  description: string;
  matchedRunCount: number;
  passCount: number;
  failCount: number;
  passRate: number;
}

export interface BenchmarkSummary {
  scenarioCount: number;
  runCount: number;
  overallPassRate: number;
  scenarios: BenchmarkScenarioResult[];
  recentRuns: BenchmarkRunRecord[];
  dailyTrend: BenchmarkTrendPoint[];
  scenarioTrends: BenchmarkScenarioTrend[];
}

export interface BenchmarkRunRecord {
  taskId: string;
  scenarioIds: string[];
  success: boolean;
  createdAt: string;
}

export interface BenchmarkTrendPoint {
  day: string;
  runCount: number;
  passCount: number;
  passRate: number;
}

export interface BenchmarkScenarioTrend {
  scenarioId: string;
  label: string;
  points: BenchmarkTrendPoint[];
}

export const DEFAULT_BENCHMARK_SCENARIOS: BenchmarkScenarioDefinition[] = [
  {
    id: 'review',
    label: '/review',
    description: '代码审查链路应形成 review 完成结果。',
    category: 'coding',
    matcher: {
      skillId: 'review',
      traceNodes: ['review']
    }
  },
  {
    id: 'qa',
    label: '/qa',
    description: 'QA 链路应走到终端能力执行。',
    category: 'ops',
    matcher: {
      skillId: 'qa',
      traceNodes: ['execute']
    }
  },
  {
    id: 'browse',
    label: '/browse',
    description: 'Browse 链路应进入审批或浏览器执行阶段。',
    category: 'ops',
    matcher: {
      skillId: 'browse',
      requiresApproval: true
    }
  },
  {
    id: 'ship',
    label: '/ship',
    description: 'Ship 链路应进入审批并具备恢复能力。',
    category: 'ops',
    matcher: {
      skillId: 'ship',
      requiresApproval: true
    }
  },
  {
    id: 'research-reuse',
    label: 'research reuse',
    description: '主动研究沉淀结果应能在后续任务中复用。',
    category: 'learning',
    matcher: {
      requiresEvidence: true
    }
  }
];

export function evaluateBenchmarks(
  tasks: BenchmarkTaskLike[],
  scenarios: BenchmarkScenarioDefinition[] = DEFAULT_BENCHMARK_SCENARIOS
): BenchmarkSummary {
  const scenarioResults = scenarios.map(scenario => {
    const matchedRuns = tasks.filter(task => matchesScenario(task, scenario));
    const passCount = matchedRuns.filter(task => passesScenario(task, scenario)).length;
    const failCount = Math.max(0, matchedRuns.length - passCount);
    return {
      scenarioId: scenario.id,
      label: scenario.label,
      description: scenario.description,
      matchedRunCount: matchedRuns.length,
      passCount,
      failCount,
      passRate: matchedRuns.length === 0 ? 0 : Math.round((passCount / matchedRuns.length) * 100)
    } satisfies BenchmarkScenarioResult;
  });

  const runCount = scenarioResults.reduce((sum, item) => sum + item.matchedRunCount, 0);
  const totalPasses = scenarioResults.reduce((sum, item) => sum + item.passCount, 0);

  return {
    scenarioCount: scenarioResults.length,
    runCount,
    overallPassRate: runCount === 0 ? 0 : Math.round((totalPasses / runCount) * 100),
    scenarios: scenarioResults,
    recentRuns: buildRecentRuns(tasks, scenarios),
    dailyTrend: buildTrend(tasks, scenarios),
    scenarioTrends: scenarios.map(scenario => ({
      scenarioId: scenario.id,
      label: scenario.label,
      points: buildTrend(
        tasks.filter(task => matchesScenario(task, scenario)),
        [scenario]
      )
    }))
  };
}

function buildRecentRuns(
  tasks: BenchmarkTaskLike[],
  scenarios: BenchmarkScenarioDefinition[],
  limit = 12
): BenchmarkRunRecord[] {
  return tasks
    .map(task => {
      const scenarioIds = scenarios.filter(scenario => matchesScenario(task, scenario)).map(scenario => scenario.id);
      const success = scenarioIds.every(scenarioId => {
        const scenario = scenarios.find(item => item.id === scenarioId);
        return scenario ? passesScenario(task, scenario) : true;
      });
      return {
        taskId: task.id,
        scenarioIds,
        success,
        createdAt: task.updatedAt ?? task.createdAt ?? new Date(0).toISOString()
      };
    })
    .filter(item => item.scenarioIds.length > 0)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, limit);
}

function buildTrend(
  tasks: BenchmarkTaskLike[],
  scenarios: BenchmarkScenarioDefinition[],
  maxDays = 7
): BenchmarkTrendPoint[] {
  const buckets = new Map<string, { runCount: number; passCount: number }>();

  for (const task of tasks) {
    const matched = scenarios.filter(scenario => matchesScenario(task, scenario));
    if (matched.length === 0) {
      continue;
    }
    const day = formatDay(task.updatedAt ?? task.createdAt);
    const success = matched.every(scenario => passesScenario(task, scenario));
    const bucket = buckets.get(day) ?? { runCount: 0, passCount: 0 };
    bucket.runCount += 1;
    if (success) {
      bucket.passCount += 1;
    }
    buckets.set(day, bucket);
  }

  return Array.from(buckets.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .slice(-maxDays)
    .map(([day, bucket]) => ({
      day,
      runCount: bucket.runCount,
      passCount: bucket.passCount,
      passRate: bucket.runCount === 0 ? 0 : Math.round((bucket.passCount / bucket.runCount) * 100)
    }));
}

function formatDay(value?: string): string {
  const date = value ? new Date(value) : new Date(0);
  if (Number.isNaN(date.getTime())) {
    return '1970-01-01';
  }
  return date.toISOString().slice(0, 10);
}

function matchesScenario(task: BenchmarkTaskLike, scenario: BenchmarkScenarioDefinition) {
  if (scenario.matcher.skillId && task.skillId !== scenario.matcher.skillId) {
    return false;
  }

  if (scenario.matcher.traceNodes?.length) {
    const taskNodes = new Set(task.trace.map(item => item.node).filter(Boolean));
    if (!scenario.matcher.traceNodes.some(node => taskNodes.has(node))) {
      return false;
    }
  }

  if (scenario.matcher.requiresApproval && task.approvals.length === 0) {
    return false;
  }

  if (scenario.matcher.requiresEvidence) {
    const hasEvidence = (task.externalSources ?? []).some(source => source.sourceType === 'memory_reuse');
    if (!hasEvidence) {
      return false;
    }
  }

  return true;
}

function passesScenario(task: BenchmarkTaskLike, scenario: BenchmarkScenarioDefinition) {
  if (scenario.matcher.requiresApproval) {
    return task.approvals.some(approval => approval.decision === 'approved');
  }

  if (scenario.matcher.requiresEvidence) {
    return (task.reusedMemories?.length ?? 0) > 0;
  }

  if (scenario.matcher.traceNodes?.length) {
    const taskNodes = new Set(task.trace.map(item => item.node).filter(Boolean));
    return scenario.matcher.traceNodes.every(node => taskNodes.has(node));
  }

  return true;
}
