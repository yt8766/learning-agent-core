import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  approveTask: vi.fn(),
  rejectTask: vi.fn(),
  retryTask: vi.fn(),
  createTask: vi.fn(),
  createAgentDiagnosisTask: vi.fn(),
  exportRuntimeCenter: vi.fn(),
  exportApprovalsCenter: vi.fn(),
  exportEvalsCenter: vi.fn(),
  supersedeMemory: vi.fn(),
  rejectSkillInstall: vi.fn(),
  setConnectorPolicy: vi.fn(),
  setLearningConflictStatus: vi.fn(),
  enableCompanyAgent: vi.fn(),
  disableCompanyAgent: vi.fn()
}));

const downloadTextMock = vi.fn();

vi.mock('@/api/admin-api', async () => {
  const actual = await vi.importActual<object>('@/api/admin-api');
  return {
    ...actual,
    ...apiMocks
  };
});

vi.mock('@/hooks/admin-dashboard/admin-dashboard-constants', async () => {
  const actual = await vi.importActual<object>('@/hooks/admin-dashboard/admin-dashboard-constants');
  return {
    ...actual,
    downloadText: (...args: unknown[]) => downloadTextMock(...args)
  };
});

import { createAdminDashboardMutationActions } from '@/hooks/admin-dashboard/admin-dashboard-mutation-actions';

function createContext(
  page: 'runtime' | 'approvals' | 'learning' | 'connectors' | 'skillSources' | 'companyAgents' = 'runtime'
) {
  return {
    getPage: () => page,
    getRuntimeHistoryDays: () => 30,
    getEvalsHistoryDays: () => 14,
    getRuntimeFilters: () => ({
      status: 'running',
      model: 'gpt-5.4',
      pricingSource: 'provider',
      executionMode: 'imperial_direct',
      interactionKind: 'approval'
    }),
    getApprovalFilters: () => ({
      executionMode: 'plan',
      interactionKind: 'plan-question'
    }),
    getEvalFilters: () => ({ scenario: 'scenario-1', outcome: 'passed' }),
    getBundle: () => null,
    getConsoleData: () => null,
    setPage: vi.fn(),
    setLoading: vi.fn(),
    setError: vi.fn(),
    setConsoleData: vi.fn(),
    setBundle: vi.fn(),
    reportRefresh: vi.fn()
  };
}

function createRefreshActions() {
  return {
    refreshAll: vi.fn(async () => undefined),
    refreshPageCenter: vi.fn(async () => undefined),
    refreshTask: vi.fn(async () => undefined)
  };
}

