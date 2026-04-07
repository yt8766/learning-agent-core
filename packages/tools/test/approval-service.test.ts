import { describe, expect, it, vi } from 'vitest';

import { loadSettings } from '@agent/config';
import { ActionIntent, type ToolDefinition } from '@agent/shared';

import { ApprovalService } from '../src/approval-service';

describe('ApprovalService', () => {
  const service = new ApprovalService();
  const personalService = new ApprovalService(
    loadSettings({
      profile: 'personal',
      env: {} as NodeJS.ProcessEnv
    })
  );

  function createTool(overrides: Partial<ToolDefinition>): ToolDefinition {
    return {
      name: 'tool',
      description: 'tool',
      family: 'filesystem',
      category: 'action',
      riskLevel: 'high',
      requiresApproval: true,
      timeoutMs: 1000,
      sandboxProfile: 'workspace-write',
      capabilityType: 'local-tool',
      isReadOnly: false,
      isConcurrencySafe: false,
      isDestructive: false,
      supportsStreamingDispatch: false,
      permissionScope: 'workspace-write',
      inputSchema: {},
      ...overrides
    };
  }

  it('对高风险动作返回需要审批', () => {
    expect(service.requiresApproval(ActionIntent.WRITE_FILE)).toBe(true);
    expect(service.requiresApproval(ActionIntent.DELETE_FILE)).toBe(true);
    expect(service.requiresApproval(ActionIntent.SCHEDULE_TASK)).toBe(true);
    expect(service.getDefaultDecision(ActionIntent.CALL_EXTERNAL_API)).toBe('pending');
  });

  it('对只读动作默认直接批准', () => {
    expect(service.requiresApproval(ActionIntent.READ_FILE)).toBe(false);
    expect(service.getDefaultDecision(ActionIntent.READ_FILE)).toBe('approved');
  });

  it('当工具自身标记 requiresApproval 时也会进入审批', () => {
    expect(
      service.requiresApproval(ActionIntent.READ_FILE, {
        ...createTool({
          name: 'read_local_file',
          description: 'read only tool',
          family: 'filesystem',
          category: 'system',
          riskLevel: 'low',
          sandboxProfile: 'read-only',
          isReadOnly: true,
          permissionScope: 'readonly'
        })
      })
    ).toBe(true);
  });

  it('personal profile 下普通 workspace 写文件自动通过', () => {
    const result = personalService.evaluate(
      ActionIntent.WRITE_FILE,
      {
        ...createTool({
          name: 'write_local_file',
          description: 'write file'
        })
      },
      {
        path: 'src/generated/result.txt'
      }
    );

    expect(result.requiresApproval).toBe(false);
    expect(result.reasonCode).toBe('approved_by_policy');
  });

  it('工作区内普通 dotfile 写入会自动通过', () => {
    const result = personalService.evaluate(
      ActionIntent.WRITE_FILE,
      {
        ...createTool({
          name: 'write_local_file',
          description: 'write file'
        })
      },
      {
        path: '.env.local'
      }
    );

    expect(result.requiresApproval).toBe(false);
    expect(result.reasonCode).toBe('approved_by_policy');
  });

  it('版本控制目录写入仍然保持审批', () => {
    const result = personalService.evaluate(
      ActionIntent.WRITE_FILE,
      {
        ...createTool({
          name: 'write_local_file',
          description: 'write file'
        })
      },
      {
        path: '.git/config'
      }
    );

    expect(result.requiresApproval).toBe(true);
    expect(result.reasonCode).toBe('requires_approval_destructive');
  });

  it('破坏性终端命令必须审批', () => {
    const result = personalService.evaluate(
      ActionIntent.WRITE_FILE,
      {
        ...createTool({
          name: 'run_terminal',
          description: 'run command',
          family: 'mcp',
          capabilityType: 'mcp-capability'
        })
      },
      {
        command: 'rm -rf dist'
      }
    );

    expect(result.requiresApproval).toBe(true);
    expect(result.reasonCode).toBe('preflight_denied');
  });

  it('build/test 命令默认自动通过', () => {
    const result = personalService.evaluate(
      ActionIntent.WRITE_FILE,
      {
        ...createTool({
          name: 'run_terminal',
          description: 'run command',
          family: 'mcp',
          capabilityType: 'mcp-capability'
        })
      },
      {
        command: 'pnpm exec tsc -p packages/agent-core/tsconfig.json --noEmit'
      }
    );

    expect(result.requiresApproval).toBe(false);
    expect(result.reasonCode).toBe('approved_by_policy');
  });

  it('工作区外路径会被前置治理直接阻断', () => {
    const result = service.evaluate(
      ActionIntent.WRITE_FILE,
      {
        ...createTool({
          name: 'write_local_file',
          description: 'write file'
        })
      },
      {
        path: '../.ssh/config'
      }
    );

    expect(result.requiresApproval).toBe(true);
    expect(result.reasonCode).toBe('preflight_denied');
    expect(result.preflightDecision).toBe('deny');
  });

  it('DELETE 请求保持审批，GET 请求自动通过', () => {
    const deleteResult = personalService.evaluate(
      ActionIntent.CALL_EXTERNAL_API,
      {
        ...createTool({
          name: 'http_request',
          description: 'http',
          family: 'knowledge',
          sandboxProfile: 'network-restricted'
        })
      },
      {
        url: 'https://example.com/api/resource',
        method: 'DELETE'
      }
    );
    const getResult = personalService.evaluate(
      ActionIntent.CALL_EXTERNAL_API,
      {
        ...createTool({
          name: 'http_request',
          description: 'http',
          family: 'knowledge',
          sandboxProfile: 'network-restricted'
        })
      },
      {
        url: 'https://example.com/api/resource',
        method: 'GET'
      }
    );

    expect(deleteResult.requiresApproval).toBe(true);
    expect(deleteResult.reasonCode).toBe('requires_approval_tool_policy');
    expect(getResult.requiresApproval).toBe(false);
    expect(getResult.reasonCode).toBe('approved_by_policy');
  });

  it('local-analysis 即使走到外部请求 intent 也默认自动通过', () => {
    const result = personalService.evaluate(
      ActionIntent.CALL_EXTERNAL_API,
      {
        ...createTool({
          name: 'local-analysis',
          description: 'local analysis',
          family: 'knowledge',
          category: 'action',
          riskLevel: 'low',
          requiresApproval: false
        })
      },
      {}
    );

    expect(result.requiresApproval).toBe(false);
    expect(result.reasonCode).toBe('approved_by_policy');
  });

  it('删除文件默认需要人工审批', () => {
    const result = personalService.evaluate(
      ActionIntent.DELETE_FILE,
      {
        ...createTool({
          name: 'delete_local_file',
          description: 'delete file'
        })
      },
      {
        path: 'src/obsolete.ts'
      }
    );

    expect(result.requiresApproval).toBe(true);
    expect(result.reasonCode).toBe('requires_approval_destructive');
  });

  it('定时任务默认需要治理审批', () => {
    const result = personalService.evaluate(
      ActionIntent.SCHEDULE_TASK,
      {
        ...createTool({
          name: 'schedule_task',
          description: 'schedule task',
          family: 'scheduling',
          capabilityType: 'governance-tool'
        })
      },
      {
        target: 'daily skill sync'
      }
    );

    expect(result.requiresApproval).toBe(true);
    expect(result.reasonCode).toBe('requires_approval_tool_policy');
  });

  it('classifier can deny borderline tool requests before interrupt flow', async () => {
    const classifier = vi.fn(async () => ({
      decision: 'deny' as const,
      reason: '刑部分类器阻断了该边界命令。'
    }));
    const classifierService = new ApprovalService(
      loadSettings({
        profile: 'personal',
        env: {} as NodeJS.ProcessEnv
      }),
      { classifier }
    );

    const result = await classifierService.evaluateWithClassifier(
      ActionIntent.WRITE_FILE,
      {
        ...createTool({
          name: 'run_terminal',
          description: 'run command',
          family: 'mcp',
          capabilityType: 'mcp-capability'
        })
      },
      {
        command: 'git push origin main'
      }
    );

    expect(classifier).toHaveBeenCalled();
    expect(result.requiresApproval).toBe(true);
    expect(result.preflightDecision).toBe('deny');
    expect(result.reasonCode).toBe('preflight_denied');
  });
});
