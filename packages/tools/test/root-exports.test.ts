import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  ApprovalService,
  AgentToolAliasResolver,
  AutoReviewGate,
  buildConnectorDraftConfig,
  buildConnectorSecretUpdateConfig,
  buildDockerSandboxCommandPlan,
  buildAgentScaffold,
  buildPackageScaffold,
  clearCapabilityPolicyOverride,
  clearConnectorPolicyOverride,
  CommandPolicy,
  createDockerSandboxProviderPlugin,
  DockerSandboxProvider,
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
  resolveAgentToolSandboxProfile,
  resolveConfiguredConnectorId,
  RuleBasedReviewer,
  SandboxExecutor,
  SandboxPolicy,
  SandboxProviderRegistry,
  setCapabilityPolicyOverride,
  setConfiguredConnectorRecord,
  setConnectorEnabledState,
  setConnectorPolicyOverride,
  shouldRequireAgentToolApproval,
  SimulatedSandboxProvider,
  StubSandboxExecutor,
  ToolRiskClassifier,
  ToolRegistry,
  buildToolsCenter,
  createDefaultToolRegistry,
  writeScaffoldBundle
} from '../src';
import * as rootExports from '../src';
import * as agentExecutionExports from '../src/agent-execution';
import * as agentSurfaceExports from '../src/agent-surface';
import * as approvalExports from '../src/approval';
import * as autoReviewExports from '../src/auto-review';
import * as commandExports from '../src/command';
import * as contractRiskClassifierExports from '../src/contracts/tool-risk-classifier';
import * as contractRegistryExports from '../src/contracts/tool-registry';
import * as connectorExports from '../src/connectors';
import * as executorConnectorExports from '../src/executors/connectors/connectors-executor';
import * as executorFilesystemExports from '../src/executors/filesystem/filesystem-executor';
import * as mcpExports from '../src/mcp';
import * as registryExports from '../src/registry';
import * as sandboxExports from '../src/sandbox';
import * as scaffoldExports from '../src/scaffold/scaffold-core';

describe('@agent/tools root exports', () => {
  it('re-exports the stable runtime-facing tool contracts explicitly', async () => {
    expect(ApprovalService).toBe(approvalExports.ApprovalService);
    const runtimeExports = await import('@agent/runtime');
    expect(ExecutionWatchdog).toBe(runtimeExports.ExecutionWatchdog);
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
    const runtimeGovernanceExports = runtimeExports;
    expect(buildToolsCenter).toBe(runtimeGovernanceExports.buildToolsCenter);
    const connectorGovernanceState = runtimeGovernanceExports;
    expect(setConnectorEnabledState).toBe(connectorGovernanceState.setConnectorEnabledState);
    expect(setConnectorPolicyOverride).toBe(connectorGovernanceState.setConnectorPolicyOverride);
    expect(clearConnectorPolicyOverride).toBe(connectorGovernanceState.clearConnectorPolicyOverride);
    expect(setCapabilityPolicyOverride).toBe(connectorGovernanceState.setCapabilityPolicyOverride);
    expect(clearCapabilityPolicyOverride).toBe(connectorGovernanceState.clearCapabilityPolicyOverride);
    expect(resolveConfiguredConnectorId).toBe(connectorGovernanceState.resolveConfiguredConnectorId);
    expect(setConfiguredConnectorRecord).toBe(connectorGovernanceState.setConfiguredConnectorRecord);
    expect(StubSandboxExecutor).toBe(sandboxExports.StubSandboxExecutor);
    expect(DockerSandboxProvider).toBe(sandboxExports.DockerSandboxProvider);
    expect(buildDockerSandboxCommandPlan).toBe(sandboxExports.buildDockerSandboxCommandPlan);
    expect(createDockerSandboxProviderPlugin).toBe(sandboxExports.createDockerSandboxProviderPlugin);
    expect(SandboxPolicy).toBe(sandboxExports.SandboxPolicy);
    expect(SandboxProviderRegistry).toBe(sandboxExports.SandboxProviderRegistry);
    expect(SimulatedSandboxProvider).toBe(sandboxExports.SimulatedSandboxProvider);
    expect(CommandPolicy).toBe(commandExports.CommandPolicy);
    expect(AutoReviewGate).toBe(autoReviewExports.AutoReviewGate);
    expect(RuleBasedReviewer).toBe(autoReviewExports.RuleBasedReviewer);
    expect(shouldRequireAgentToolApproval).toBe(agentExecutionExports.shouldRequireAgentToolApproval);
    expect(resolveAgentToolSandboxProfile).toBe(agentExecutionExports.resolveAgentToolSandboxProfile);
    expect(AgentToolAliasResolver).toBe(agentSurfaceExports.AgentToolAliasResolver);
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

  it('removes the watchdog compat barrel after runtime became the canonical host', () => {
    expect(existsSync(new URL('../src/watchdog/index.ts', import.meta.url))).toBe(false);
  });

  it('does not expose sandbox provider internals from the root entrypoint', () => {
    expect(rootExports).not.toHaveProperty('normalizeDockerSandboxError');
    expect(rootExports).not.toHaveProperty('normalizeLocalProcessSandboxError');
  });
});
