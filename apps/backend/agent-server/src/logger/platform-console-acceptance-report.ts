import type { PlatformConsoleLogAnalysis } from './platform-console-log-analysis';
import type {
  PlatformConsoleHttpMeasurementComparison,
  PlatformConsoleHttpMeasurementReport
} from './platform-console-http-measurement';

export interface PlatformConsoleAcceptanceReportInput {
  metadata: {
    date: string;
    reviewer: string;
    environment: string;
    version: string;
    goal: string;
    backendUrl: string;
    baselineJsonPath?: string;
    currentJsonPath?: string;
  };
  currentReport: PlatformConsoleHttpMeasurementReport;
  comparison?: PlatformConsoleHttpMeasurementComparison | null;
  logAnalysis?: PlatformConsoleLogAnalysis | null;
}

export function renderPlatformConsoleAcceptanceReport(input: PlatformConsoleAcceptanceReportInput): string {
  const pass = determinePass(input.currentReport, input.logAnalysis);
  const freshAggregate = input.logAnalysis?.byEvent['runtime.platform_console.fresh_aggregate'];
  const slow = input.logAnalysis?.byEvent['runtime.platform_console.slow'];

  const lines = [
    '# Platform Console Staging Acceptance',
    '',
    '## 1. 验收背景',
    '',
    `- 验收日期：${input.metadata.date}`,
    `- 验收人：${input.metadata.reviewer}`,
    `- 环境：${input.metadata.environment}`,
    `- 分支 / 版本：${input.metadata.version}`,
    `- 本次目标：${input.metadata.goal}`,
    '',
    '## 2. 前置条件',
    '',
    `- backend URL：${input.metadata.backendUrl}`,
    `- 是否保留“优化前” baseline JSON：${input.metadata.baselineJsonPath ? '是' : '否'}`,
    `- baseline JSON 路径：${input.metadata.baselineJsonPath ?? '未提供'}`,
    `- 当前报告输出路径：${input.metadata.currentJsonPath ?? '未提供'}`,
    '',
    '## 3. 结果记录',
    '',
    '即时基线：',
    '',
    `- request p50：${input.currentReport.requestDurationMs.p50}ms`,
    `- request p95：${input.currentReport.requestDurationMs.p95}ms`,
    `- server total p50：${input.currentReport.serverTotalDurationMs?.p50 ?? 'n/a'}${typeof input.currentReport.serverTotalDurationMs?.p50 === 'number' ? 'ms' : ''}`,
    `- server total p95：${input.currentReport.serverTotalDurationMs?.p95 ?? 'n/a'}${typeof input.currentReport.serverTotalDurationMs?.p95 === 'number' ? 'ms' : ''}`,
    `- cache statuses：${formatCacheStatuses(input.currentReport.cacheStatusCounts)}`,
    `- Budget status：${input.currentReport.failedBudgets.length ? 'failed' : 'passed'}`,
    ''
  ];

  if (input.comparison) {
    lines.push('与 baseline 对比：', '');
    lines.push(`- comparison status：${input.comparison.status}`);
    lines.push(`- request p95 delta：${input.comparison.requestP95DeltaMs}ms`);
    lines.push(
      `- server total p95 delta：${typeof input.comparison.serverTotalP95DeltaMs === 'number' ? `${input.comparison.serverTotalP95DeltaMs}ms` : 'n/a'}`
    );
    lines.push(
      `- cache hit rate delta：${typeof input.comparison.cacheHitRateDelta === 'number' ? `${input.comparison.cacheHitRateDelta * 100}pp` : 'n/a'}`
    );
    lines.push(`- highlights：${input.comparison.highlights.join('；') || '无'}`);
    lines.push('');
  }

  if (input.logAnalysis) {
    lines.push('趋势检查：', '');
    lines.push(`- \`summary.status\`：${input.logAnalysis.summary.status}`);
    lines.push(`- \`summary.reasons[0]\`：${input.logAnalysis.summary.reasons[0] ?? '无'}`);
    lines.push(
      `- \`fresh aggregate p95\`：${freshAggregate?.totalDurationMs.p95 ?? 'n/a'}${typeof freshAggregate?.totalDurationMs.p95 === 'number' ? 'ms' : ''}`
    );
    lines.push(
      `- \`slow p95\`：${slow?.totalDurationMs.p95 ?? 'n/a'}${typeof slow?.totalDurationMs.p95 === 'number' ? 'ms' : ''}`
    );
    lines.push(`- \`slow count\`：${slow?.count ?? 0}`);
    lines.push('');
  }

  lines.push('## 4. 判定结论', '');
  lines.push(`- 是否通过：${pass ? '通过' : '不通过'}`);
  lines.push(`- 结论摘要：${buildConclusionSummary(pass, input.currentReport, input.logAnalysis)}`);

  return lines.join('\n');
}

function determinePass(
  currentReport: PlatformConsoleHttpMeasurementReport,
  logAnalysis?: PlatformConsoleLogAnalysis | null
) {
  if (currentReport.failedBudgets.length > 0) {
    return false;
  }
  if (logAnalysis?.summary.status && logAnalysis.summary.status !== 'healthy') {
    return false;
  }
  return true;
}

function buildConclusionSummary(
  pass: boolean,
  currentReport: PlatformConsoleHttpMeasurementReport,
  logAnalysis?: PlatformConsoleLogAnalysis | null
) {
  if (pass) {
    return '`request p95` 与 `server total p95` 均低于预算，趋势恢复 `healthy`，通过';
  }
  if (currentReport.failedBudgets.length > 0) {
    return `即时基线仍未通过预算：${currentReport.failedBudgets.join('；')}`;
  }
  return `即时压测通过，但趋势仍为 \`${logAnalysis?.summary.status ?? 'unknown'}\`，暂不通过`;
}

function formatCacheStatuses(cacheStatusCounts: Record<string, number>) {
  const entries = Object.entries(cacheStatusCounts).sort(([left], [right]) => left.localeCompare(right));
  if (!entries.length) {
    return 'none';
  }
  return entries.map(([status, count]) => `${status}=${count}`).join(', ');
}
