export interface PromptRegressionLatestSummary {
  runAt: string;
  overallStatus: 'pass' | 'fail' | 'partial';
  passRate?: number;
  providerIds: string[];
  skipped?: boolean;
  skipReason?: string;
  detectedNodeVersion?: string;
  requiredNodeRange?: string;
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
}

export interface PromptRegressionResultRow {
  promptId: string;
  providerId?: string;
  pass?: boolean;
  score?: number;
  namedScores?: unknown;
}

export function extractPromptResultRows(raw: unknown): PromptRegressionResultRow[];
export function isSupportedPromptfooNodeRuntime(version?: string): boolean;
export function buildPromptRegressionSkipSummary(
  reason: string,
  options?: {
    runAt?: string;
    detectedNodeVersion?: string;
    requiredNodeRange?: string;
  }
): PromptRegressionLatestSummary;
export function derivePromptRegressionSummary(
  raw: unknown,
  options?: {
    runAt?: string;
  }
): PromptRegressionLatestSummary;
export function enforcePromptRegressionGate(
  summary: PromptRegressionLatestSummary,
  options?: {
    threshold?: number;
    coreSuites?: string[];
  }
): {
  threshold: number;
  coreSuites: string[];
};
