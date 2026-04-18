import { loadSettings } from '@agent/config';
import {
  ActionIntent,
  CreateDocumentLearningJobDto,
  CreateResearchLearningJobDto,
  EvidenceRecord,
  SkillCard
} from '@agent/core';
import { SkillRegistry } from '@agent/skill-runtime';
import { McpClientManager } from '@agent/tools';

import { LearningFlow } from '../../../flows/learning';
import { buildResearchSourcePlan, resolveWorkflowPreset } from '../../../bridges/supervisor-runtime-bridge';
import type { RuntimeLearningJob as LearningJob } from '../../../runtime/runtime-learning.types';

type RuntimeSettings = ReturnType<typeof loadSettings>;

export class MainGraphLearningJobsRuntime {
  constructor(
    private readonly settings: RuntimeSettings,
    private readonly learningJobs: Map<string, LearningJob>,
    private readonly learningFlow: LearningFlow,
    private readonly skillRegistry: SkillRegistry,
    private readonly mcpClientManager: McpClientManager | undefined,
    private readonly buildSkillDraft: (goal: string, source: 'execution' | 'document') => SkillCard,
    private readonly persistRuntimeState: () => Promise<void>
  ) {}

  getLearningJob(jobId: string): LearningJob | undefined {
    return this.learningJobs.get(jobId);
  }

