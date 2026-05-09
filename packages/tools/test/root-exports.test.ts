import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  AgentToolAliasResolver,
  AutoReviewGate,
  buildAgentScaffold,
  buildConnectorDraftConfig,
  buildConnectorSecretUpdateConfig,
  buildPackageScaffold,
  CommandPolicy,
  createDefaultToolRegistry,
  executeConnectorTool,
  executeFilesystemTool,
  executeRuntimeGovernanceTool,
  executeScaffoldTool,
  executeSchedulingTool,
  findConfiguredConnector,
  installMcpSkillProvider,
  inspectScaffoldTarget,
  listScaffoldTemplates,
  McpCapabilityRegistry,
  McpClientManager,
  McpServerRegistry,
  McpSkillProviderRegistry,
  resolveAgentToolSandboxProfile,
  RuleBasedReviewer,
  shouldRequireAgentToolApproval,
  ToolRegistry,
  ToolRiskClassifier,
  writeScaffoldBundle
} from '../src';
import * as rootExports from '../src';
import * as agentExecutionExports from '../src/agent-execution';
import * as agentSurfaceExports from '../src/agent-surface';
import * as autoReviewExports from '../src/auto-review';
import * as commandExports from '../src/command';
import * as contractRegistryExports from '../src/contracts/tool-registry';
import * as contractRiskClassifierExports from '../src/contracts/tool-risk-classifier';
import * as connectorExports from '../src/connectors';
import * as executorConnectorExports from '../src/executors/connectors/connectors-executor';
import * as executorFilesystemExports from '../src/executors/filesystem/filesystem-executor';
import * as mcpExports from '../src/mcp';
import * as registryExports from '../src/registry';
import * as scaffoldExports from '../src/scaffold/scaffold-core';

describe('@agent/tools root exports', () => {
  it('re-exports stable tool-owned contracts explicitly', () => {
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

  it('retains contract facade files as the stable contract-first tool entrypoints', () => {
    expect(existsSync(new URL('../src/contracts/tool-registry.ts', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../src/contracts/tool-risk-classifier.ts', import.meta.url))).toBe(true);
  });

  it('removes the watchdog compat barrel after runtime became the canonical host', () => {
    expect(existsSync(new URL('../src/watchdog/index.ts', import.meta.url))).toBe(false);
  });

  it('does not expose runtime-owned sandbox internals from the root entrypoint', () => {
    expect(rootExports).not.toHaveProperty('LocalSandboxExecutor');
    expect(rootExports).not.toHaveProperty('StubSandboxExecutor');
    expect(rootExports).not.toHaveProperty('SandboxProviderRegistry');
    expect(rootExports).not.toHaveProperty('normalizeDockerSandboxError');
    expect(rootExports).not.toHaveProperty('normalizeLocalProcessSandboxError');
  });
});
