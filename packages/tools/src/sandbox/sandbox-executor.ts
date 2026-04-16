import { ToolExecutionRequest, ToolExecutionResult } from '@agent/shared';
import {
  assembleDataReportBundle,
  buildDataReportBlueprint,
  buildDataReportModuleScaffold,
  buildDataReportRoutes,
  buildDataReportScaffold,
  writeDataReportBundle
} from '@agent/report-kit';

import { executeConnectorTool } from '../connectors/connectors-executor';
import { executeFilesystemTool } from '../filesystem/filesystem-executor';
import { executeRuntimeGovernanceTool } from '../runtime-governance/runtime-governance-executor';
import { executeScaffoldTool } from '../scaffold/scaffold-executor';
import { executeSchedulingTool } from '../scheduling/scheduling-executor';
import { executeBrowsePage } from './sandbox-executor-browser';
import { executeFindSkills } from './sandbox-executor-skill-search';

export interface SandboxExecutor {
  execute(request: ToolExecutionRequest): Promise<ToolExecutionResult>;
}

export class LocalSandboxExecutor implements SandboxExecutor {
  async execute(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const startedAt = Date.now();

    try {
      const result = await this.executeInternal(request);
      return {
        ok: true,
        outputSummary: result.outputSummary,
        rawOutput: result.rawOutput,
        exitCode: 0,
        durationMs: Date.now() - startedAt
      };
    } catch (error) {
      return {
        ok: false,
        outputSummary: 'Sandbox execution failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown sandbox error',
        exitCode: 1,
        durationMs: Date.now() - startedAt
      };
    }
  }

