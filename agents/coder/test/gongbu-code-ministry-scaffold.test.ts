import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDefaultToolRegistry } from '@agent/tools';

import { GongbuCodeMinistry } from '../src';

type MinistryContext = ConstructorParameters<typeof GongbuCodeMinistry>[0];

describe('GongbuCodeMinistry scaffold workflow', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
  });

  function createContext(overrides?: {
    goal?: string;
    approvalResult?: {
      requiresApproval: boolean;
      reasonCode: string;
      reason: string;
    };
    sandboxResult?: {
      ok: boolean;
      outputSummary: string;
      rawOutput?: unknown;
      exitCode: number;
      durationMs: number;
    };
  }) {
    const sandboxExecute = vi.fn().mockResolvedValue(
      overrides?.sandboxResult ?? {
        ok: true,
        outputSummary: 'preview ok',
        rawOutput: { files: [] },
        exitCode: 0,
        durationMs: 1
      }
    );
    const evaluateWithClassifier = vi.fn().mockResolvedValue(
      overrides?.approvalResult ?? {
        requiresApproval: false,
        reasonCode: 'approved_by_policy',
        reason: '只读或已通过预检的动作允许继续。'
      }
    );

    return {
      context: {
        taskId: 'task-scaffold',
        goal: overrides?.goal ?? 'preview --host-kind package --name demo-toolkit',
        workflowPreset: {
          id: 'scaffold',
          displayName: '通用脚手架生成流程',
          allowedCapabilities: ['list_scaffold_templates', 'preview_scaffold', 'write_scaffold']
        },
        toolRegistry: createDefaultToolRegistry(),
        approvalService: {
          evaluateWithClassifier
        },
        sandbox: {
          execute: sandboxExecute
        },
        executionMode: 'execute',
        thinking: {
          manager: false,
          research: false,
          executor: false,
          reviewer: false
        }
      } as unknown as MinistryContext,
      sandboxExecute,
      evaluateWithClassifier
    };
  }

  it('routes scaffold preview commands to preview_scaffold with stable structured input', async () => {
    const { context, sandboxExecute, evaluateWithClassifier } = createContext({
      goal: 'preview --host-kind package --name demo-toolkit --template-id package-lib'
    });
    const ministry = new GongbuCodeMinistry(context);

    const result = await ministry.execute('执行显式 scaffold preview', '先按模板预览目录结构');

    expect(result.requiresApproval).toBe(false);
    expect(result.toolName).toBe('preview_scaffold');
    expect(evaluateWithClassifier).toHaveBeenCalled();
    expect(sandboxExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'preview_scaffold',
        input: expect.objectContaining({
          hostKind: 'package',
          name: 'demo-toolkit',
          templateId: 'package-lib'
        })
      })
    );
  });

  it('returns conflict summary before approval when scaffold write target is already occupied', async () => {
    const root = await mkdtemp(join(tmpdir(), 'gongbu-scaffold-'));
    tempDirs.push(root);
    const targetRoot = join(root, 'packages', 'demo-toolkit');
    await mkdir(targetRoot, { recursive: true });
    await writeFile(join(targetRoot, 'README.md'), '# occupied\n', 'utf8');

    const { context, sandboxExecute, evaluateWithClassifier } = createContext({
      goal: `write --host-kind package --name demo-toolkit --target-root ${targetRoot}`
    });
    const ministry = new GongbuCodeMinistry(context);

    const result = await ministry.execute('执行显式 scaffold write', '先做目标目录预检');

    expect(result.requiresApproval).toBe(false);
    expect(result.toolName).toBe('write_scaffold');
    expect(result.summary).toContain('Scaffold target is not empty');
    expect(result.executionResult?.rawOutput).toEqual(
      expect.objectContaining({
        blocked: true,
        inspection: expect.objectContaining({
          canWriteSafely: false,
          targetRoot
        })
      })
    );
    expect(evaluateWithClassifier).not.toHaveBeenCalled();
    expect(sandboxExecute).not.toHaveBeenCalled();
    expect(existsSync(join(targetRoot, 'demo', 'demo-toolkit-demo.ts'))).toBe(false);
  });

  it('requires approval for scaffold write only after target inspection succeeds', async () => {
    const root = await mkdtemp(join(tmpdir(), 'gongbu-scaffold-approval-'));
    tempDirs.push(root);
    const targetRoot = join(root, 'packages', 'demo-toolkit');

    const { context, sandboxExecute, evaluateWithClassifier } = createContext({
      goal: `write --host-kind package --name demo-toolkit --target-root ${targetRoot}`,
      approvalResult: {
        requiresApproval: true,
        reasonCode: 'requires_approval_tool_policy',
        reason: 'write_scaffold 已被工具策略标记为必须审批。'
      }
    });
    const ministry = new GongbuCodeMinistry(context);

    const result = await ministry.execute('执行显式 scaffold write', '目录预检通过后等待人工审批');

    expect(result.requiresApproval).toBe(true);
    expect(result.toolName).toBe('write_scaffold');
    expect(result.toolInput).toEqual(
      expect.objectContaining({
        hostKind: 'package',
        name: 'demo-toolkit',
        targetRoot,
        force: false
      })
    );
    expect(result.approvalPreview).toEqual(expect.arrayContaining([{ label: 'Target Root', value: targetRoot }]));
    expect(evaluateWithClassifier).toHaveBeenCalledWith(
      'write_file',
      expect.objectContaining({ name: 'write_scaffold' }),
      expect.objectContaining({
        targetRoot
      })
    );
    expect(sandboxExecute).not.toHaveBeenCalled();
  });
});
