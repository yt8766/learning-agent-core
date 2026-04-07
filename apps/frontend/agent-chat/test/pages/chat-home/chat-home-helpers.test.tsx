import { describe, expect, it } from 'vitest';

import {
  buildEventSummary,
  buildProjectContextSnapshot,
  getChatRouteFlowLabel,
  getChatRouteTone,
  getCompressionHint,
  getConversationGroup,
  getConversationTimeGroup,
  getErrorCopy,
  getExecutionModeLabel,
  getMinistryLabel,
  getMinistryTone,
  getRiskColor,
  getRunningHint,
  getSessionBadgeStatus,
  getStatusPill,
  getWorkflowSummary,
  humanizeOperationalCopy,
  matchesFilter
} from '@/pages/chat-home/chat-home-helpers';

describe('chat-home helpers', () => {
  it('humanizes operational copy and event summaries', () => {
    expect(humanizeOperationalCopy('supervisor workflow route reason')).toBe('协同处理 处理依据');
    expect(buildEventSummary({ type: 'status', payload: { content: 'direct_reply' } })).toBe('直接回复');
    expect(buildEventSummary({ type: 'status', payload: { candidates: ['a', 'b'] } })).toBe('生成 2 个学习候选');
    expect(buildEventSummary({ type: 'status', payload: {} })).toBe('事件已记录');
  });

  it('builds project context snapshots from latest user and assistant messages', () => {
    expect(
      buildProjectContextSnapshot({
        activeSession: { title: '默认任务' },
        messages: [
          { role: 'user', content: '  检查 runtime 覆盖率  ' },
          { role: 'assistant', content: 'supervisor workflow 当前仍由首辅统一协调全局' }
        ],
        pendingApprovals: [{ id: 'approval-1' }],
        checkpoint: {
          externalSources: [{ id: 'source-1' }],
          connectorRefs: ['github'],
          usedInstalledSkills: ['coverage'],
          currentWorker: 'gongbu-code',
          currentMinistry: 'gongbu',
          thinkState: { content: '备用结论' }
        }
      })
    ).toEqual(
      expect.objectContaining({
        objective: '检查 runtime 覆盖率',
        latestOutcome: '协同处理 正在统筹这轮处理并准备回复。',
        evidenceCount: 1,
        approvalCount: 1,
        connectorCount: 1,
        skillCount: 1,
        currentWorker: 'gongbu-code',
        currentMinistry: 'gongbu'
      })
    );
  });

  it('returns status, timing, filter and hint labels', () => {
    expect(getSessionBadgeStatus('completed')).toBe('success');
    expect(getSessionBadgeStatus('waiting_interrupt')).toBe('warning');
    expect(getConversationGroup('failed')).toBe('失败');
    expect(getConversationTimeGroup(new Date().toISOString())).toBe('今天');
    expect(getStatusPill('waiting_learning_confirmation')).toBe('待确认入库');
    expect(matchesFilter('waiting_interrupt', 'approval')).toBe(true);
    expect(matchesFilter('completed', 'running')).toBe(false);
    expect(getRunningHint('running', 'review')).toBe('正在执行：review');
    expect(getRunningHint('waiting_approval')).toContain('等待审批');
    expect(getCompressionHint({ compression: { condensedMessageCount: 6 } })).toContain('已折叠 6 条消息');
  });

  it('maps workflow, route, risk and error presentation labels', () => {
    expect(getExecutionModeLabel('plan')).toBeTruthy();
    expect(getMinistryLabel('gongbu')).toBeTruthy();
    expect(getWorkflowSummary(['gongbu', 'xingbu'])).toContain('->');
    expect(getWorkflowSummary()).toBe('将按通用协作流程继续执行。');
    expect(getChatRouteFlowLabel('approval')).toBe('Approval Recovery');
    expect(getChatRouteTone('learning')).toBe('gold');
    expect(getRiskColor('medium')).toBe('orange');
    expect(getMinistryTone('xingbu')).toBe('red');
    expect(getErrorCopy('Network Error')).toEqual(
      expect.objectContaining({
        title: '后端连接失败'
      })
    );
    expect(getErrorCopy('自定义错误')).toEqual({
      title: '运行提示',
      description: '自定义错误'
    });
  });
});
