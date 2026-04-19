import { getRuntimeAgentDependencies, type RuntimeAgentDependencies } from '../contracts/runtime-agent-dependencies';

// Runtime-internal adapter for data-report contracts wired by the composition root.
export const buildDataReportContract = (...args: Parameters<RuntimeAgentDependencies['buildDataReportContract']>) =>
  getRuntimeAgentDependencies().buildDataReportContract(...args);

export const appendDataReportContext = (...args: Parameters<RuntimeAgentDependencies['appendDataReportContext']>) =>
  getRuntimeAgentDependencies().appendDataReportContext(...args);
