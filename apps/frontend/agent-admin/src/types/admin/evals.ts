export interface EvalScenarioRecord {
  scenarioId: string;
  label: string;
  description: string;
  matchedRunCount: number;
  passCount: number;
  failCount: number;
  passRate: number;
}

export interface EvalTrendPointRecord {
  day: string;
  runCount: number;
  passCount: number;
  passRate: number;
}

export interface EvalRunRecord {
  taskId: string;
  scenarioIds: string[];
  success: boolean;
  createdAt: string;
}

export interface EvalScenarioTrendRecord {
  scenarioId: string;
  label: string;
  points: EvalTrendPointRecord[];
}

export interface EvalsCenterRecord {
  scenarioCount: number;
  runCount: number;
  overallPassRate: number;
  appliedFilters?: {
    scenarioId?: string;
    outcome?: string;
  };
  scenarios: EvalScenarioRecord[];
  recentRuns: EvalRunRecord[];
  dailyTrend: EvalTrendPointRecord[];
  scenarioTrends: EvalScenarioTrendRecord[];
  historyDays?: number;
  historyRange?: {
    earliestDay?: string;
    latestDay?: string;
  };
  persistedDailyHistory?: Array<{
    day: string;
    runCount: number;
    passCount: number;
    passRate: number;
    scenarioCount: number;
    overallPassRate: number;
    updatedAt: string;
  }>;
  promptRegression?: {
    configPath?: string;
    promptCount?: number;
    promptSuiteCount?: number;
    testCount?: number;
    providerCount?: number;
    updatedAt?: string;
    latestRun?: {
      summaryPath: string;
      runAt: string;
      overallStatus: 'pass' | 'fail' | 'partial';
      passRate?: number;
      providerIds: string[];
      suiteResults: Array<{
        suiteId: string;
        label: string;
        status: 'pass' | 'fail' | 'partial';
        passRate?: number;
        notes?: string[];
        promptResults: Array<{
          promptId: string;
          version: string;
          providerId?: string;
          pass?: boolean;
          score?: number;
        }>;
      }>;
    };
    suites: Array<{
      suiteId: string;
      label: string;
      promptIds: string[];
      versions: string[];
      promptCount: number;
    }>;
  };
}
