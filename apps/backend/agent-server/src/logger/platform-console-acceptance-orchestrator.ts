import { join } from 'node:path';

import fs from 'fs-extra';

import type { PlatformConsoleLogAnalysis } from './platform-console-log-analysis';
import { fetchPlatformConsoleLogAnalysis } from './platform-console-log-analysis-client';
import {
  comparePlatformConsoleHttpMeasurementReports,
  type PlatformConsoleHttpMeasurementComparison,
  type PlatformConsoleHttpMeasurementReport,
  measurePlatformConsoleEndpoint
} from './platform-console-http-measurement';
import { renderPlatformConsoleAcceptanceReport } from './platform-console-acceptance-report';

export interface PlatformConsoleAcceptanceWorkflowOptions {
  baseUrl: string;
  outputDir: string;
  baselineJsonPath?: string;
  reviewer: string;
  version: string;
  goal: string;
  date?: string;
  environment?: string;
  days?: number;
  iterations?: number;
  warmup?: number;
  requestP95Budget?: number;
  serverTotalP95Budget?: number;
  measureReport?: () => Promise<PlatformConsoleHttpMeasurementReport>;
  fetchLogAnalysis?: () => Promise<PlatformConsoleLogAnalysis>;
}

export interface PlatformConsoleAcceptanceWorkflowResult {
  currentReport: PlatformConsoleHttpMeasurementReport;
  comparison: PlatformConsoleHttpMeasurementComparison | null;
  logAnalysis: PlatformConsoleLogAnalysis;
  paths: {
    currentJsonPath: string;
    comparisonJsonPath: string;
    logAnalysisJsonPath: string;
    acceptanceMarkdownPath: string;
  };
}

export async function runPlatformConsoleAcceptanceWorkflow(
  options: PlatformConsoleAcceptanceWorkflowOptions
): Promise<PlatformConsoleAcceptanceWorkflowResult> {
  await fs.ensureDir(options.outputDir);

  const currentJsonPath = join(options.outputDir, 'platform-console-current.json');
  const comparisonJsonPath = join(options.outputDir, 'platform-console-comparison.json');
  const logAnalysisJsonPath = join(options.outputDir, 'platform-console-log-analysis.json');
  const acceptanceMarkdownPath = join(options.outputDir, 'platform-console-acceptance.md');

  const currentReport = options.measureReport
    ? await options.measureReport()
    : await measurePlatformConsoleEndpoint({
        url: buildConsoleUrl(options.baseUrl, options.days ?? 30),
        iterations: options.iterations,
        warmup: options.warmup,
        budgetsMs: {
          requestP95: options.requestP95Budget,
          serverTotalP95: options.serverTotalP95Budget
        }
      });
  await fs.outputJson(currentJsonPath, currentReport, { spaces: 2 });

  const baselineReport = options.baselineJsonPath
    ? ((await fs.readJson(options.baselineJsonPath)) as PlatformConsoleHttpMeasurementReport)
    : null;
  const comparison = baselineReport
    ? comparePlatformConsoleHttpMeasurementReports(baselineReport, currentReport)
    : null;
  if (comparison) {
    await fs.outputJson(comparisonJsonPath, comparison, { spaces: 2 });
  }

  const logAnalysis = options.fetchLogAnalysis
    ? await options.fetchLogAnalysis()
    : await fetchPlatformConsoleLogAnalysis({
        baseUrl: options.baseUrl,
        days: 7
      });
  await fs.outputJson(logAnalysisJsonPath, logAnalysis, { spaces: 2 });

  const markdown = renderPlatformConsoleAcceptanceReport({
    metadata: {
      date: options.date ?? new Date().toISOString().slice(0, 10),
      reviewer: options.reviewer,
      environment: options.environment ?? 'staging',
      version: options.version,
      goal: options.goal,
      backendUrl: options.baseUrl,
      baselineJsonPath: options.baselineJsonPath,
      currentJsonPath
    },
    currentReport,
    comparison,
    logAnalysis
  });
  await fs.outputFile(acceptanceMarkdownPath, `${markdown}\n`);

  return {
    currentReport,
    comparison,
    logAnalysis,
    paths: {
      currentJsonPath,
      comparisonJsonPath,
      logAnalysisJsonPath,
      acceptanceMarkdownPath
    }
  };
}

function buildConsoleUrl(baseUrl: string, days: number) {
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${normalizedBaseUrl}/api/platform/console?days=${days}`;
}
