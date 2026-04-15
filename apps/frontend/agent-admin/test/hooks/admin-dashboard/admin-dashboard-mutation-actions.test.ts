import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  approveTask: vi.fn(),
  rejectTask: vi.fn(),
  retryTask: vi.fn(),
  createTask: vi.fn(),
  createAgentDiagnosisTask: vi.fn(),
  createOrUpdateCounselorSelector: vi.fn(),
  enableCounselorSelector: vi.fn(),
  disableCounselorSelector: vi.fn(),
  revokeApprovalScopePolicy: vi.fn(),
  promoteSkill: vi.fn(),
  disableSkill: vi.fn(),
  restoreSkill: vi.fn(),
  retireSkill: vi.fn(),
  exportRuntimeCenter: vi.fn(),
  exportApprovalsCenter: vi.fn(),
  exportEvalsCenter: vi.fn(),
  invalidateMemory: vi.fn(),
  supersedeMemory: vi.fn(),
  restoreMemory: vi.fn(),
  retireMemory: vi.fn(),
  invalidateRule: vi.fn(),
  supersedeRule: vi.fn(),
  restoreRule: vi.fn(),
  retireRule: vi.fn(),
  rejectSkillInstall: vi.fn(),
  closeConnectorSession: vi.fn(),
  refreshConnectorDiscovery: vi.fn(),
  enableConnector: vi.fn(),
  disableConnector: vi.fn(),
  setConnectorPolicy: vi.fn(),
  clearConnectorPolicy: vi.fn(),
  setCapabilityPolicy: vi.fn(),
  clearCapabilityPolicy: vi.fn(),
  configureConnector: vi.fn(),
  installSkill: vi.fn(),
  approveSkillInstall: vi.fn(),
  enableSkillSource: vi.fn(),
  disableSkillSource: vi.fn(),
  syncSkillSource: vi.fn(),
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

  it('handles approval-policy, skill, memory and rule governance mutations', async () => {
    const context = createContext('learning');
    const refreshActions = createRefreshActions();
    const actions = createAdminDashboardMutationActions(context as any, refreshActions);
    const promptMock = vi.mocked(window.prompt);

    promptMock.mockReturnValueOnce('rule-next');

    await actions.handleRevokeApprovalPolicy('policy-1');
    await actions.handlePromoteSkill('skill-1');
    await actions.handleDisableSkill('skill-2');
    await actions.handleRestoreSkill('skill-3');
    await actions.handleRetireSkill('skill-4');
    await actions.handleInvalidateMemory('memory-1');
    await actions.handleRestoreMemory('memory-2');
    await actions.handleRetireMemory('memory-3');
    await actions.handleInvalidateRule('rule-1');
    await actions.handleSupersedeRule('rule-2');
    await actions.handleRestoreRule('rule-3');
    await actions.handleRetireRule('rule-4');

    expect(apiMocks.revokeApprovalScopePolicy).toHaveBeenCalledWith('policy-1');
    expect(apiMocks.promoteSkill).toHaveBeenCalledWith('skill-1');
    expect(apiMocks.disableSkill).toHaveBeenCalledWith('skill-2');
    expect(apiMocks.restoreSkill).toHaveBeenCalledWith('skill-3');
    expect(apiMocks.retireSkill).toHaveBeenCalledWith('skill-4');
    expect(apiMocks.invalidateMemory).toHaveBeenCalledWith('memory-1', 'invalidated_from_admin');
    expect(apiMocks.restoreMemory).toHaveBeenCalledWith('memory-2');
    expect(apiMocks.retireMemory).toHaveBeenCalledWith('memory-3', 'retired_from_admin');
    expect(apiMocks.invalidateRule).toHaveBeenCalledWith('rule-1', 'invalidated_from_admin');
    expect(apiMocks.supersedeRule).toHaveBeenCalledWith('rule-2', 'rule-next', 'superseded_from_admin');
    expect(apiMocks.restoreRule).toHaveBeenCalledWith('rule-3');
    expect(apiMocks.retireRule).toHaveBeenCalledWith('rule-4', 'retired_from_admin');
    expect(refreshActions.refreshPageCenter).toHaveBeenCalledWith('runtime');
    expect(refreshActions.refreshPageCenter).toHaveBeenCalledWith('learning');
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

  it('routes connector, capability and skill-source mutations through scoped refreshes', async () => {
    const connectorsContext = createContext('connectors');
    const refreshActions = createRefreshActions();
    const actions = createAdminDashboardMutationActions(connectorsContext as any, refreshActions);

    await actions.handleCloseConnectorSession('connector-1');
    await actions.handleRefreshConnectorDiscovery('connector-1');
    await actions.handleEnableConnector('connector-1');
    await actions.handleDisableConnector('connector-2');
    await actions.handleClearConnectorPolicy('connector-2');
    await actions.handleSetCapabilityPolicy('connector-1', 'cap-1', 'require-approval');
    await actions.handleClearCapabilityPolicy('connector-1', 'cap-1');
    await actions.handleConfigureConnector({
      templateId: 'browser-mcp-template',
      transport: 'http',
      endpoint: 'https://mcp.example.com',
      displayName: 'Research MCP',
      apiKey: 'secret'
    });
    await actions.handleInstallSkill('manifest-1', 'source-1');
    await actions.handleApproveSkillInstall('receipt-1');
    await actions.handleEnableSkillSource('source-1');
    await actions.handleDisableSkillSource('source-2');
    await actions.handleSyncSkillSource('source-3');

    expect(apiMocks.closeConnectorSession).toHaveBeenCalledWith('connector-1');
    expect(apiMocks.refreshConnectorDiscovery).toHaveBeenCalledWith('connector-1');
    expect(apiMocks.enableConnector).toHaveBeenCalledWith('connector-1');
    expect(apiMocks.disableConnector).toHaveBeenCalledWith('connector-2');
    expect(apiMocks.clearConnectorPolicy).toHaveBeenCalledWith('connector-2');
    expect(apiMocks.setCapabilityPolicy).toHaveBeenCalledWith('connector-1', 'cap-1', 'require-approval');
    expect(apiMocks.clearCapabilityPolicy).toHaveBeenCalledWith('connector-1', 'cap-1');
    expect(apiMocks.configureConnector).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 'browser-mcp-template',
        transport: 'http',
        endpoint: 'https://mcp.example.com'
      })
    );
    expect(apiMocks.installSkill).toHaveBeenCalledWith('manifest-1', 'source-1');
    expect(apiMocks.approveSkillInstall).toHaveBeenCalledWith('receipt-1');
    expect(apiMocks.enableSkillSource).toHaveBeenCalledWith('source-1');
    expect(apiMocks.disableSkillSource).toHaveBeenCalledWith('source-2');
    expect(apiMocks.syncSkillSource).toHaveBeenCalledWith('source-3');
    expect(refreshActions.refreshPageCenter).toHaveBeenCalledWith('connectors');
    expect(refreshActions.refreshPageCenter).toHaveBeenCalledWith('skillSources');
    expect(refreshActions.refreshPageCenter).toHaveBeenCalledWith('skills');
  });

  it('creates and edits counselor selectors from prompted values', async () => {
    const context = createContext('learning');
    const refreshActions = createRefreshActions();
    const actions = createAdminDashboardMutationActions(context as any, refreshActions);
    const promptMock = vi.mocked(window.prompt);

    promptMock
      .mockReturnValueOnce('payment-selector-v2')
      .mockReturnValueOnce('payment')
      .mockReturnValueOnce('feature-flag')
      .mockReturnValueOnce('payment-a,payment-b')
      .mockReturnValueOnce('payment-a')
      .mockReturnValueOnce('payment_selector')
      .mockReturnValueOnce('session-ratio')
      .mockReturnValueOnce('ops-a,ops-b')
      .mockReturnValueOnce('ops-b')
      .mockReturnValueOnce('1,3');

    await actions.handleCreateCounselorSelector();
    await actions.handleEditCounselorSelector({
      selectorId: 'ops-selector',
      domain: 'ops',
      strategy: 'manual',
      candidateIds: ['ops-a'],
      defaultCounselorId: 'ops-a',
      enabled: true
    });

    expect(apiMocks.createOrUpdateCounselorSelector).toHaveBeenNthCalledWith(1, {
      selectorId: 'payment-selector-v2',
      domain: 'payment',
      strategy: 'feature-flag',
      candidateIds: ['payment-a', 'payment-b'],
      defaultCounselorId: 'payment-a',
      featureFlag: 'payment_selector'
    });
    expect(apiMocks.createOrUpdateCounselorSelector).toHaveBeenNthCalledWith(2, {
      selectorId: 'ops-selector',
      domain: 'ops',
      strategy: 'session-ratio',
      candidateIds: ['ops-a', 'ops-b'],
      defaultCounselorId: 'ops-b',
      featureFlag: undefined,
      weights: [1, 3],
      enabled: true
    });
    expect(refreshActions.refreshPageCenter).toHaveBeenCalledWith('learning');
  });

  it('skips counselor selector mutations when prompt input is incomplete', async () => {
    const context = createContext('learning');
    const refreshActions = createRefreshActions();
    const actions = createAdminDashboardMutationActions(context as any, refreshActions);
    const promptMock = vi.mocked(window.prompt);

    promptMock.mockReturnValueOnce('').mockReturnValueOnce('task-type').mockReturnValueOnce('');

    await actions.handleCreateCounselorSelector();
    await actions.handleEditCounselorSelector({
      selectorId: 'ops-selector',
      domain: 'ops',
      strategy: 'manual',
      candidateIds: ['ops-a'],
      defaultCounselorId: 'ops-a',
      enabled: true
    });

    expect(apiMocks.createOrUpdateCounselorSelector).not.toHaveBeenCalled();
  });

  it('skips supersede-rule mutation when prompt input is empty', async () => {
    const context = createContext('runtime');
    const refreshActions = createRefreshActions();
    const actions = createAdminDashboardMutationActions(context as any, refreshActions);
    const promptMock = vi.mocked(window.prompt);

    promptMock.mockReturnValueOnce('');

    await actions.handleSupersedeRule('rule-9');

    expect(apiMocks.supersedeRule).not.toHaveBeenCalled();
    expect(refreshActions.refreshAll).not.toHaveBeenCalled();
  });

  it('handles counselor selector toggles and prompt-less skill install rejection', async () => {
    const context = createContext('learning');
    const refreshActions = createRefreshActions();
    const actions = createAdminDashboardMutationActions(context as any, refreshActions);
    const promptMock = vi.mocked(window.prompt);

    promptMock.mockReturnValueOnce(null);

    await actions.handleEnableCounselorSelector('selector-1');
    await actions.handleDisableCounselorSelector('selector-2');
    await actions.handleRejectSkillInstall('receipt-2');

    expect(apiMocks.enableCounselorSelector).toHaveBeenCalledWith('selector-1');
    expect(apiMocks.disableCounselorSelector).toHaveBeenCalledWith('selector-2');
    expect(apiMocks.rejectSkillInstall).toHaveBeenCalledWith('receipt-2', undefined);
    expect(refreshActions.refreshPageCenter).toHaveBeenCalledWith('learning');
    expect(refreshActions.refreshPageCenter).toHaveBeenCalledWith('skillSources');
  });
});
