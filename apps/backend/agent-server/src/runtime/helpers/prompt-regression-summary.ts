import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

export interface PromptRegressionSuiteSummary {
  suiteId: string;
  label: string;
  promptIds: string[];
  versions: string[];
  promptCount: number;
}

export interface PromptRegressionConfigSummary {
  configPath: string;
  promptCount: number;
  promptSuiteCount: number;
  testCount: number;
  providerCount: number;
  suites: PromptRegressionSuiteSummary[];
  updatedAt?: string;
  latestRun?: PromptRegressionRunSummary;
}

export interface PromptRegressionRunSummary {
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
}

interface ParsedPromptRecord {
  id: string;
  label?: string;
}

export async function loadPromptRegressionConfigSummary(
  workspaceRoot: string,
  relativePath = 'packages/evals/promptfoo/ministry-prompts.promptfooconfig.yaml',
  summaryRelativePath = 'packages/evals/promptfoo/latest-summary.json'
): Promise<PromptRegressionConfigSummary | undefined> {
  const configPath = join(workspaceRoot, relativePath);
  const summaryPath = join(workspaceRoot, summaryRelativePath);

  try {
    const [raw, fileStat, latestRun] = await Promise.all([
      readFile(configPath, 'utf8'),
      stat(configPath),
      loadPromptRegressionLatestRun(summaryPath, summaryRelativePath)
    ]);
    const parsed = parsePromptfooConfigSummary(raw);
    return {
      configPath: relativePath,
      promptCount: parsed.prompts.length,
      promptSuiteCount: parsed.suites.length,
      testCount: parsed.testCount,
      providerCount: parsed.providerCount,
      suites: parsed.suites,
      updatedAt: fileStat.mtime.toISOString(),
      latestRun
    };
  } catch {
    return undefined;
  }
}

async function loadPromptRegressionLatestRun(
  filePath: string,
  relativePath: string
): Promise<PromptRegressionRunSummary | undefined> {
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PromptRegressionRunSummary>;
    if (!parsed.runAt || !parsed.overallStatus || !Array.isArray(parsed.suiteResults)) {
      return undefined;
    }

    return {
      summaryPath: relativePath,
      runAt: parsed.runAt,
      overallStatus: parsed.overallStatus,
      passRate: typeof parsed.passRate === 'number' ? parsed.passRate : undefined,
      providerIds: Array.isArray(parsed.providerIds) ? parsed.providerIds.map(String) : [],
      suiteResults: parsed.suiteResults
        .map(item => {
          const status = normalizeSuiteStatus(item.status);
          return {
            suiteId: String(item.suiteId ?? ''),
            label: String(item.label ?? item.suiteId ?? ''),
            status,
            passRate: typeof item.passRate === 'number' ? item.passRate : undefined,
            notes: Array.isArray(item.notes) ? item.notes.map(String) : undefined,
            promptResults: Array.isArray(item.promptResults)
              ? item.promptResults
                  .map(prompt => ({
                    promptId: String(prompt?.promptId ?? ''),
                    version: String(prompt?.version ?? ''),
                    providerId: prompt?.providerId ? String(prompt.providerId) : undefined,
                    pass: typeof prompt?.pass === 'boolean' ? prompt.pass : undefined,
                    score: typeof prompt?.score === 'number' ? prompt.score : undefined
                  }))
                  .filter(prompt => prompt.promptId && prompt.version)
              : []
          };
        })
        .filter(item => item.suiteId)
    };
  } catch {
    return undefined;
  }
}

function normalizeSuiteStatus(status: unknown): PromptRegressionRunSummary['suiteResults'][number]['status'] {
  if (status === 'fail' || status === 'partial') {
    return status;
  }
  return 'pass';
}

export function parsePromptfooConfigSummary(raw: string): {
  prompts: ParsedPromptRecord[];
  testCount: number;
  providerCount: number;
  suites: PromptRegressionSuiteSummary[];
} {
  const lines = raw.split(/\r?\n/);
  const prompts: ParsedPromptRecord[] = [];
  let testCount = 0;
  let providerCount = 0;
  let section: 'prompts' | 'providers' | 'tests' | null = null;
  let currentPrompt: ParsedPromptRecord | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    if (/^prompts:\s*$/.test(trimmed)) {
      section = 'prompts';
      currentPrompt = null;
      continue;
    }
    if (/^providers:\s*$/.test(trimmed)) {
      section = 'providers';
      currentPrompt = null;
      continue;
    }
    if (/^tests:\s*$/.test(trimmed)) {
      section = 'tests';
      currentPrompt = null;
      continue;
    }

    if (section === 'prompts') {
      const idMatch = trimmed.match(/^- id:\s*"?([^"]+)"?\s*$/);
      if (idMatch) {
        currentPrompt = {
          id: idMatch[1]
        };
        prompts.push(currentPrompt);
        continue;
      }

      const labelMatch = trimmed.match(/^label:\s*"?(.+?)"?\s*$/);
      if (labelMatch && currentPrompt) {
        currentPrompt.label = labelMatch[1];
      }
      continue;
    }

    if (section === 'providers' && /^- id:\s*/.test(trimmed)) {
      providerCount += 1;
      continue;
    }

    if (section === 'tests' && /^- vars:\s*$/.test(trimmed)) {
      testCount += 1;
    }
  }

  const suites = Array.from(
    prompts.reduce((map, prompt) => {
      const suiteId = prompt.id.replace(/-v\d+$/, '');
      const versionMatch = prompt.id.match(/-(v\d+)$/);
      const version = versionMatch?.[1] ?? prompt.id;
      const current = map.get(suiteId) ?? {
        suiteId,
        label: prompt.label?.replace(/\s+v\d+.*$/, '') ?? suiteId,
        promptIds: [],
        versions: [],
        promptCount: 0
      };
      current.promptIds.push(prompt.id);
      current.versions.push(version);
      current.promptCount += 1;
      map.set(suiteId, current);
      return map;
    }, new Map<string, PromptRegressionSuiteSummary>())
  )
    .map(([, suite]) => ({
      ...suite,
      versions: Array.from(new Set(suite.versions)).sort()
    }))
    .sort((left, right) => left.label.localeCompare(right.label));

  return {
    prompts,
    testCount,
    providerCount,
    suites
  };
}
