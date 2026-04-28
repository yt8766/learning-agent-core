import { describe, expect, it } from 'vitest';

import {
  HttpMethodPermissionChecker,
  TerminalToolPermissionChecker,
  WorkspacePathPermissionChecker,
  defaultPreflightStaticRules,
  evaluatePermissionCheckers,
  evaluateStaticPolicy,
  mergeGovernanceDecisions
} from '@agent/runtime';

describe('preflight-governance helpers', () => {
  const settings = {
    profile: 'default'
  } as any;

  it('evaluates static policy rules by priority and returns reason codes', () => {
    const tool = { name: 'run_terminal', family: 'terminal' } as any;

    expect(
      evaluateStaticPolicy(
        defaultPreflightStaticRules(),
        { name: 'read_file', family: 'filesystem' } as any,
        { executionMode: 'plan' } as any,
        settings
      )
    ).toEqual({
      decision: 'allow',
      reason: '只读能力默认通过前置治理。',
      reasonCode: 'static_policy_allow',
      matchedRuleId: 'readonly-tools-allow'
    });

    expect(
      evaluateStaticPolicy(
        defaultPreflightStaticRules(),
        { name: 'runtime_policy', family: 'runtime-governance' } as any,
        undefined,
        settings
      )
    ).toEqual({
      decision: 'ask',
      reason: '治理类能力默认进入人工裁决链。',
      reasonCode: 'static_policy_ask',
      matchedRuleId: 'governance-tools-ask'
    });

    expect(
      evaluateStaticPolicy(defaultPreflightStaticRules(), tool, { command: 'git reset --hard HEAD' } as any, settings)
    ).toEqual({
      decision: 'deny',
      reason: '检测到高危终端模式，前置治理直接阻断。',
      reasonCode: 'static_policy_deny',
      matchedRuleId: 'destructive-terminal-deny'
    });
  });

  it('returns undefined when static policy rules do not match tool, profile, or execution mode', () => {
    expect(
      evaluateStaticPolicy(
        [
          {
            id: 'profile-only',
            effect: 'ask',
            priority: 1,
            reason: 'special profile only',
            profiles: ['imperial']
          }
        ] as any,
        { name: 'read_file', family: 'filesystem' } as any,
        { executionMode: 'plan' } as any,
        settings
      )
    ).toBeUndefined();
  });

  it('evaluates permission checkers in order and skips unsupported tools', () => {
    const checkers = [
      {
        supports: () => false,
        check: () => ({ decision: 'deny' })
      },
      {
        supports: () => true,
        check: () => undefined
      },
      {
        supports: () => true,
        check: () => ({
          decision: 'ask',
          reason: 'matched checker',
          reasonCode: 'tool_checker_ask'
        })
      }
    ] as any;

    expect(evaluatePermissionCheckers(checkers, { name: 'http_request', family: 'network' } as any, {} as any)).toEqual(
      {
        decision: 'ask',
        reason: 'matched checker',
        reasonCode: 'tool_checker_ask'
      }
    );
    expect(evaluatePermissionCheckers(checkers, undefined, {} as any)).toBeUndefined();
  });

  it('checks terminal commands for missing preview and destructive segments', () => {
    const checker = new TerminalToolPermissionChecker();
    const tool = { name: 'run_terminal', family: 'terminal' } as any;

    expect(checker.supports(tool)).toBe(true);
    expect(checker.check(tool, {} as any)).toEqual({
      decision: 'ask',
      reason: '终端命令缺少 command 预览，前置治理要求人工确认。',
      reasonCode: 'tool_checker_ask'
    });
    expect(checker.check(tool, { command: 'echo ok; rm -rf dist' } as any)).toEqual({
      decision: 'deny',
      reason: '工具 run_terminal 命中破坏性命令片段，前置治理已阻断。',
      reasonCode: 'tool_checker_deny',
      details: {
        segments: ['echo ok', 'rm -rf dist']
      }
    });
    expect(checker.check(tool, { command: 'echo safe' } as any)).toBeUndefined();
  });

  it('checks workspace paths for escaped paths on filesystem and scaffold tools', () => {
    const checker = new WorkspacePathPermissionChecker();

    expect(checker.supports({ name: 'read_file', family: 'filesystem' } as any)).toBe(true);
    expect(checker.supports({ name: 'write_scaffold', family: 'scaffold' } as any)).toBe(true);
    expect(checker.supports({ name: 'http_request', family: 'network' } as any)).toBe(false);
    expect(
      checker.check(
        { name: 'read_file', family: 'filesystem' } as any,
        {
          path: '../outside.txt'
        } as any
      )
    ).toEqual({
      decision: 'deny',
      reason: '工具 read_file 试图访问工作区外路径 ../outside.txt，前置治理已阻断。',
      reasonCode: 'tool_checker_deny',
      details: { path: '../outside.txt' }
    });
    expect(
      checker.check(
        { name: 'write_file', family: 'filesystem' } as any,
        {
          fromPath: 'workspace/a.ts',
          toPath: 'workspace/b.ts'
        } as any
      )
    ).toBeUndefined();
    expect(
      checker.check(
        { name: 'write_scaffold', family: 'scaffold' } as any,
        {
          targetRoot: '../outside/generated'
        } as any
      )
    ).toEqual({
      decision: 'deny',
      reason: '工具 write_scaffold 试图访问工作区外路径 ../outside/generated，前置治理已阻断。',
      reasonCode: 'tool_checker_deny',
      details: { path: '../outside/generated' }
    });
  });

  it('checks only mutating http methods and ignores generic mcp tools', () => {
    const checker = new HttpMethodPermissionChecker();

    expect(checker.supports({ name: 'http_request', family: 'network' } as any)).toBe(true);
    expect(checker.supports({ name: 'mcp_call', family: 'mcp' } as any)).toBe(true);
    expect(checker.check({ name: 'mcp_call', family: 'mcp' } as any, { method: 'POST' } as any)).toBeUndefined();
    expect(checker.check({ name: 'http_request', family: 'network' } as any, { method: 'GET' } as any)).toBeUndefined();
    expect(
      checker.check({ name: 'http_request', family: 'network' } as any, { method: 'delete', url: '/v1' } as any)
    ).toEqual({
      decision: 'ask',
      reason: 'DELETE 外部写请求需要进入审批链。',
      reasonCode: 'tool_checker_ask',
      details: { method: 'DELETE', url: '/v1' }
    });
  });

  it('merges governance decisions by deny > ask > allow priority', () => {
    expect(mergeGovernanceDecisions(undefined, undefined)).toBeUndefined();
    expect(
      mergeGovernanceDecisions(
        { decision: 'allow', reason: 'safe', reasonCode: 'a' } as any,
        { decision: 'ask', reason: 'confirm', reasonCode: 'b' } as any,
        { decision: 'deny', reason: 'blocked', reasonCode: 'c' } as any
      )
    ).toEqual({
      decision: 'deny',
      reason: 'blocked',
      reasonCode: 'c'
    });
  });
});
