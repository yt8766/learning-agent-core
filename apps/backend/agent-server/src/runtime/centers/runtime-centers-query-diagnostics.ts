import { collectPlatformConsoleLogAnalysis } from '../../logger/platform-console-log-analysis';
import type { RuntimeCentersContext } from './runtime-centers.types';

export async function getPlatformConsoleLogAnalysis(
  ctx: RuntimeCentersContext,
  options?: { days?: number; latestSampleLimit?: number }
) {
  return collectPlatformConsoleLogAnalysis({
    logsDir: ctx.settings?.workspaceRoot ? `${ctx.settings.workspaceRoot}/apps/backend/agent-server/logs` : undefined,
    days: options?.days ?? 7,
    latestSampleLimit: options?.latestSampleLimit ?? 5
  });
}
