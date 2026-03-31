import { describe, expect, it } from 'vitest';

import {
  buildCheckpointRef,
  buildInstalledSkillTags,
  buildRuleCandidates,
  defaultConnectorSessionState,
  groupConnectorDiscoveryHistory,
  groupGovernanceAuditByTarget
} from '../../../src/runtime/helpers/runtime-derived-records';

describe('runtime-derived-records', () => {
  it('会从重复 agent 错误生成 rule candidates', () => {
    const candidates = buildRuleCandidates([
      {
        id: 'task-1',
        goal: '修复安装失败',
        currentMinistry: 'bingbu-ops',
        currentWorker: 'bingbu-worker',
        updatedAt: '2026-03-27T09:10:00.000Z',
        externalSources: [{ id: 'diag-1', sourceType: 'diagnosis_result' }],
        trace: [
          {
            node: 'agent_error',
            data: {
              errorCode: 'tool_execution_error',
              ministry: 'bingbu-ops',
              toolName: 'run_terminal',
              retryable: true
            }
          }
        ]
      } as any,
      {
        id: 'task-2',
        goal: '再次修复安装失败',
        currentMinistry: 'bingbu-ops',
        currentWorker: 'bingbu-worker',
        updatedAt: '2026-03-27T09:20:00.000Z',
        externalSources: [{ id: 'diag-2', sourceType: 'diagnosis_result' }],
        trace: [
          {
            node: 'agent_error',
            data: {
              errorCode: 'tool_execution_error',
              ministry: 'bingbu-ops',
              toolName: 'run_terminal',
              retryable: true
            }
          }
        ]
      } as any
    ]);

    expect(candidates).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'rule', taskId: 'task-2' })]));
  });

  it('会构建 checkpointRef 和聚合治理历史', () => {
    const ref = buildCheckpointRef(
      {
        getCheckpoint: () =>
          ({ taskId: 'task-1', checkpointId: 'checkpoint-1', traceCursor: 3, recoverability: 'partial' }) as any
      } as any,
      'session-1'
    );

    expect(ref).toEqual(expect.objectContaining({ sessionId: 'session-1', checkpointId: 'checkpoint-1' }));
    expect(defaultConnectorSessionState('stdio')).toBe('disconnected');
    expect(
      groupConnectorDiscoveryHistory([
        { connectorId: 'github', discoveredAt: '2026-03-27T10:00:00.000Z' } as any,
        { connectorId: 'github', discoveredAt: '2026-03-27T09:00:00.000Z' } as any
      ]).get('github')
    ).toHaveLength(2);
    expect(
      groupGovernanceAuditByTarget([
        { scope: 'connector', targetId: 'github' } as any,
        { scope: 'skill-install', targetId: 'skill-1' } as any
      ]).get('github')
    ).toHaveLength(1);
  });

  it('会为已安装技能生成稳定标签', () => {
    const tags = buildInstalledSkillTags({
      name: 'Repo Review Assistant',
      applicableGoals: ['review pull requests', 'summarize repository changes']
    } as any);

    expect(tags).toEqual(expect.arrayContaining(['repo', 'review', 'pull', 'requests']));
  });
});
