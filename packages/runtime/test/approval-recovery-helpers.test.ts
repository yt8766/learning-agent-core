import { describe, expect, it, vi } from 'vitest';

import { ActionIntent } from '@agent/core';

import { executeApprovedAction } from '../src/flows/approval';

describe('approval recovery helpers', () => {
  it('replays approved actions with the original toolInput payload', async () => {
    const execute = vi.fn().mockResolvedValue({
      ok: true,
      outputSummary: 'approved',
      exitCode: 0,
      durationMs: 1
    });

    await executeApprovedAction(
      {
        taskId: 'task-scaffold-approval',
        goal: 'fallback-goal',
        sandbox: {
          execute
        } as any
      },
      {
        taskId: 'task-scaffold-approval',
        intent: ActionIntent.WRITE_FILE,
        toolName: 'write_scaffold',
        researchSummary: '已完成预检，等待审批写入。',
        goal: 'write --host-kind package --name demo-toolkit',
        toolInput: {
          hostKind: 'package',
          name: 'demo-toolkit',
          targetRoot: 'packages/demo-toolkit',
          force: true
        }
      }
    );

    expect(execute).toHaveBeenCalledWith({
      taskId: 'task-scaffold-approval',
      toolName: 'write_scaffold',
      intent: ActionIntent.WRITE_FILE,
      requestedBy: 'agent',
      input: {
        hostKind: 'package',
        name: 'demo-toolkit',
        targetRoot: 'packages/demo-toolkit',
        force: true,
        goal: 'write --host-kind package --name demo-toolkit',
        researchSummary: '已完成预检，等待审批写入。',
        approved: true
      }
    });
  });
});
