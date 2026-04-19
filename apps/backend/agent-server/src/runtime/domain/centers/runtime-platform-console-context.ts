import type { RuntimeHost } from '../../core/runtime.host';
import type { RuntimeCentersService } from '../../centers/runtime-centers.service';
import type {
  PlatformConsoleCompanyAgentsRecord,
  PlatformConsoleConnectorsRecord,
  PlatformConsoleEvalsValue,
  PlatformConsoleLearningValue,
  PlatformConsoleRuntimeValue,
  RuntimePlatformConsoleContext
} from '../../centers/runtime-platform-console.records';

export interface RuntimePlatformConsoleContextInput {
  skillRegistry: () => RuntimeHost['skillRegistry'];
  orchestrator: () => RuntimeHost['orchestrator'];
  sessionCoordinator: () => RuntimeHost['sessionCoordinator'];
  centersService?: Pick<
    RuntimeCentersService,
    | 'getRuntimeCenter'
    | 'getRuntimeCenterSummary'
    | 'getApprovalsCenter'
    | 'getLearningCenter'
    | 'getLearningCenterSummary'
    | 'getEvalsCenter'
    | 'getEvalsCenterSummary'
    | 'getEvidenceCenter'
    | 'getToolsCenter'
    | 'getConnectorsCenter'
    | 'getSkillSourcesCenter'
    | 'getCompanyAgentsCenter'
  >;
  getRuntimeCenter: (days?: number, filters?: Record<string, unknown>) => Promise<PlatformConsoleRuntimeValue>;
  getRuntimeCenterSummary?: (days?: number, filters?: Record<string, unknown>) => Promise<PlatformConsoleRuntimeValue>;
  getApprovalsCenter: RuntimePlatformConsoleContext['getApprovalsCenter'];
  getLearningCenter: () => Promise<PlatformConsoleLearningValue>;
  getLearningCenterSummary?: () => Promise<PlatformConsoleLearningValue>;
  getEvalsCenter: (days?: number, filters?: Record<string, unknown>) => Promise<PlatformConsoleEvalsValue>;
  getEvalsCenterSummary?: (days?: number, filters?: Record<string, unknown>) => Promise<PlatformConsoleEvalsValue>;
  getEvidenceCenter: RuntimePlatformConsoleContext['getEvidenceCenter'];
  getToolsCenter?: RuntimePlatformConsoleContext['getToolsCenter'];
  getConnectorsCenter: () => Promise<PlatformConsoleConnectorsRecord>;
  getSkillSourcesCenter: RuntimePlatformConsoleContext['getSkillSourcesCenter'];
  getCompanyAgentsCenter: () => PlatformConsoleCompanyAgentsRecord;
}

export function createPlatformConsoleContext(input: RuntimePlatformConsoleContextInput): RuntimePlatformConsoleContext {
  const centersService = input.centersService;
  return {
    skillRegistry: input.skillRegistry(),
    orchestrator: input.orchestrator(),
    sessionCoordinator: input.sessionCoordinator(),
    getRuntimeCenter: centersService?.getRuntimeCenter.bind(centersService) ?? input.getRuntimeCenter,
    getRuntimeCenterSummary:
      centersService?.getRuntimeCenterSummary.bind(centersService) ?? input.getRuntimeCenterSummary,
    getApprovalsCenter: centersService?.getApprovalsCenter.bind(centersService) ?? input.getApprovalsCenter,
    getLearningCenter: centersService?.getLearningCenter.bind(centersService) ?? input.getLearningCenter,
    getLearningCenterSummary:
      centersService?.getLearningCenterSummary.bind(centersService) ?? input.getLearningCenterSummary,
    getEvalsCenter: centersService?.getEvalsCenter.bind(centersService) ?? input.getEvalsCenter,
    getEvalsCenterSummary: centersService?.getEvalsCenterSummary.bind(centersService) ?? input.getEvalsCenterSummary,
    getEvidenceCenter: centersService?.getEvidenceCenter.bind(centersService) ?? input.getEvidenceCenter,
    getToolsCenter: centersService?.getToolsCenter.bind(centersService) ?? input.getToolsCenter,
    getConnectorsCenter: centersService?.getConnectorsCenter.bind(centersService) ?? input.getConnectorsCenter,
    getSkillSourcesCenter: centersService?.getSkillSourcesCenter.bind(centersService) ?? input.getSkillSourcesCenter,
    getCompanyAgentsCenter: centersService?.getCompanyAgentsCenter.bind(centersService) ?? input.getCompanyAgentsCenter
  };
}
