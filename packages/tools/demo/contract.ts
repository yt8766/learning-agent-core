import {
  ToolRiskClassifier,
  ToolRegistry,
  buildToolsCenter,
  createDefaultToolRegistry,
  executeConnectorTool,
  executeFilesystemTool,
  executeRuntimeGovernanceTool,
  executeScaffoldTool,
  executeSchedulingTool
} from '../src/index.js';
import * as contractRiskClassifierExports from '../src/contracts/tool-risk-classifier.js';
import * as contractRegistryExports from '../src/contracts/tool-registry.js';
import * as connectorExecutorExports from '../src/executors/connectors/connectors-executor.js';
import * as filesystemExecutorExports from '../src/executors/filesystem/filesystem-executor.js';
import * as runtimeGovernanceExecutorExports from '../src/executors/runtime-governance/runtime-governance-executor.js';
import * as scaffoldExecutorExports from '../src/executors/scaffold/scaffold-executor.js';
import * as schedulingExecutorExports from '../src/executors/scheduling/scheduling-executor.js';
import * as registryExports from '../src/registry/index.js';
import * as toolsCenterExports from '@agent/runtime';

console.log(
  JSON.stringify(
    {
      registryAligned:
        ToolRegistry === registryExports.ToolRegistry &&
        ToolRegistry === contractRegistryExports.ToolRegistry &&
        ToolRiskClassifier === registryExports.ToolRiskClassifier &&
        ToolRiskClassifier === contractRiskClassifierExports.ToolRiskClassifier &&
        createDefaultToolRegistry === registryExports.createDefaultToolRegistry,
      executorAligned:
        executeConnectorTool === connectorExecutorExports.executeConnectorTool &&
        executeFilesystemTool === filesystemExecutorExports.executeFilesystemTool &&
        executeRuntimeGovernanceTool === runtimeGovernanceExecutorExports.executeRuntimeGovernanceTool &&
        executeScaffoldTool === scaffoldExecutorExports.executeScaffoldTool &&
        executeSchedulingTool === schedulingExecutorExports.executeSchedulingTool,
      centerAligned: buildToolsCenter === toolsCenterExports.buildToolsCenter
    },
    null,
    2
  )
);
