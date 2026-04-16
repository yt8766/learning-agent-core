import { Space, Tag, Typography } from 'antd';

import type { useChatSession } from '@/hooks/use-chat-session';
import { ChatMemoryChips } from './chat-memory-chips';
import { ChatMemoryFeedbackStrip } from './chat-memory-feedback-strip';
import { getChatRouteFlowLabel, getChatRouteTone, getMinistryLabel, getMinistryTone } from './chat-home-helpers';

const { Text, Title } = Typography;

export function SessionMissionControl({ chat }: { chat: ReturnType<typeof useChatSession> }) {
  const checkpoint = chat.checkpoint;
  const routeFlow = checkpoint?.chatRoute?.flow;
  const evidenceCount = checkpoint?.externalSources?.length ?? 0;
  const reuseCount =
    (checkpoint?.reusedMemories?.length ?? 0) +
    (checkpoint?.reusedRules?.length ?? 0) +
    (checkpoint?.reusedSkills?.length ?? 0);
  const activeAgents = (checkpoint?.agentStates ?? []).filter(
    item =>
      item.status === 'running' ||
      item.status === 'queued' ||
      item.status === 'waiting_approval' ||
      item.status === 'waiting_interrupt'
  );
  const currentSkillExecution = checkpoint?.currentSkillExecution;
  const memoryEvidence = (checkpoint?.externalSources ?? []).filter(
    source => source.sourceType === 'memory_reuse' || source.sourceType === 'rule_reuse'
  );
  const reflectionEvidence = memoryEvidence.filter(source => source.summary.includes('历史反思'));

  return (
    <section className="chatx-mission-control">
      <div className="chatx-mission-control__header">
        <div>
          <Text className="chatx-mission-control__eyebrow">会话内协作态</Text>
          <Title level={5}>{checkpoint?.resolvedWorkflow?.displayName ?? '当前会话'}</Title>
          <Text type="secondary">
            {routeFlow === 'direct-reply'
              ? '当前更偏快速问答，系统会在需要时补充思考与证据。'
              : '当前进入自治执行链，首辅会持续调度相关部委完成本轮任务。'}
          </Text>
        </div>
        <Space wrap size={[8, 8]}>
          <Tag color={getChatRouteTone(routeFlow)}>{getChatRouteFlowLabel(routeFlow)}</Tag>
          {checkpoint?.currentMinistry ? (
            <Tag color={getMinistryTone(checkpoint.currentMinistry)}>
              {getMinistryLabel(checkpoint.currentMinistry)}
            </Tag>
          ) : null}
          {checkpoint?.graphState?.currentStep ? <Tag>{checkpoint.graphState.currentStep}</Tag> : null}
          {currentSkillExecution ? (
            <Tag color="magenta">
              {currentSkillExecution.displayName} · {currentSkillExecution.stepIndex}/{currentSkillExecution.totalSteps}
            </Tag>
          ) : null}
        </Space>
      </div>

      <div className="chatx-mission-control__grid">
        <article className="chatx-mission-card">
          <Text className="chatx-mission-card__label">当前主任务</Text>
          <Title level={5}>{checkpoint?.taskId ?? '等待首条任务'}</Title>
          <Text type="secondary">
            {checkpoint?.currentWorker ? `当前执行角色：${checkpoint.currentWorker}` : '等待首辅确认当前执行角色。'}
          </Text>
          {currentSkillExecution ? (
            <div className="chatx-mission-card__meta">
              <Tag color="magenta">
                {currentSkillExecution.phase === 'research' ? 'Skill Research' : 'Skill Execute'}
              </Tag>
              <Tag>
                {currentSkillExecution.stepIndex}/{currentSkillExecution.totalSteps}
              </Tag>
              <Tag>{currentSkillExecution.title}</Tag>
            </div>
          ) : null}
          {currentSkillExecution ? <Text type="secondary">{currentSkillExecution.instruction}</Text> : null}
        </article>

        <article className="chatx-mission-card">
          <Text className="chatx-mission-card__label">并行协作</Text>
          <Title level={5}>{activeAgents.length ? `${activeAgents.length} 个角色活跃` : '当前 1 条主链执行'}</Title>
          <div className="chatx-mission-card__meta">
            {activeAgents.length ? (
              activeAgents.slice(0, 4).map(agent => <Tag key={`${agent.role}:${agent.status}`}>{agent.role}</Tag>)
            ) : (
              <Tag>聚焦当前回合</Tag>
            )}
          </div>
        </article>

        <article className="chatx-mission-card">
          <Text className="chatx-mission-card__label">记忆与证据</Text>
          <Title level={5}>
            {reuseCount} 项复用 · {evidenceCount} 条来源
          </Title>
          <Text type="secondary">
            {reflectionEvidence.length
              ? `本轮已注入 ${reflectionEvidence.length} 条历史反思，用于规避重复失败。`
              : '当前展示的是本轮真正被采用的记忆与规则，而不是后台全部存量。'}
          </Text>
          <ChatMemoryChips
            sources={memoryEvidence}
            reusedMemories={checkpoint?.reusedMemories}
            reusedRules={checkpoint?.reusedRules}
            reusedSkills={checkpoint?.reusedSkills}
          />
          <ChatMemoryFeedbackStrip
            sources={memoryEvidence}
            onUpdated={async () => {
              await chat.refreshSessionDetail();
            }}
          />
        </article>

        <article className="chatx-mission-card">
          <Text className="chatx-mission-card__label">待处理动作</Text>
          <Title level={5}>
            {chat.pendingApprovals.length ? `${chat.pendingApprovals.length} 个待确认` : '当前无审批阻塞'}
          </Title>
          <Text type="secondary">
            {chat.pendingApprovals.length
              ? '审批卡会以内联消息形式出现在主线程中。'
              : '本轮没有需要人工确认的高风险动作。'}
          </Text>
        </article>
      </div>
    </section>
  );
}
