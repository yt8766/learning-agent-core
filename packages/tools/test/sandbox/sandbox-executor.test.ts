import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import {
  assembleDataReportBundle,
  buildDataReportBlueprint,
  buildDataReportModuleScaffold,
  buildDataReportScaffold
} from '@agent/report-kit';
import { ActionIntent } from '@agent/shared';

import { LocalSandboxExecutor } from '../../src/sandbox/sandbox-executor';
import { cleanupTempWorkspaces, createTempWorkspace } from '../test-utils/temp-workspace';

describe('LocalSandboxExecutor find-skills', () => {
  const originalCwd = process.cwd();
  const tempWorkspaces: string[] = [];

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempWorkspaces(tempWorkspaces.splice(0));
  });

  it('discovers installed, local, and cached remote skills from the workspace', async () => {
    const root = await createTempWorkspace('sandbox-find-skills');
    tempWorkspaces.push(root);
    await mkdir(join(root, 'skills', 'repo-audit'), { recursive: true });
    await mkdir(join(root, 'data', 'skills', 'remote-sources', 'bundled-marketplace'), { recursive: true });
    await mkdir(join(root, 'data', 'skills', 'installed', 'bundled-marketplace', 'repo_review_companion', '0.1.0'), {
      recursive: true
    });

    await writeFile(
      join(root, 'skills', 'repo-audit', 'SKILL.md'),
      '# Repo Audit\n\nAudit repository structure and review risks.'
    );
    await writeFile(
      join(root, 'data', 'skills', 'remote-sources', 'bundled-marketplace', 'index.json'),
      JSON.stringify({
        manifests: [
          {
            id: 'repo_review_companion',
            name: 'Repo Review Companion',
            description: 'Remote repo review helper',
            summary: 'Review repository structure and pull requests.',
            version: '0.1.0',
            sourceId: 'bundled-marketplace'
          }
        ]
      })
    );
    await writeFile(
      join(
        root,
        'data',
        'skills',
        'installed',
        'bundled-marketplace',
        'repo_review_companion',
        '0.1.0',
        'repo_review_companion@0.1.0.json'
      ),
      JSON.stringify({
        manifest: {
          id: 'repo_review_companion',
          name: 'Repo Review Companion',
          description: 'Installed repo review helper',
          summary: 'Installed repo review helper',
          version: '0.1.0',
          sourceId: 'bundled-marketplace'
        }
      })
    );

    process.chdir(root);
    const executor = new LocalSandboxExecutor();
    const result = await executor.execute({
      taskId: 'task-find-skills',
      toolName: 'find-skills',
      intent: ActionIntent.READ_FILE,
      requestedBy: 'agent',
      input: {
        goal: 'need a repo review skill',
        limit: 5
      }
    });

    expect(result.ok).toBe(true);
    expect(result.rawOutput).toEqual(
      expect.objectContaining({
        goal: 'need a repo review skill',
        suggestions: expect.arrayContaining([
          expect.objectContaining({
            id: 'repo_review_companion',
            kind: 'installed'
          }),
          expect.objectContaining({
            id: 'repo-audit',
            kind: 'local-manifest'
          }),
          expect.objectContaining({
            id: 'repo_review_companion',
            kind: 'remote-manifest'
          })
        ])
      })
    );
  });

  it('deletes a workspace file with delete_local_file', async () => {
    const root = await createTempWorkspace('sandbox-delete-file');
    tempWorkspaces.push(root);
    const targetFile = join(root, 'data', 'tmp.txt');
    await mkdir(join(root, 'data'), { recursive: true });
    await writeFile(targetFile, 'to-delete');

    process.chdir(root);
    const executor = new LocalSandboxExecutor();
    const result = await executor.execute({
      taskId: 'task-delete-file',
      toolName: 'delete_local_file',
      intent: ActionIntent.DELETE_FILE,
      requestedBy: 'agent',
      input: {
        path: 'data/tmp.txt'
      }
    });

    expect(result.ok).toBe(true);
    await expect(stat(targetFile)).rejects.toThrow();
  });

  it('creates a local runtime schedule with schedule_task', async () => {
    const root = await createTempWorkspace('sandbox-schedule-task');
    tempWorkspaces.push(root);

    process.chdir(root);
    const executor = new LocalSandboxExecutor();
    const result = await executor.execute({
      taskId: 'task-schedule',
      toolName: 'schedule_task',
      intent: ActionIntent.SCHEDULE_TASK,
      requestedBy: 'agent',
      input: {
        name: 'Daily Lark Digest',
        prompt: 'Send a lark digest',
        schedule: 'weekday 09:00',
        status: 'ACTIVE',
        cwd: '.'
      }
    });

    expect(result.ok).toBe(true);
    const output = result.rawOutput as { path: string };
    const created = JSON.parse(await readFile(output.path, 'utf8')) as { name: string; schedule: string };
    expect(created.name).toBe('Daily Lark Digest');
    expect(created.schedule).toBe('weekday 09:00');
  });

  it('generates a data-report scaffold preview without writing files', async () => {
    const root = await createTempWorkspace('sandbox-data-report');
    tempWorkspaces.push(root);

    process.chdir(root);
    const executor = new LocalSandboxExecutor();
    const result = await executor.execute({
      taskId: 'task-data-report',
      toolName: 'generate_data_report_scaffold',
      intent: ActionIntent.READ_FILE,
      requestedBy: 'agent',
      input: {
        goal: '参考 bonusCenterData 生成多个数据报表页面',
        taskContext: 'bonusCenterData template'
      }
    });

    expect(result.ok).toBe(true);
    expect(result.outputSummary).toContain('Generated data-report scaffold');
    expect(result.rawOutput).toEqual(
      expect.objectContaining({
        scope: 'multiple',
        templateRef: 'bonusCenterData',
        templateId: 'bonus-center-data',
        files: expect.arrayContaining([
          expect.objectContaining({ path: 'src/pages/dataDashboard/bonusCenterData/index.tsx' }),
          expect.objectContaining({ path: 'src/pages/dataDashboard/bonusCenterData/components/Search/index.tsx' }),
          expect.objectContaining({ path: 'src/services/data/bonusCenter.ts' }),
          expect.objectContaining({ path: 'src/types/data/bonusCenter.ts' })
        ])
      })
    );
    const output = result.rawOutput as {
      files: Array<{ path: string; content: string }>;
    };
    expect(
      output.files.find(item => item.path === 'src/pages/dataDashboard/bonusCenterData/index.tsx')?.content
    ).toContain('PageContainer');
    expect(output.files.some(item => item.path === 'src/routes.ts')).toBe(false);
  });

  it('plans a data-report blueprint preview without writing files', async () => {
    const root = await createTempWorkspace('sandbox-data-report-blueprint');
    tempWorkspaces.push(root);

    process.chdir(root);
    const executor = new LocalSandboxExecutor();
    const result = await executor.execute({
      taskId: 'task-data-report-blueprint',
      toolName: 'plan_data_report_structure',
      intent: ActionIntent.READ_FILE,
      requestedBy: 'agent',
      input: {
        goal: '参考 bonusCenterData 生成多个数据报表页面',
        taskContext: 'bonusCenterData template'
      }
    });

    expect(result.ok).toBe(true);
    expect(result.rawOutput).toEqual(
      expect.objectContaining({
        templateId: 'bonus-center-data',
        pageDir: 'src/pages/dataDashboard/bonusCenterData',
        modules: expect.arrayContaining([expect.objectContaining({ id: 'TaskPagePenetration' })])
      })
    );
  });

  it('generates a data-report module preview without writing files', async () => {
    const root = await createTempWorkspace('sandbox-data-report-module');
    tempWorkspaces.push(root);

    process.chdir(root);
    const executor = new LocalSandboxExecutor();
    const result = await executor.execute({
      taskId: 'task-data-report-module',
      toolName: 'generate_data_report_module',
      intent: ActionIntent.READ_FILE,
      requestedBy: 'agent',
      input: {
        goal: '参考 bonusCenterData 生成多个数据报表页面',
        taskContext: 'bonusCenterData template',
        moduleId: 'TaskPagePenetration'
      }
    });

    expect(result.ok).toBe(true);
    expect(result.rawOutput).toEqual(
      expect.objectContaining({
        templateId: 'bonus-center-data',
        module: expect.objectContaining({ id: 'TaskPagePenetration' }),
        files: expect.arrayContaining([
          expect.objectContaining({
            path: 'src/pages/dataDashboard/bonusCenterData/components/TaskPagePenetration/index.tsx'
          })
        ])
      })
    );
  });

  it('assembles a data-report delivery bundle preview without writing files', async () => {
    const root = await createTempWorkspace('sandbox-data-report-assembly');
    tempWorkspaces.push(root);

    process.chdir(root);
    const executor = new LocalSandboxExecutor();
    const blueprintResult = await executor.execute({
      taskId: 'task-data-report-blueprint-2',
      toolName: 'plan_data_report_structure',
      intent: ActionIntent.READ_FILE,
      requestedBy: 'agent',
      input: {
        goal: '参考 bonusCenterData 生成多个数据报表页面',
        taskContext: 'bonusCenterData template'
      }
    });
    const moduleResult = await executor.execute({
      taskId: 'task-data-report-module-2',
      toolName: 'generate_data_report_module',
      intent: ActionIntent.READ_FILE,
      requestedBy: 'agent',
      input: {
        goal: '参考 bonusCenterData 生成多个数据报表页面',
        taskContext: 'bonusCenterData template',
        moduleId: 'TaskPagePenetration'
      }
    });
    const scaffoldResult = await executor.execute({
      taskId: 'task-data-report-scaffold-2',
      toolName: 'generate_data_report_scaffold',
      intent: ActionIntent.READ_FILE,
      requestedBy: 'agent',
      input: {
        goal: '参考 bonusCenterData 生成多个数据报表页面',
        taskContext: 'bonusCenterData template'
      }
    });
    const routeResult = await executor.execute({
      taskId: 'task-data-report-routes',
      toolName: 'generate_data_report_routes',
      intent: ActionIntent.READ_FILE,
      requestedBy: 'agent',
      input: {
        blueprint: blueprintResult.rawOutput
      }
    });

    const result = await executor.execute({
      taskId: 'task-data-report-assembly',
      toolName: 'assemble_data_report_bundle',
      intent: ActionIntent.READ_FILE,
      requestedBy: 'agent',
      input: {
        blueprint: blueprintResult.rawOutput,
        moduleResults: [moduleResult.rawOutput],
        sharedFiles: (scaffoldResult.rawOutput as any).files,
        routeFiles: (routeResult.rawOutput as any).files
      }
    });

    expect(result.ok).toBe(true);
    expect(result.rawOutput).toEqual(
      expect.objectContaining({
        assemblyPlan: expect.objectContaining({
          moduleArtifacts: expect.arrayContaining([expect.objectContaining({ moduleId: 'TaskPagePenetration' })]),
          routeArtifacts: expect.arrayContaining(['App.tsx']),
          postProcessSummary: expect.objectContaining({ pending: false })
        }),
        sandpackFiles: expect.objectContaining({
          '/App.tsx': expect.objectContaining({
            code: expect.stringContaining("import ReportPage from './src/pages/dataDashboard/bonusCenterData';")
          })
        })
      })
    );
  });

  it('writes an assembled data-report bundle into the requested target root', async () => {
    const root = await createTempWorkspace('sandbox-data-report-write');
    tempWorkspaces.push(root);

    const blueprint = buildDataReportBlueprint({
      goal: '参考 bonusCenterData 生成多个数据报表页面',
      taskContext: 'bonusCenterData template'
    });
    const moduleResult = buildDataReportModuleScaffold({
      goal: '参考 bonusCenterData 生成多个数据报表页面',
      taskContext: 'bonusCenterData template',
      moduleId: 'TaskPagePenetration'
    });
    const scaffold = buildDataReportScaffold({
      goal: '参考 bonusCenterData 生成多个数据报表页面',
      taskContext: 'bonusCenterData template'
    });
    const bundle = assembleDataReportBundle({
      blueprint,
      moduleResults: [moduleResult],
      sharedFiles: scaffold.files
    });

    process.chdir(root);
    const executor = new LocalSandboxExecutor();
    const result = await executor.execute({
      taskId: 'task-data-report-write',
      toolName: 'write_data_report_bundle',
      intent: ActionIntent.WRITE_FILE,
      requestedBy: 'agent',
      input: {
        bundle,
        targetRoot: 'output/report-bundle'
      }
    });

    expect(result.ok).toBe(true);
    expect(result.outputSummary).toContain('Materialized data-report bundle');
    const appContent = await readFile(join(root, 'output/report-bundle/App.tsx'), 'utf8');
    expect(appContent).toContain("import ReportPage from './src/pages/dataDashboard/bonusCenterData';");
  });
});
