import { CreateTaskDto, QueueStateRecord, ToolUsageSummaryRecord, CapabilityOwnerType } from '@agent/core';

import { buildInitialCapabilityState } from '../../../../capabilities/capability-pool';
import { initializeTaskExecutionSteps } from '../../../../bridges/supervisor-runtime-bridge';
import type { MainGraphTaskAggregate as TaskRecord } from '../main-graph-task.types';
import type { SubgraphIdValue as SubgraphId } from '../task-architecture-helpers';
import { resolveCounselorSelection, resolveRequestedMode } from './task-entry-decision';
import { buildExecutionPlan, deriveOrchestrationGovernance } from './task-execution-plan';
import type {
  KnowledgeReuseResult,
  LocalSkillSuggestionResolver,
  PreExecutionSkillInterventionResolver,
  RuntimeSettings
} from './task-factory.types';
import { buildTaskRecord } from './task-record-builder';
import { applyLocalSkillSuggestions } from './task-skill-intervention';
import { resolveTaskWorkflowResolution } from './task-workflow-resolution';

export class MainGraphTaskFactory {
  constructor(
    private readonly settings: RuntimeSettings,
    private readonly createQueueState: (sessionId: string | undefined, now: string) => QueueStateRecord,
    private readonly addTrace: (
      task: TaskRecord,
      node: string,
      summary: string,
      data?: Record<string, unknown>
    ) => void,
    private readonly addProgressDelta: (task: TaskRecord, content: string) => void,
    private readonly markSubgraph: (task: TaskRecord, subgraphId: SubgraphId) => void,
    private readonly attachTool: (
      task: TaskRecord,
      params: {
        toolName: string;
        attachedBy: 'bootstrap' | 'user' | 'runtime' | 'workflow' | 'specialist';
        preferred?: boolean;
        reason?: string;
        ownerType?: CapabilityOwnerType;
        ownerId?: string;
        family?: string;
      }
    ) => void,
    private readonly recordToolUsage: (
      task: TaskRecord,
      params: {
        toolName: string;
        status: ToolUsageSummaryRecord['status'];
        requestedBy?: string;
        reason?: string;
        blockedReason?: string;
        serverId?: string;
        capabilityId?: string;
        approvalRequired?: boolean;
        riskLevel?: ToolUsageSummaryRecord['riskLevel'];
        route?: ToolUsageSummaryRecord['route'];
        family?: string;
        capabilityType?: ToolUsageSummaryRecord['capabilityType'];
      }
    ) => void
  ) {}

