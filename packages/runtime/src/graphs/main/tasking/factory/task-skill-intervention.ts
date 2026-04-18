import { ActionIntent, TaskStatus } from '@agent/core';
import type { EvidenceRecord } from '@agent/core';

import { mergeCapabilityStateFromSkillSearch } from '../../../../capabilities/capability-pool';
import {
  extendInterruptWithRiskMetadata,
  extendPendingApprovalWithRiskMetadata
} from '../../../../flows/approval/risk-interrupts';
import type {
  LocalSkillSuggestionResolver,
  PreExecutionSkillInterventionResolver,
  TaskFactoryRuntimeCallbacks
} from './task-factory.types';
import type { MainGraphTaskAggregate as TaskRecord } from '../main-graph-task.types';

export async function applyLocalSkillSuggestions(params: {
  task: TaskRecord;
  taskId: string;
  runId: string;
  now: string;
  normalizedGoal: string;
  requestedHints: TaskRecord['requestedHints'];
  specialistDomain: TaskRecord['specialistLead'] extends infer T ? (T extends { domain: infer D } ? D : never) : never;
  resolveLocalSkillSuggestions: LocalSkillSuggestionResolver;
  resolvePreExecutionSkillIntervention?: PreExecutionSkillInterventionResolver;
  deferPreExecutionSkillIntervention?: boolean;
  callbacks: TaskFactoryRuntimeCallbacks;
}) {
  const skillSearch = await params.resolveLocalSkillSuggestions({
    goal: params.normalizedGoal,
    usedInstalledSkills: params.task.usedInstalledSkills,
    requestedHints: params.requestedHints,
    specialistDomain: params.specialistDomain
  });
  params.task.skillSearch = skillSearch;
  Object.assign(params.task, mergeCapabilityStateFromSkillSearch(params.task, params.now, skillSearch));
  if (skillSearch.suggestions.length > 0) {
    params.task.externalSources = [
      ...(params.task.externalSources ?? []),
      ...skillSearch.suggestions.slice(0, 5).map(
        (suggestion, index): EvidenceRecord => ({
          id: `skill_search_${params.taskId}_${index + 1}`,
          taskId: params.taskId,
          sourceId: suggestion.sourceId,
          sourceType: 'skill_search',
          trustClass: suggestion.availability === 'blocked' ? 'community' : 'internal',
          summary: `本地技能候选：${suggestion.displayName}（${suggestion.availability}）`,
          detail: {
            kind: suggestion.kind,
            suggestionId: suggestion.id,
            availability: suggestion.availability,
            requiredCapabilities: suggestion.requiredCapabilities,
            requiredConnectors: suggestion.requiredConnectors,
            score: suggestion.score,
            reason: suggestion.reason
          },
          linkedRunId: params.runId,
          createdAt: params.now
        })
      )
    ];
  }

  if (params.resolvePreExecutionSkillIntervention && !params.deferPreExecutionSkillIntervention) {
    const intervention = await params.resolvePreExecutionSkillIntervention({
      goal: params.normalizedGoal,
      taskId: params.taskId,
      runId: params.runId,
      sessionId: params.task.sessionId,
      skillSearch,
      usedInstalledSkills: params.task.usedInstalledSkills
    });
    if (intervention?.skillSearch) {
      params.task.skillSearch = intervention.skillSearch;
    }
    if (intervention?.usedInstalledSkills?.length) {
      params.task.usedInstalledSkills = Array.from(
        new Set([...(params.task.usedInstalledSkills ?? []), ...intervention.usedInstalledSkills])
      );
    }
    if (intervention?.traceSummary) {
      params.callbacks.addTrace(params.task, 'skill_runtime_intervention', intervention.traceSummary, {
        usedInstalledSkills: intervention.usedInstalledSkills
      });
    }
    if (intervention?.progressSummary) {
      params.callbacks.addProgressDelta(params.task, intervention.progressSummary);
    }
    if (intervention?.pendingApproval && intervention.pendingExecution) {
      const interruptId = `interrupt_${params.taskId}_skill_install`;
      params.task.status = TaskStatus.WAITING_APPROVAL;
      params.task.currentNode = 'approval_gate';
      params.task.currentStep = 'waiting_skill_install_approval';
      if (params.task.queueState) {
        params.task.queueState.status = 'waiting_approval';
        params.task.queueState.startedAt ??= params.now;
        params.task.queueState.lastTransitionAt = params.now;
      }
      params.task.pendingApproval = extendPendingApprovalWithRiskMetadata(
        {
          toolName: intervention.pendingApproval.toolName,
          intent: ActionIntent.INSTALL_SKILL,
          riskLevel: 'medium',
          requestedBy: 'libu-governance',
          reason: intervention.pendingApproval.reason,
          reasonCode: 'requires_approval_governance',
          preview: intervention.pendingApproval.preview
        },
        { requestedBy: 'libu-governance', approvalScope: 'once' }
      );
      params.task.activeInterrupt = extendInterruptWithRiskMetadata(
        {
          id: interruptId,
          status: 'pending',
          mode: 'blocking',
          source: 'graph',
          origin: 'runtime',
          kind: 'skill-install',
          interactionKind: 'approval',
          intent: ActionIntent.INSTALL_SKILL,
          toolName: intervention.pendingApproval.toolName,
          family: 'runtime-governance',
          capabilityType: 'governance-tool',
          requestedBy: 'libu-governance',
          ownerType: 'ministry-owned',
          ownerId: 'libu-governance',
          reason: intervention.pendingApproval.reason,
          blockedReason: intervention.pendingApproval.reason,
          riskLevel: 'medium',
          resumeStrategy: 'approval-recovery',
          timeoutMinutes: 30,
          timeoutPolicy: 'reject',
          preview: intervention.pendingApproval.preview,
          payload: {
            receiptId: intervention.pendingExecution.receiptId,
            skillDisplayName: intervention.pendingExecution.skillDisplayName
          },
          createdAt: params.now
        },
        { approvalScope: 'once' }
      );
      if (params.task.activeInterrupt) {
        params.task.interruptHistory = [...(params.task.interruptHistory ?? []), params.task.activeInterrupt];
      }
      params.callbacks.attachTool(params.task, {
        toolName: intervention.pendingApproval.toolName,
        attachedBy: 'runtime',
        preferred: true,
        reason: intervention.pendingApproval.reason,
        ownerType: 'ministry-owned',
        ownerId: 'libu-governance',
        family: 'runtime-governance'
      });
      params.callbacks.recordToolUsage(params.task, {
        toolName: intervention.pendingApproval.toolName,
        status: 'blocked',
        requestedBy: 'libu-governance',
        reason: intervention.pendingApproval.reason,
        blockedReason: intervention.pendingApproval.reason,
        approvalRequired: true,
        route: 'governance',
        family: 'runtime-governance',
        capabilityType: 'governance-tool',
        riskLevel: 'medium'
      });
      params.task.approvals.push({
        taskId: params.taskId,
        intent: ActionIntent.INSTALL_SKILL,
        reason: intervention.pendingApproval.reason,
        actor: 'runtime-auto-pre-execution',
        decision: 'pending',
        decidedAt: params.now
      });
      params.callbacks.addTrace(
        params.task,
        'approval_gate',
        intervention.pendingApproval.reason ?? '检测到远程 skill 安装需要审批。',
        {
          receiptId: intervention.pendingExecution.receiptId,
          skillDisplayName: intervention.pendingExecution.skillDisplayName,
          intent: ActionIntent.INSTALL_SKILL
        }
      );
      params.callbacks.addProgressDelta(
        params.task,
        `当前轮需要先确认安装 ${intervention.pendingExecution.skillDisplayName ?? '远程 skill'}。`
      );
      Object.assign(params.task, mergeCapabilityStateFromSkillSearch(params.task, params.now, params.task.skillSearch));
      return;
    }
  }

  const activeSkillSearch = params.task.skillSearch ?? skillSearch;
  Object.assign(params.task, mergeCapabilityStateFromSkillSearch(params.task, params.now, activeSkillSearch));

  if (activeSkillSearch.capabilityGapDetected && activeSkillSearch.suggestions.length > 0) {
    params.callbacks.addTrace(
      params.task,
      'research',
      `检测到能力缺口，已在本地技能库中找到 ${activeSkillSearch.suggestions.length} 个候选。`,
      {
        skillSearchStatus: activeSkillSearch.status,
        suggestionIds: activeSkillSearch.suggestions.map(item => item.id),
        availability: activeSkillSearch.suggestions.map(item => `${item.id}:${item.availability}`)
      }
    );
    params.callbacks.addProgressDelta(
      params.task,
      `首辅已识别出能力缺口，并在本地技能库中找到 ${activeSkillSearch.suggestions.length} 个候选。`
    );
    return;
  }
  if (activeSkillSearch.suggestions.length > 0) {
    params.callbacks.addTrace(
      params.task,
      'research',
      `本地技能库已命中 ${activeSkillSearch.suggestions.length} 个可直接参考的候选。`,
      {
        skillSearchStatus: activeSkillSearch.status,
        suggestionIds: activeSkillSearch.suggestions.map(item => item.id),
        availability: activeSkillSearch.suggestions.map(item => `${item.id}:${item.availability}`)
      }
    );
    params.callbacks.addProgressDelta(
      params.task,
      `首辅已在本地技能库中命中 ${activeSkillSearch.suggestions.length} 个可复用候选。`
    );
  }
}
