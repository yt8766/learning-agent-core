import {
  fetchApprovalsCenter,
  fetchCompanyAgentsCenter,
  fetchConnectorsCenter,
  fetchEvidenceCenter,
  fetchEvalsCenter,
  fetchLearningCenter,
  fetchRuntimeCenter,
  fetchRules,
  fetchSkills,
  fetchSkillSourcesCenter
} from '@/api/admin-query';
import type { DashboardPageKey } from '@/types/admin';
import type { AdminDashboardActionContext } from './admin-dashboard-actions.types';

export async function loadPageCenter(
  targetPage: DashboardPageKey,
  context: AdminDashboardActionContext,
  options?: { runtimeDays?: number; evalsDays?: number }
) {
  const runtimeFilters = context.getRuntimeFilters();
  const evalFilters = context.getEvalFilters();

  switch (targetPage) {
    case 'runtime':
      return {
        runtime: await fetchRuntimeCenter(context.queryClient, {
          days: options?.runtimeDays ?? context.getRuntimeHistoryDays(),
          status: runtimeFilters.status || undefined,
          model: runtimeFilters.model || undefined,
          pricingSource: runtimeFilters.pricingSource || undefined,
          executionMode: runtimeFilters.executionMode === 'all' ? undefined : runtimeFilters.executionMode,
          interactionKind: runtimeFilters.interactionKind === 'all' ? undefined : runtimeFilters.interactionKind
        })
      };
    case 'approvals':
      return {
        approvals: await fetchApprovalsCenter(context.queryClient, {
          executionMode:
            context.getApprovalFilters().executionMode === 'all'
              ? undefined
              : context.getApprovalFilters().executionMode,
          interactionKind:
            context.getApprovalFilters().interactionKind === 'all'
              ? undefined
              : context.getApprovalFilters().interactionKind
        })
      };
    case 'learning':
      return { learning: await fetchLearningCenter(context.queryClient) };
    case 'memory':
    case 'profiles':
      return null;
    case 'skills': {
      const [skills, rules] = await Promise.all([fetchSkills(context.queryClient), fetchRules(context.queryClient)]);
      return { skills, rules };
    }
    case 'archives': {
      const [runtime, evals] = await Promise.all([
        fetchRuntimeCenter(context.queryClient, {
          days: options?.runtimeDays ?? context.getRuntimeHistoryDays(),
          status: runtimeFilters.status || undefined,
          model: runtimeFilters.model || undefined,
          pricingSource: runtimeFilters.pricingSource || undefined,
          executionMode: runtimeFilters.executionMode === 'all' ? undefined : runtimeFilters.executionMode,
          interactionKind: runtimeFilters.interactionKind === 'all' ? undefined : runtimeFilters.interactionKind
        }),
        fetchEvalsCenter(context.queryClient, {
          days: options?.evalsDays ?? context.getEvalsHistoryDays(),
          scenarioId: evalFilters.scenario || undefined,
          outcome: evalFilters.outcome || undefined
        })
      ]);
      return { runtime, evals };
    }
    case 'evals':
      return {
        evals: await fetchEvalsCenter(context.queryClient, {
          days: options?.evalsDays ?? context.getEvalsHistoryDays(),
          scenarioId: evalFilters.scenario || undefined,
          outcome: evalFilters.outcome || undefined
        })
      };
    case 'evidence':
      return { evidence: await fetchEvidenceCenter(context.queryClient) };
    case 'connectors':
      return { connectors: await fetchConnectorsCenter(context.queryClient) };
    case 'skillSources':
      return { skillSources: await fetchSkillSourcesCenter(context.queryClient) };
    case 'companyAgents':
      return { companyAgents: await fetchCompanyAgentsCenter(context.queryClient) };
    default:
      return null;
  }
}
