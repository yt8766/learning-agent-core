import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  ApprovalService,
  buildConnectorDraftConfig,
  buildConnectorSecretUpdateConfig,
  buildAgentScaffold,
  buildPackageScaffold,
  clearCapabilityPolicyOverride,
  clearConnectorPolicyOverride,
  executeConnectorTool,
  executeFilesystemTool,
  executeRuntimeGovernanceTool,
  executeScaffoldTool,
  executeSchedulingTool,
  ExecutionWatchdog,
  installMcpSkillProvider,
  inspectScaffoldTarget,
  listScaffoldTemplates,
  McpCapabilityRegistry,
  McpClientManager,
  McpServerRegistry,
  McpSkillProviderRegistry,
  findConfiguredConnector,
  resolveConfiguredConnectorId,
  SandboxExecutor,
  setCapabilityPolicyOverride,
  setConfiguredConnectorRecord,
  setConnectorEnabledState,
  setConnectorPolicyOverride,
  StubSandboxExecutor,
  ToolRiskClassifier,
  ToolRegistry,
  buildToolsCenter,
  createDefaultToolRegistry,
  writeScaffoldBundle
} from '../src';
import * as approvalExports from '../src/approval';
import * as contractRiskClassifierExports from '../src/contracts/tool-risk-classifier';
import * as contractRegistryExports from '../src/contracts/tool-registry';
import * as connectorExports from '../src/connectors';
import * as executorConnectorExports from '../src/executors/connectors/connectors-executor';
import * as executorFilesystemExports from '../src/executors/filesystem/filesystem-executor';
import * as mcpExports from '../src/mcp';
import * as registryExports from '../src/registry';
import * as sandboxExports from '../src/sandbox';
import * as scaffoldExports from '../src/scaffold/scaffold-core';
import * as watchdogExports from '../src/watchdog';

describe('@agent/tools root exports', () => {
  it('re-exports the stable runtime-facing tool contracts explicitly', async () => {
    expect(ApprovalService).toBe(approvalExports.ApprovalService);
    expect(ExecutionWatchdog).toBe(watchdogExports.ExecutionWatchdog);
    expect(McpCapabilityRegistry).toBe(mcpExports.McpCapabilityRegistry);
    expect(McpClientManager).toBe(mcpExports.McpClientManager);
    expect(McpServerRegistry).toBe(mcpExports.McpServerRegistry);
    expect(McpSkillProviderRegistry).toBe(mcpExports.McpSkillProviderRegistry);
    expect(installMcpSkillProvider).toBe(mcpExports.installMcpSkillProvider);
    expect(buildConnectorDraftConfig).toBe(connectorExports.buildConnectorDraftConfig);
    expect(buildConnectorSecretUpdateConfig).toBe(connectorExports.buildConnectorSecretUpdateConfig);
    expect(findConfiguredConnector).toBe(connectorExports.findConfiguredConnector);
    expect(ToolRegistry).toBe(registryExports.ToolRegistry);
    expect(ToolRegistry).toBe(contractRegistryExports.ToolRegistry);
    expect(createDefaultToolRegistry).toBe(registryExports.createDefaultToolRegistry);
    expect(ToolRiskClassifier).toBe(registryExports.ToolRiskClassifier);
    expect(ToolRiskClassifier).toBe(contractRiskClassifierExports.ToolRiskClassifier);
    expect(buildToolsCenter).toBe((await import('../src/runtime-governance/tools-center')).buildToolsCenter);
    const connectorGovernanceState = await import('../src/runtime-governance/connector-governance-state');
    expect(setConnectorEnabledState).toBe(connectorGovernanceState.setConnectorEnabledState);
    expect(setConnectorPolicyOverride).toBe(connectorGovernanceState.setConnectorPolicyOverride);
    expect(clearConnectorPolicyOverride).toBe(connectorGovernanceState.clearConnectorPolicyOverride);
    expect(setCapabilityPolicyOverride).toBe(connectorGovernanceState.setCapabilityPolicyOverride);
    expect(clearCapabilityPolicyOverride).toBe(connectorGovernanceState.clearCapabilityPolicyOverride);
    expect(resolveConfiguredConnectorId).toBe(connectorGovernanceState.resolveConfiguredConnectorId);
    expect(setConfiguredConnectorRecord).toBe(connectorGovernanceState.setConfiguredConnectorRecord);
    expect(StubSandboxExecutor).toBe(sandboxExports.StubSandboxExecutor);
    expect(buildAgentScaffold).toBe(scaffoldExports.buildAgentScaffold);
    expect(buildPackageScaffold).toBe(scaffoldExports.buildPackageScaffold);
    expect(inspectScaffoldTarget).toBe(scaffoldExports.inspectScaffoldTarget);
    expect(listScaffoldTemplates).toBe(scaffoldExports.listScaffoldTemplates);
    expect(writeScaffoldBundle).toBe(scaffoldExports.writeScaffoldBundle);
  });

  it('keeps the new executor hosts aligned with root exports', async () => {
    expect(executeConnectorTool).toBe(executorConnectorExports.executeConnectorTool);
    expect(executeFilesystemTool).toBe(executorFilesystemExports.executeFilesystemTool);
    expect(executeRuntimeGovernanceTool).toBe(
      (await import('../src/executors/runtime-governance/runtime-governance-executor')).executeRuntimeGovernanceTool
    );
    expect(executeScaffoldTool).toBe((await import('../src/executors/scaffold/scaffold-executor')).executeScaffoldTool);
    expect(executeSchedulingTool).toBe(
      (await import('../src/executors/scheduling/scheduling-executor')).executeSchedulingTool
    );
  });

  it('keeps the root sandbox contract available to consumers', () => {
    class TestSandbox extends StubSandboxExecutor implements SandboxExecutor {}

    const executor = new TestSandbox();

    expect(executor).toBeInstanceOf(StubSandboxExecutor);
  });

  it('retains contract facade files as the stable contract-first tool entrypoints', () => {
    expect(existsSync(new URL('../src/contracts/tool-registry.ts', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../src/contracts/tool-risk-classifier.ts', import.meta.url))).toBe(true);
  });
});