  listLearningJobs(): LearningJob[] {
    return [...this.learningJobs.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async createDocumentLearningJob(dto: CreateDocumentLearningJobDto): Promise<LearningJob> {
    const now = new Date().toISOString();
    const job: LearningJob = {
      id: `learn_${Date.now()}`,
      sourceType: 'document',
      status: 'queued',
      documentUri: dto.documentUri,
      summary: dto.title ?? 'Document learning job queued for background ingestion.',
      createdAt: now,
      updatedAt: now
    };
    this.learningJobs.set(job.id, job);
    await this.persistRuntimeState();
    return job;
  }

  async createResearchLearningJob(dto: CreateResearchLearningJobDto): Promise<LearningJob> {
    const now = new Date().toISOString();
    const jobId = `learn_${Date.now()}`;
    const workflowResolution = resolveWorkflowPreset(
      dto.workflowId ? `${dto.workflowId} ${dto.goal}`.trim() : dto.goal
    );
    const job: LearningJob = {
      id: jobId,
      sourceType: 'research',
      status: 'queued',
      documentUri: dto.goal,
      goal: workflowResolution.normalizedGoal,
      workflowId: workflowResolution.preset.id,
      preferredUrls: dto.preferredUrls,
      summary:
        dto.title ??
        `户部已为“${workflowResolution.normalizedGoal}”创建后台研究学习任务，等待 background runner 采集来源。`,
      sources: [],
      createdAt: now,
      updatedAt: now
    };
    this.learningJobs.set(job.id, job);
    await this.persistRuntimeState();
    return job;
  }

  async processQueuedLearningJobs(maxItems = 1): Promise<LearningJob[]> {
    const queued = [...this.learningJobs.values()]
      .filter(job => job.status === 'queued')
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .slice(0, Math.max(1, maxItems));
    if (!queued.length) {
      return [];
    }

    const processed: LearningJob[] = [];
    for (const queuedJob of queued) {
      const running: LearningJob = {
        ...queuedJob,
        status: 'running',
        updatedAt: new Date().toISOString()
      };
      this.learningJobs.set(running.id, running);
      await this.persistRuntimeState();

      try {
        const completed =
          running.sourceType === 'document'
            ? await this.processDocumentLearningJob(running)
            : await this.processResearchLearningJob(running);
        this.learningJobs.set(completed.id, completed);
        processed.push(completed);
      } catch (error) {
        const failed: LearningJob = {
          ...running,
          status: 'failed',
          summary: error instanceof Error ? error.message : 'Learning job execution failed.',
          updatedAt: new Date().toISOString()
        };
        this.learningJobs.set(failed.id, failed);
        processed.push(failed);
      }

      await this.persistRuntimeState();
    }

    return processed;
  }

  private async processDocumentLearningJob(job: LearningJob): Promise<LearningJob> {
    const skill = this.buildSkillDraft(job.summary ?? job.documentUri, 'document');
    await this.skillRegistry.publishToLab(skill);
    return {
      ...job,
      status: 'completed',
      updatedAt: new Date().toISOString()
    };
  }

  private async processResearchLearningJob(job: LearningJob): Promise<LearningJob> {
    const workflowResolution = resolveWorkflowPreset(
      job.workflowId ? `${job.workflowId} ${job.goal ?? job.documentUri}`.trim() : (job.goal ?? job.documentUri)
    );
    const sources = buildResearchSourcePlan({
      taskId: job.id,
      runId: undefined,
      goal: workflowResolution.normalizedGoal,
      workflow: workflowResolution.preset,
      runtimeSourcePolicyMode: this.settings.policy?.sourcePolicyMode,
      preferredUrls: job.preferredUrls,
      createdAt: job.createdAt
    });
    const collectedSources = await Promise.all(
      sources.map(async source => {
        const capabilityId = this.selectResearchCapability(source);
        const result = capabilityId
          ? await this.mcpClientManager?.invokeCapability(capabilityId, {
              taskId: job.id,
              toolName: capabilityId,
              intent: ActionIntent.CALL_EXTERNAL_API,
              requestedBy: 'agent',
              input: this.buildResearchCapabilityInput(capabilityId, source, workflowResolution.normalizedGoal)
            })
          : undefined;
        return {
          ...source,
          detail:
            result?.ok && result.rawOutput && typeof result.rawOutput === 'object'
              ? {
                  capabilityId,
                  selectedCapabilityId: result.capabilityId,
                  serverId: result.serverId,
                  transportUsed: result.transportUsed,
                  fallbackUsed: result.fallbackUsed,
                  ...(result.rawOutput as Record<string, unknown>)
                }
              : {
                  capabilityId,
                  selectedCapabilityId: result?.capabilityId,
                  serverId: result?.serverId,
                  transportUsed: result?.transportUsed,
                  fallbackUsed: result?.fallbackUsed,
                  error: result?.errorMessage ?? 'mcp_collect_failed',
                  outputSummary: result?.outputSummary
                }
        };
      })
    );
    const trustSummary = sources.reduce<Partial<Record<EvidenceRecord['trustClass'], number>>>((summary, source) => {
      summary[source.trustClass] = (summary[source.trustClass] ?? 0) + 1;
      return summary;
    }, {});
    const completedJob: LearningJob = {
      ...job,
      status: 'completed',
      goal: workflowResolution.normalizedGoal,
      workflowId: workflowResolution.preset.id,
      summary:
        job.summary && !job.summary.includes('等待 background runner')
          ? job.summary
          : `户部已为“${workflowResolution.normalizedGoal}”整理并抓取 ${collectedSources.length} 个优先研究来源，默认按 ${
              this.settings.policy?.sourcePolicyMode ??
              workflowResolution.preset.sourcePolicy?.mode ??
              'controlled-first'
            } 策略执行。`,
      sources: collectedSources,
      trustSummary,
      learningEvaluation: this.learningFlow.evaluateResearchJob({
        ...job,
        sourceType: 'research',
        status: 'completed',
        documentUri: job.documentUri,
        goal: workflowResolution.normalizedGoal,
        workflowId: workflowResolution.preset.id,
        sources: collectedSources,
        trustSummary,
        createdAt: job.createdAt,
        updatedAt: new Date().toISOString()
      }),
      updatedAt: new Date().toISOString()
    };
    await this.learningFlow.autoPersistResearchMemory(
      completedJob,
      workflowResolution.preset.autoPersistPolicy?.memory ?? 'manual'
    );
    return completedJob;
  }

  private selectResearchCapability(source: EvidenceRecord): string {
    const sourceUrl = source.sourceUrl?.toLowerCase();
    if (sourceUrl?.includes('github.com') && this.mcpClientManager?.hasCapability('search_doc')) {
      return 'search_doc';
    }
    if (sourceUrl && this.mcpClientManager?.hasCapability('webReader')) {
      return 'webReader';
    }
    if (this.mcpClientManager?.hasCapability('webSearchPrime')) {
      return 'webSearchPrime';
    }
    return 'collect_research_source';
  }

  private buildResearchCapabilityInput(
    capabilityId: string,
    source: EvidenceRecord,
    goal: string
  ): Record<string, unknown> {
    switch (capabilityId) {
      case 'search_doc':
        return { repoUrl: source.sourceUrl, query: goal };
      case 'webReader':
        return { url: source.sourceUrl, goal };
      case 'webSearchPrime':
        return { query: source.sourceUrl ? `${goal} site:${new URL(source.sourceUrl).hostname}` : goal };
      default:
        return {
          url: source.sourceUrl,
          goal,
          trustClass: source.trustClass,
          sourceType: source.sourceType
        };
    }
  }
}
