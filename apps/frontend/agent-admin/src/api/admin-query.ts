import type { QueryClient } from '@tanstack/react-query';

import {
  getApprovalsCenter,
  getCompanyAgentsCenter,
  getConnectorsCenter,
  getEvalsCenterFiltered,
  getEvidenceCenter,
  getHealth,
  getLearningCenter,
  getPlatformConsoleLogAnalysis,
  getPlatformConsole,
  getPlatformConsoleShell,
  getRules,
  getRuntimeCenterFiltered,
  getSkills,
  getSkillSourcesCenter,
  getTaskBundle
} from '@/api/admin-api';

export const adminQueryKeys = {
  health: () => ['admin', 'health'] as const,
  platformConsole: (
    days: number,
    filters?: {
      status?: string;
      model?: string;
      pricingSource?: string;
      runtimeExecutionMode?: string;
      runtimeInteractionKind?: string;
      approvalsExecutionMode?: string;
      approvalsInteractionKind?: string;
    }
  ) => ['admin', 'platform-console', days, filters ?? {}] as const,
  platformConsoleShell: (
    days: number,
    filters?: {
      status?: string;
      model?: string;
      pricingSource?: string;
      runtimeExecutionMode?: string;
      runtimeInteractionKind?: string;
      approvalsExecutionMode?: string;
      approvalsInteractionKind?: string;
    }
  ) => ['admin', 'platform-console-shell', days, filters ?? {}] as const,
  platformConsoleLogAnalysis: (days: number) => ['admin', 'platform-console-log-analysis', days] as const,
  taskBundle: (taskId: string) => ['admin', 'task-bundle', taskId] as const,
  runtimeCenter: (params: {
    days?: number;
    status?: string;
    model?: string;
    pricingSource?: string;
    executionMode?: string;
    interactionKind?: string;
  }) => ['admin', 'runtime-center', params] as const,
  approvalsCenter: (params?: { executionMode?: string; interactionKind?: string }) =>
    ['admin', 'approvals-center', params ?? {}] as const,
  learningCenter: () => ['admin', 'learning-center'] as const,
  evidenceCenter: () => ['admin', 'evidence-center'] as const,
  connectorsCenter: () => ['admin', 'connectors-center'] as const,
  skillSourcesCenter: () => ['admin', 'skill-sources-center'] as const,
  companyAgentsCenter: () => ['admin', 'company-agents-center'] as const,
  skills: (status?: string) => ['admin', 'skills', status ?? 'all'] as const,
  rules: () => ['admin', 'rules'] as const,
  evalsCenter: (params: { days?: number; scenarioId?: string; outcome?: string }) =>
    ['admin', 'evals-center', params] as const
};

export function fetchAdminHealth(queryClient: QueryClient) {
  return queryClient.fetchQuery({
    queryKey: adminQueryKeys.health(),
    queryFn: getHealth,
    staleTime: 30_000
  });
}

export function fetchPlatformConsole(
  queryClient: QueryClient,
  days: number,
  filters?: {
    status?: string;
    model?: string;
    pricingSource?: string;
    runtimeExecutionMode?: string;
    runtimeInteractionKind?: string;
    approvalsExecutionMode?: string;
    approvalsInteractionKind?: string;
  }
) {
  return queryClient.fetchQuery({
    queryKey: adminQueryKeys.platformConsole(days, filters),
    queryFn: () => getPlatformConsole(days, filters),
    staleTime: 0
  });
}

export function fetchPlatformConsoleShell(
  queryClient: QueryClient,
  days: number,
  filters?: {
    status?: string;
    model?: string;
    pricingSource?: string;
    runtimeExecutionMode?: string;
    runtimeInteractionKind?: string;
    approvalsExecutionMode?: string;
    approvalsInteractionKind?: string;
  }
) {
  return queryClient.fetchQuery({
    queryKey: adminQueryKeys.platformConsoleShell(days, filters),
    queryFn: () => getPlatformConsoleShell(days, filters),
    staleTime: 0
  });
}

export function fetchPlatformConsoleLogAnalysis(queryClient: QueryClient, days = 7) {
  return queryClient.fetchQuery({
    queryKey: adminQueryKeys.platformConsoleLogAnalysis(days),
    queryFn: () => getPlatformConsoleLogAnalysis(days),
    staleTime: 30_000
  });
}

export function fetchTaskBundle(queryClient: QueryClient, taskId: string) {
  return queryClient.fetchQuery({
    queryKey: adminQueryKeys.taskBundle(taskId),
    queryFn: () => getTaskBundle(taskId),
    staleTime: 0
  });
}

export function fetchRuntimeCenter(
  queryClient: QueryClient,
  params: {
    days?: number;
    status?: string;
    model?: string;
    pricingSource?: string;
    executionMode?: string;
    interactionKind?: string;
  }
) {
  return queryClient.fetchQuery({
    queryKey: adminQueryKeys.runtimeCenter(params),
    queryFn: () => getRuntimeCenterFiltered(params),
    staleTime: 0
  });
}

export function fetchApprovalsCenter(
  queryClient: QueryClient,
  params?: { executionMode?: string; interactionKind?: string }
) {
  return queryClient.fetchQuery({
    queryKey: adminQueryKeys.approvalsCenter(params),
    queryFn: () => getApprovalsCenter(params),
    staleTime: 0
  });
}

export function fetchLearningCenter(queryClient: QueryClient) {
  return queryClient.fetchQuery({
    queryKey: adminQueryKeys.learningCenter(),
    queryFn: getLearningCenter,
    staleTime: 0
  });
}

export function fetchEvidenceCenter(queryClient: QueryClient) {
  return queryClient.fetchQuery({
    queryKey: adminQueryKeys.evidenceCenter(),
    queryFn: getEvidenceCenter,
    staleTime: 0
  });
}

export function fetchConnectorsCenter(queryClient: QueryClient) {
  return queryClient.fetchQuery({
    queryKey: adminQueryKeys.connectorsCenter(),
    queryFn: getConnectorsCenter,
    staleTime: 0
  });
}

export function fetchSkillSourcesCenter(queryClient: QueryClient) {
  return queryClient.fetchQuery({
    queryKey: adminQueryKeys.skillSourcesCenter(),
    queryFn: getSkillSourcesCenter,
    staleTime: 0
  });
}

export function fetchCompanyAgentsCenter(queryClient: QueryClient) {
  return queryClient.fetchQuery({
    queryKey: adminQueryKeys.companyAgentsCenter(),
    queryFn: getCompanyAgentsCenter,
    staleTime: 0
  });
}

export function fetchSkills(queryClient: QueryClient, status?: string) {
  return queryClient.fetchQuery({
    queryKey: adminQueryKeys.skills(status),
    queryFn: () => getSkills(status),
    staleTime: 0
  });
}

export function fetchRules(queryClient: QueryClient) {
  return queryClient.fetchQuery({
    queryKey: adminQueryKeys.rules(),
    queryFn: getRules,
    staleTime: 0
  });
}

export function fetchEvalsCenter(
  queryClient: QueryClient,
  params: { days?: number; scenarioId?: string; outcome?: string }
) {
  return queryClient.fetchQuery({
    queryKey: adminQueryKeys.evalsCenter(params),
    queryFn: () => getEvalsCenterFiltered(params),
    staleTime: 0
  });
}