  private async executeInternal(request: ToolExecutionRequest): Promise<{ outputSummary: string; rawOutput: unknown }> {
    const filesystemResult = await executeFilesystemTool(request);
    if (filesystemResult) {
      return filesystemResult;
    }

    const schedulingResult = await executeSchedulingTool(request);
    if (schedulingResult) {
      return schedulingResult;
    }

    const connectorResult = await executeConnectorTool(request);
    if (connectorResult) {
      return connectorResult;
    }

    const runtimeGovernanceResult = await executeRuntimeGovernanceTool(request);
    if (runtimeGovernanceResult) {
      return runtimeGovernanceResult;
    }

    const scaffoldResult = await executeScaffoldTool(request);
    if (scaffoldResult) {
      return scaffoldResult;
    }

    switch (request.toolName) {
      case 'http_request': {
        return {
          outputSummary:
            'HTTP requests remain disabled in the local sandbox. Use this as an approval placeholder only.',
          rawOutput: { blocked: true, reason: 'network_restricted', request: request.input }
        };
      }
      case 'local-analysis': {
        const goal = typeof request.input.goal === 'string' ? request.input.goal : 'unknown goal';
        const researchSummary =
          typeof request.input.researchSummary === 'string' ? request.input.researchSummary : 'no research summary';
        return {
          outputSummary: `Local analysis reviewed goal "${goal}" using summary: ${researchSummary}`,
          rawOutput: { goal, researchSummary }
        };
      }
      case 'find-skills':
        return executeFindSkills(request);
      case 'generate_data_report_scaffold': {
        const goal = typeof request.input.goal === 'string' ? request.input.goal : 'unknown goal';
        const taskContext = typeof request.input.taskContext === 'string' ? request.input.taskContext : undefined;
        const baseDir = typeof request.input.baseDir === 'string' ? request.input.baseDir : undefined;
        const scaffold = buildDataReportScaffold({ goal, taskContext, baseDir });
        return {
          outputSummary: `Generated data-report scaffold with ${scaffold.files.length} files for "${goal}"`,
          rawOutput: scaffold
        };
      }
      case 'generate_data_report_module': {
        const goal = typeof request.input.goal === 'string' ? request.input.goal : 'unknown goal';
        const taskContext = typeof request.input.taskContext === 'string' ? request.input.taskContext : undefined;
        const baseDir = typeof request.input.baseDir === 'string' ? request.input.baseDir : undefined;
        const moduleId = typeof request.input.moduleId === 'string' ? request.input.moduleId : 'Overview';
        const moduleScaffold = buildDataReportModuleScaffold({ goal, taskContext, baseDir, moduleId });
        return {
          outputSummary: `Generated data-report module ${moduleScaffold.module.id} with ${moduleScaffold.files.length} files`,
          rawOutput: moduleScaffold
        };
      }
      case 'assemble_data_report_bundle': {
        const blueprint = request.input.blueprint as any;
        const moduleResults = Array.isArray(request.input.moduleResults) ? (request.input.moduleResults as any[]) : [];
        const sharedFiles = Array.isArray(request.input.sharedFiles) ? (request.input.sharedFiles as any[]) : [];
        const routeFiles = Array.isArray(request.input.routeFiles) ? (request.input.routeFiles as any[]) : undefined;
        const bundle = assembleDataReportBundle({
          blueprint,
          moduleResults,
          sharedFiles,
          routeFiles
        });
        return {
          outputSummary: `Assembled data-report bundle with ${bundle.assemblyPlan.totalFiles} files`,
          rawOutput: bundle
        };
      }
      case 'write_data_report_bundle': {
        const bundle = request.input.bundle as any;
        const targetRoot =
          typeof request.input.targetRoot === 'string' ? request.input.targetRoot : 'data/generated/data-report-output';
        const result = await writeDataReportBundle({
          bundle,
          targetRoot
        });
        return {
          outputSummary: `Materialized data-report bundle with ${result.totalWritten} files into ${targetRoot}`,
          rawOutput: result
        };
      }
      case 'plan_data_report_structure': {
        const goal = typeof request.input.goal === 'string' ? request.input.goal : 'unknown goal';
        const taskContext = typeof request.input.taskContext === 'string' ? request.input.taskContext : undefined;
        const baseDir = typeof request.input.baseDir === 'string' ? request.input.baseDir : undefined;
        const blueprint = buildDataReportBlueprint({ goal, taskContext, baseDir });
        return {
          outputSummary: `Planned data-report blueprint with ${blueprint.modules.length} modules for "${goal}"`,
          rawOutput: blueprint
        };
      }
      case 'generate_data_report_routes': {
        const blueprint = request.input.blueprint as any;
        const routeResult = buildDataReportRoutes(blueprint);
        return {
          outputSummary: `Generated data-report routes with ${routeResult.files.length} files`,
          rawOutput: routeResult
        };
      }
      case 'collect_research_source': {
        const goal = typeof request.input.goal === 'string' ? request.input.goal : 'unknown goal';
        const url = typeof request.input.url === 'string' ? request.input.url : 'https://example.com/';
        const trustClass = typeof request.input.trustClass === 'string' ? request.input.trustClass : 'official';
        const sourceType =
          typeof request.input.sourceType === 'string' ? request.input.sourceType : 'web_research_plan';
        const host = new URL(url).host;
        return {
          outputSummary: `Collected research summary from ${host} for "${goal}"`,
          rawOutput: {
            url,
            host,
            goal,
            trustClass,
            sourceType,
            fetchedAt: new Date().toISOString(),
            summary: `已从 ${host} 抓取与“${goal}”相关的结构化摘要，适合作为后续研究与学习沉淀的依据。`,
            simulated: true
          }
        };
      }
      case 'webSearchPrime': {
        const goal = typeof request.input.goal === 'string' ? request.input.goal : 'unknown goal';
        const query = typeof request.input.query === 'string' ? request.input.query : goal;
        const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
        return {
          outputSummary: `已为“${query}”检索到可引用的网页结果`,
          rawOutput: {
            query,
            results: [
              {
                url: searchUrl,
                title: 'Bing 搜索结果',
                summary: `与“${query}”相关的开放网页搜索结果页。`,
                sourceType: 'web_search_result',
                trustClass: 'official',
                fetchedAt: new Date().toISOString()
              }
            ]
          }
        };
      }
      case 'webReader': {
        const goal = typeof request.input.goal === 'string' ? request.input.goal : 'unknown goal';
        const url = typeof request.input.url === 'string' ? request.input.url : 'https://example.com/';
        const host = new URL(url).host;
        return {
          outputSummary: `已读取 ${host} 页面内容并整理为可引用摘要`,
          rawOutput: {
            url,
            title: `${host} 页面摘要`,
            summary: `已从 ${host} 页面中提取与“${goal}”相关的正文摘要，可直接作为来源引用。`,
            sourceType: 'document',
            trustClass: 'official',
            fetchedAt: new Date().toISOString()
          }
        };
      }
      case 'search_doc': {
        const query = typeof request.input.query === 'string' ? request.input.query : 'unknown goal';
        const repoUrl =
          typeof request.input.repoUrl === 'string' ? request.input.repoUrl : 'https://github.com/example/repo';
        return {
          outputSummary: '已从文档/仓库来源中检索到可引用片段',
          rawOutput: {
            url: repoUrl,
            title: '文档检索结果',
            summary: `已围绕“${query}”从文档/仓库来源提取结构化片段。`,
            sourceType: 'document',
            trustClass: 'official',
            fetchedAt: new Date().toISOString()
          }
        };
      }
      case 'browse_page':
        return executeBrowsePage(request);
      case 'run_terminal': {
        const command = typeof request.input.command === 'string' ? request.input.command : 'pnpm test -- --help';
        return {
          outputSummary: `Terminal MCP simulated command: ${command}`,
          rawOutput: { command, simulated: true }
        };
      }
      case 'ship_release': {
        const target = typeof request.input.target === 'string' ? request.input.target : 'main';
        const goal = typeof request.input.goal === 'string' ? request.input.goal : 'unknown release goal';
        return {
          outputSummary: `Release MCP simulated shipping target "${target}" for "${goal}"`,
          rawOutput: { target, goal, simulated: true }
        };
      }
      default: {
        return {
          outputSummary: `Sandbox stub executed ${request.toolName}`,
          rawOutput: {
            intent: request.intent,
            input: request.input
          }
        };
      }
    }
  }
}

export class StubSandboxExecutor extends LocalSandboxExecutor {}