  async createTaskRecord(
    dto: CreateTaskDto,
    knowledgeReuse: KnowledgeReuseResult,
    resolveLocalSkillSuggestions?: LocalSkillSuggestionResolver,
    resolvePreExecutionSkillIntervention?: PreExecutionSkillInterventionResolver,
    identity?: {
      now: string;
      taskId: string;
      runId: string;
    },
    options?: {
      deferPreExecutionSkillIntervention?: boolean;
    }
  ): Promise<{
    task: TaskRecord;
    normalizedGoal: string;
  }> {
    const now = identity?.now ?? new Date().toISOString();
    const taskId = identity?.taskId ?? `task_${Date.now()}`;
    const runId = identity?.runId ?? `run_${Date.now()}`;
    const sessionId = (dto as CreateTaskDto & { sessionId?: string }).sessionId;
    const requestedMode = resolveRequestedMode(dto);
    const { workflowResolution, dataReportContract, enrichedTaskContext, specialistRoute } =
      resolveTaskWorkflowResolution({
        dto,
        evidence: knowledgeReuse.evidence,
        requestedMode
      });
    const counselorSelection = resolveCounselorSelection(dto, {
      specialistDomain: specialistRoute.specialistLead.domain,
      preferredCounselorIds: specialistRoute.specialistLead.candidateAgentIds?.length
        ? specialistRoute.specialistLead.candidateAgentIds
        : specialistRoute.specialistLead.agentId
          ? [specialistRoute.specialistLead.agentId]
          : undefined,
      normalizedGoal: workflowResolution.normalizedGoal,
      sessionId
    });
    const capabilityState = buildInitialCapabilityState({
      now,
      workflow: workflowResolution.preset,
      specialistLead: specialistRoute.specialistLead,
      requestedHints: dto.requestedHints,
      seedCapabilityAttachments: dto.capabilityAttachments,
      seedCapabilityAugmentations: dto.capabilityAugmentations
    });
    const orchestrationGovernance = deriveOrchestrationGovernance({
      capabilityAttachments: capabilityState.capabilityAttachments,
      specialistLead: specialistRoute.specialistLead,
      routeConfidence: specialistRoute.routeConfidence
    });
    const executionPlan = buildExecutionPlan(
      requestedMode,
      this.settings.policy?.budget,
      counselorSelection,
      orchestrationGovernance
    );
    const { initialChatRoute } = resolveTaskWorkflowResolution({
      dto,
      evidence: knowledgeReuse.evidence,
      requestedMode,
      capabilityAttachments: capabilityState.capabilityAttachments
    });
    // entryDecision persists the 通政司 / EntryRouter intake selection for compatibility readers.
    const entryDecision = {
      requestedMode,
      counselorSelector: counselorSelection.selector,
      selectionReason: counselorSelection.selectionReason,
      defaultCounselorId: counselorSelection.defaultCounselorId,
      imperialDirectIntent: dto.imperialDirectIntent
    };

    const { task, traceId } = buildTaskRecord({
      dto,
      settings: this.settings,
      now,
      taskId,
      runId,
      createQueueState: this.createQueueState,
      requestedMode,
      workflowResolution,
      enrichedTaskContext,
      specialistRoute,
      orchestrationGovernance,
      executionPlan,
      initialChatRoute,
      entryDecision,
      capabilityState,
      knowledgeReuse
    });

    if (resolveLocalSkillSuggestions && workflowResolution.preset.id !== 'scaffold') {
      await applyLocalSkillSuggestions({
        task,
        taskId,
        runId,
        now,
        normalizedGoal: workflowResolution.normalizedGoal,
        requestedHints: dto.requestedHints,
        specialistDomain: specialistRoute.specialistLead.domain,
        resolveLocalSkillSuggestions,
        resolvePreExecutionSkillIntervention,
        deferPreExecutionSkillIntervention: options?.deferPreExecutionSkillIntervention ?? false,
        callbacks: {
          addTrace: this.addTrace,
          addProgressDelta: this.addProgressDelta,
          markSubgraph: this.markSubgraph,
          attachTool: this.attachTool,
          recordToolUsage: this.recordToolUsage
        }
      });
    }

    this.addTrace(task, 'decree_received', `已接收圣旨：${workflowResolution.normalizedGoal}`, {
      runId: task.runId,
      traceId,
      executionMode: executionPlan.mode
    });
    this.addTrace(task, 'entry_router', `通政司已判定本轮入口模式为 ${executionPlan.mode}。`, {
      requestedMode,
      counselorSelector: entryDecision.counselorSelector,
      selectionReason: entryDecision.selectionReason,
      selectedCounselorId: executionPlan.selectedCounselorId,
      selectedVersion: executionPlan.selectedVersion,
      imperialDirectIntent: entryDecision.imperialDirectIntent
    });
    this.addProgressDelta(task, '收到你的任务，首辅正在拆解目标并准备调度六部。');
    this.addTrace(
      task,
      'specialist_routed',
      `本轮由${specialistRoute.specialistLead.displayName}主导，并发征询 ${specialistRoute.supportingSpecialists.length} 个支撑专家。`,
      {
        traceId,
        specialistLead: specialistRoute.specialistLead,
        supportingSpecialists: specialistRoute.supportingSpecialists,
        routeConfidence: orchestrationGovernance.adjustedRouteConfidence,
        governanceEscalated: orchestrationGovernance.requiresGovernanceEscalation
      }
    );
    this.addTrace(task, 'skill_resolved', `已解析流程模板：${workflowResolution.preset.displayName}`, {
      skillId: workflowResolution.preset.id,
      command: workflowResolution.command,
      source: workflowResolution.source,
      requiredMinistries: workflowResolution.preset.requiredMinistries,
      allowedCapabilities: workflowResolution.preset.allowedCapabilities,
      executionPlan
    });
    this.markSubgraph(task, 'skill-install');
    this.addProgressDelta(task, `本轮已切换到 ${workflowResolution.preset.displayName} 流程。`);
    if (dataReportContract) {
      this.addTrace(task, 'data_report_contract', '已为数据报表任务注入模板契约与结构提示。', {
        scope: dataReportContract.scope,
        templateRef: dataReportContract.templateRef,
        templatePathHint: dataReportContract.templatePathHint,
        componentPattern: dataReportContract.componentPattern
      });
      this.addProgressDelta(
        task,
        dataReportContract.scope === 'multiple'
          ? '已按“多个数据报表”模式装载模板契约，后续会优先拆共享骨架和多模块结构。'
          : dataReportContract.scope === 'shell-first'
            ? '已按“先搭报表骨架”模式装载模板契约，后续会优先生成容器、搜索区和切换结构。'
            : '已按“单个数据报表”模式装载模板契约，后续会先完成一个可扩展的报表模块。'
      );
    }

    if (knowledgeReuse.reusedMemoryIds.length > 0 || knowledgeReuse.reusedRuleIds.length > 0) {
      const autoPersistedCount = knowledgeReuse.memories.filter(memory => memory.tags.includes('auto-persist')).length;
      const researchMemoryCount = knowledgeReuse.memories.filter(memory => memory.tags.includes('research-job')).length;
      this.addTrace(
        task,
        'research',
        `首辅已优先命中 ${knowledgeReuse.reusedMemoryIds.length} 条历史记忆与 ${knowledgeReuse.reusedRuleIds.length} 条历史规则，本轮将优先复用已有经验。`,
        {
          reusedMemoryIds: knowledgeReuse.reusedMemoryIds,
          reusedRuleIds: knowledgeReuse.reusedRuleIds,
          autoPersistedCount,
          researchMemoryCount
        }
      );
      this.addProgressDelta(
        task,
        `首辅先从历史经验中命中了 ${knowledgeReuse.reusedMemoryIds.length} 条记忆和 ${knowledgeReuse.reusedRuleIds.length} 条规则，本轮会优先基于这些经验继续规划。`
      );
    }

    initializeTaskExecutionSteps(task);
    return {
      task,
      normalizedGoal: workflowResolution.normalizedGoal
    };
  }
}