describe('admin-dashboard-mutation-actions', () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach(mock => mock.mockReset());
    downloadTextMock.mockReset();
    apiMocks.createTask.mockResolvedValue({ id: 'task-quick' });
    apiMocks.createAgentDiagnosisTask.mockResolvedValue({ id: 'task-diagnosis' });
    apiMocks.exportRuntimeCenter.mockResolvedValue({
      filename: 'runtime.json',
      mimeType: 'application/json',
      content: '{"ok":true}'
    });
    apiMocks.exportApprovalsCenter.mockResolvedValue({
      filename: 'approvals.json',
      mimeType: 'application/json',
      content: '{"items":[]}'
    });
    apiMocks.exportEvalsCenter.mockResolvedValue({
      filename: 'evals.json',
      mimeType: 'application/json',
      content: '{"scenarios":[]}'
    });
    vi.stubGlobal('window', {
      location: { hash: '' },
      prompt: vi.fn()
    });
  });

  it('handles approval, retry and quick-create flows with refresh chaining', async () => {
    const context = createContext('runtime');
    const refreshActions = createRefreshActions();
    const actions = createAdminDashboardMutationActions(context as any, refreshActions);

    await actions.updateApproval('approve', 'task-1', 'write_file');
    await actions.updateApproval('reject', 'task-2', 'delete_file');
    await actions.handleRetryTask('task-3');
    await actions.handleQuickCreate();
    await actions.handleCreateDiagnosisTask({
      taskId: 'task-4',
      goal: '诊断',
      errorCode: 'E_RUNTIME',
      message: 'boom'
    });

    expect(apiMocks.approveTask).toHaveBeenCalledWith('task-1', 'write_file');
    expect(apiMocks.rejectTask).toHaveBeenCalledWith('task-2', 'delete_file');
    expect(apiMocks.retryTask).toHaveBeenCalledWith('task-3');
    expect(apiMocks.createTask).toHaveBeenCalled();
    expect(apiMocks.createAgentDiagnosisTask).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 'task-4', errorCode: 'E_RUNTIME' })
    );
    expect(refreshActions.refreshAll).toHaveBeenCalledTimes(2);
    expect(refreshActions.refreshTask).toHaveBeenCalledWith('task-3', false);
    expect(refreshActions.refreshTask).toHaveBeenCalledWith('task-quick', false);
    expect(refreshActions.refreshTask).toHaveBeenCalledWith('task-diagnosis', false);
    expect(context.setPage).toHaveBeenCalledWith('runtime');
  });

  it('handles prompts, exports and page-scoped refresh behavior', async () => {
    const learningContext = createContext('learning');
    const refreshActions = createRefreshActions();
    const actions = createAdminDashboardMutationActions(learningContext as any, refreshActions);
    const promptMock = vi.mocked(window.prompt);

    promptMock.mockReturnValueOnce('mem-2');
    await actions.handleSupersedeMemory('mem-1');
    promptMock.mockReturnValueOnce('rejected by policy');
    await actions.handleRejectSkillInstall('receipt-1');
    await actions.downloadRuntimeExport();
    await actions.downloadApprovalsExport();
    await actions.downloadEvalsExport();

    expect(apiMocks.supersedeMemory).toHaveBeenCalledWith('mem-1', 'mem-2', 'superseded_from_admin');
    expect(apiMocks.rejectSkillInstall).toHaveBeenCalledWith('receipt-1', 'rejected by policy');
    expect(apiMocks.exportRuntimeCenter).toHaveBeenCalledWith({
      days: 30,
      status: 'running',
      model: 'gpt-5.4',
      pricingSource: 'provider',
      executionMode: 'imperial_direct',
      interactionKind: 'approval'
    });
    expect(apiMocks.exportApprovalsCenter).toHaveBeenCalledWith({
      executionMode: 'plan',
      interactionKind: 'plan-question'
    });
    expect(apiMocks.exportEvalsCenter).toHaveBeenCalledWith({
      days: 14,
      scenarioId: 'scenario-1',
      outcome: 'passed'
    });
    expect(downloadTextMock).toHaveBeenCalledTimes(3);
    expect(refreshActions.refreshPageCenter).toHaveBeenCalledWith('learning');
    expect(refreshActions.refreshPageCenter).toHaveBeenCalledWith('skillSources');
  });

  it('refreshes targeted centers for governance mutations and surfaces errors', async () => {
    const connectorsContext = createContext('connectors');
    const refreshActions = createRefreshActions();
    const actions = createAdminDashboardMutationActions(connectorsContext as any, refreshActions);

    apiMocks.setConnectorPolicy.mockResolvedValueOnce({});
    apiMocks.setLearningConflictStatus.mockResolvedValueOnce({});
    apiMocks.enableCompanyAgent.mockResolvedValueOnce({});
    apiMocks.disableCompanyAgent.mockRejectedValueOnce(new Error('disable failed'));

    await actions.handleSetConnectorPolicy('connector-1', 'observe');
    await actions.handleSetLearningConflictStatus('conflict-1', 'merged', 'mem-9');
    await actions.handleEnableCompanyAgent('worker-1');
    await actions.handleDisableCompanyAgent('worker-2');

    expect(apiMocks.setConnectorPolicy).toHaveBeenCalledWith('connector-1', 'observe');
    expect(apiMocks.setLearningConflictStatus).toHaveBeenCalledWith('conflict-1', 'merged', 'mem-9');
    expect(apiMocks.enableCompanyAgent).toHaveBeenCalledWith('worker-1');
    expect(apiMocks.disableCompanyAgent).toHaveBeenCalledWith('worker-2');
    expect(refreshActions.refreshPageCenter).toHaveBeenCalledWith('connectors');
    expect(refreshActions.refreshPageCenter).toHaveBeenCalledWith('companyAgents');
    expect(connectorsContext.setError).toHaveBeenCalledWith('disable failed');
  });
});
