import { describe, expect, it } from 'vitest';

import {
  CHAT_ROLE_CONFIG,
  EVENT_LABELS,
  getAgentLabel,
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
    expect(buildEventSummary({ type: 'status', payload: { summary: 'workflow' } })).toBe('处理流程');
    expect(buildEventSummary({ type: 'status', payload: { reason: 'route reason' } })).toBe('处理依据');
    expect(buildEventSummary({ type: 'status', payload: { error: 'standard' } })).toBe('执行模式');
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
    expect(getConversationTimeGroup(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())).toBe('7 天内');
    expect(getConversationTimeGroup(new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString())).toBe('30 天内');
    expect(getConversationTimeGroup('2025-01-01T00:00:00.000Z')).toBe('2025-01');
    expect(getConversationTimeGroup()).toBe('更早');
    expect(getStatusPill('waiting_learning_confirmation')).toBe('待确认入库');
    expect(getStatusPill()).toBe('未开始');
    expect(matchesFilter('waiting_interrupt', 'approval')).toBe(true);
    expect(matchesFilter('completed', 'running')).toBe(false);
    expect(getRunningHint('running', 'review')).toBe('正在执行：review');
    expect(getRunningHint('running')).toBe('正在生成响应...');
    expect(getRunningHint('waiting_approval')).toContain('等待审批');
    expect(getRunningHint('waiting_learning_confirmation')).toContain('等待确认');
    expect(getRunningHint()).toBe('');
    expect(getCompressionHint({ compression: { condensedMessageCount: 6 } })).toContain('已折叠 6 条消息');
    expect(getCompressionHint()).toBe('');
  });

  it('maps workflow, route, risk and error presentation labels', () => {
    expect(getAgentLabel('ai')).toBeTruthy();
    expect(getAgentLabel('custom-role')).toBe('custom-role');
    expect(getAgentLabel()).toBe('');
    expect(getExecutionModeLabel('plan')).toBeTruthy();
    expect(getMinistryLabel('gongbu')).toBeTruthy();
    expect(getMinistryLabel()).toBe('未分派');
    expect(getWorkflowSummary(['gongbu', 'xingbu'])).toContain('->');
    expect(getWorkflowSummary()).toBe('将按通用协作流程继续执行。');
    expect(getChatRouteFlowLabel('approval')).toBe('Approval Recovery');
    expect(getChatRouteFlowLabel('direct-reply')).toBe('Direct Reply');
    expect(getChatRouteFlowLabel('supervisor')).toBe('Supervisor Workflow');
    expect(getChatRouteFlowLabel('learning')).toBe('Learning Flow');
    expect(getChatRouteFlowLabel()).toBe('未决策');
    expect(getChatRouteTone('learning')).toBe('gold');
    expect(getChatRouteTone('direct-reply')).toBe('blue');
    expect(getChatRouteTone('supervisor')).toBe('purple');
    expect(getChatRouteTone('approval')).toBe('orange');
    expect(getChatRouteTone()).toBe('default');
    expect(getRiskColor('medium')).toBe('orange');
    expect(getRiskColor('high')).toBe('red');
    expect(getRiskColor('low')).toBe('blue');
    expect(getRiskColor()).toBe('default');
    expect(getMinistryTone('xingbu')).toBe('red');
    expect(getMinistryTone('libu')).toBe('blue');
    expect(getMinistryTone('hubu')).toBe('cyan');
    expect(getMinistryTone('libu_docs')).toBe('gold');
    expect(getMinistryTone('bingbu')).toBe('volcano');
    expect(getMinistryTone('gongbu')).toBe('green');
    expect(getMinistryTone()).toBe('default');
    expect(getErrorCopy('Network Error')).toEqual(
      expect.objectContaining({
        title: '后端连接失败'
      })
    );
    expect(getErrorCopy('自定义错误')).toEqual({
      title: '运行提示',
      description: '自定义错误'
    });
    expect(EVENT_LABELS).toBeTruthy();
    expect(CHAT_ROLE_CONFIG.ai.placement).toBe('start');
    expect(CHAT_ROLE_CONFIG.user.placement).toBe('end');
    expect(CHAT_ROLE_CONFIG.system.variant).toBe('outlined');
  });

  it('falls back to session title and think state when messages are unavailable', () => {
    expect(
      buildProjectContextSnapshot({
        activeSession: { title: '默认任务' },
        messages: [],
        pendingApprovals: [],
        checkpoint: {
          thinkState: { content: 'planning_readonly_guard' }
        }
      })
    ).toEqual(
      expect.objectContaining({
        objective: '默认任务',
        latestOutcome: '计划只读保护'
      })
    );
  });
});
