import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  executeConnectorTool,
  executeFilesystemTool,
  executeRuntimeGovernanceTool,
  executeScaffoldTool,
  executeSchedulingTool
} from '../src';
import { executeConnectorTool as canonicalExecuteConnectorTool } from '../src/executors/connectors/connectors-executor';
import { executeFilesystemTool as canonicalExecuteFilesystemTool } from '../src/executors/filesystem/filesystem-executor';
import { executeRuntimeGovernanceTool as canonicalExecuteRuntimeGovernanceTool } from '../src/executors/runtime-governance/runtime-governance-executor';
import { executeScaffoldTool as canonicalExecuteScaffoldTool } from '../src/executors/scaffold/scaffold-executor';
import { executeSchedulingTool as canonicalExecuteSchedulingTool } from '../src/executors/scheduling/scheduling-executor';

describe('@agent/tools executor host boundary', () => {
  it('keeps root executor exports wired to canonical executor hosts', () => {
    expect(executeConnectorTool).toBe(canonicalExecuteConnectorTool);
    expect(executeFilesystemTool).toBe(canonicalExecuteFilesystemTool);
    expect(executeRuntimeGovernanceTool).toBe(canonicalExecuteRuntimeGovernanceTool);
    expect(executeScaffoldTool).toBe(canonicalExecuteScaffoldTool);
    expect(executeSchedulingTool).toBe(canonicalExecuteSchedulingTool);
  });

  it('removes the legacy compat executor files once canonical hosts exist', () => {
    expect(existsSync(new URL('../src/scaffold/scaffold-executor.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../src/scheduling/scheduling-executor.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../src/runtime-governance/runtime-governance-executor.ts', import.meta.url))).toBe(
      false
    );
    expect(existsSync(new URL('../src/tool-registry.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../src/tool-risk-classifier.ts', import.meta.url))).toBe(false);
  });

  it('removes thin definition and transport wrappers once canonical hosts exist', () => {
    expect(existsSync(new URL('../src/filesystem/filesystem-tool-definitions.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../src/connectors/connector-tool-definitions.ts', import.meta.url))).toBe(false);
    expect(
      existsSync(new URL('../src/runtime-governance/runtime-governance-tool-definitions.ts', import.meta.url))
    ).toBe(false);
    expect(existsSync(new URL('../src/scheduling/scheduling-tool-definitions.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../src/mcp/mcp-http-transport.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../src/mcp/mcp-local-adapter-transport.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../src/mcp/mcp-stdio-transport.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../src/mcp/mcp-transport-handlers.ts', import.meta.url))).toBe(false);
  });

  it('removes filesystem and connector executor wrappers once executors become canonical hosts', () => {
    expect(existsSync(new URL('../src/filesystem/filesystem-executor.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../src/connectors/connectors-executor.ts', import.meta.url))).toBe(false);
  });
});
