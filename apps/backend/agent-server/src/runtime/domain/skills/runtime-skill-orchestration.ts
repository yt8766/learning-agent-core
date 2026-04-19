import type { SkillCard, SkillInstallReceipt, SkillManifestRecord, SkillSourceRecord } from '@agent/core';

import {
  finalizeRemoteSkillInstall,
  finalizeSkillInstall,
  writeSkillInstallReceipt
} from '../../skills/runtime-skill-install.service';
import type { RuntimeSkillInstallContext } from '../../skills/runtime-skill-install.service';
import { resolveTaskSkillSearch, type RuntimeSkillSourcesContext } from '../../skills/runtime-skill-sources.service';
import type { RuntimeHost } from '../../core/runtime.host';
import type { RuntimeCentersService } from '../../centers/runtime-centers.service';

type RuntimeSkillSourcesContextWithList = RuntimeSkillSourcesContext & {
  listSkillSources?: () => Promise<SkillSourceRecord[]>;
};

export interface RuntimeSkillSuggestion {
  id: string;
  kind: string;
  displayName: string;
  availability: string;
  repo?: string;
  skillName?: string;
  detailsUrl?: string;
  installCommand?: string;
  triggerReason?: 'user_requested' | 'capability_gap_detected' | 'domain_specialization_needed';
  summary?: string;
  sourceLabel?: string;
}

export interface RuntimeSkillSearchPayload {
  suggestions?: RuntimeSkillSuggestion[];
}

export async function resolvePreExecutionSkillIntervention(input: {
  settings: RuntimeHost['settings'];
  centersService: Pick<RuntimeCentersService, 'installRemoteSkill' | 'approveSkillInstall'>;
  getSkillSourcesContext: () => RuntimeSkillSourcesContextWithList;
  goal: string;
  skillSearch?: RuntimeSkillSearchPayload;
  usedInstalledSkills?: string[];
}) {
  const candidate = input.skillSearch?.suggestions?.find(
    item => item.kind === 'remote-skill' && item.availability === 'installable-remote' && item.repo
  );
  if (!candidate) return undefined;
  const shouldAutoInstall =
    input.settings.policy.skillInstallMode === 'low-risk-auto' &&
    (candidate.sourceLabel === 'skills.sh' || candidate.repo?.startsWith('vercel-labs/'));
  if (!shouldAutoInstall) return undefined;
  try {
    let receipt = await input.centersService.installRemoteSkill({
      repo: candidate.repo!,
      skillName: candidate.skillName ?? candidate.displayName,
      detailsUrl: candidate.detailsUrl,
      installCommand: candidate.installCommand,
      triggerReason: candidate.triggerReason,
      summary: candidate.summary ?? candidate.displayName,
      actor: 'runtime-auto-pre-execution'
    });
    if (receipt.status === 'pending') {
      receipt = await input.centersService.approveSkillInstall(receipt.id, {
        actor: 'runtime-auto-pre-execution',
        reason: 'runtime low-risk auto install'
      });
    }
    if (receipt.status !== 'installed') {
      if (receipt.status === 'pending') {
        return {
          pendingApproval: {
            toolName: 'npx skills add',
            reason: `当前轮需要先安装 ${candidate.displayName} 才能继续更专业地回答。`,
            preview: [
              { label: 'Repo', value: candidate.repo! },
              { label: 'Skill', value: candidate.skillName ?? candidate.displayName },
              { label: 'Command', value: candidate.installCommand ?? 'npx skills add' }
            ]
          },
          pendingExecution: { receiptId: receipt.id, skillDisplayName: candidate.displayName },
          traceSummary: `首辅在执行前识别到远程技能 ${candidate.displayName} 需要审批安装，当前轮已挂起等待确认。`,
          progressSummary: `检测到需要先安装 ${candidate.displayName}，当前轮已暂停等待审批。`
        };
      }
      return {
        traceSummary: `首辅已在执行前识别出可补齐技能 ${candidate.displayName}，但当前安装状态为 ${receipt.status}。`,
        progressSummary: `检测到需要更专业的 skill，已在执行前发起 ${candidate.displayName} 安装。`
      };
    }
    const installedWorkerId = `installed-skill:${receipt.skillId}`;
    const refreshedSkillSearch = await resolveTaskSkillSearch(input.getSkillSourcesContext(), input.goal, {
      usedInstalledSkills: [...(input.usedInstalledSkills ?? []), installedWorkerId]
    });
    return {
      skillSearch: refreshedSkillSearch,
      usedInstalledSkills: [installedWorkerId],
      traceSummary: `首辅在本轮执行前自动安装了远程技能 ${candidate.displayName}，并已将其纳入当前能力链。`,
      progressSummary: `检测到能力缺口，已在执行前补齐 ${candidate.displayName}，当前轮会继续带着该 skill 执行。`
    };
  } catch (error) {
    return {
      traceSummary: `首辅尝试在执行前补齐远程技能 ${candidate.displayName}，但安装失败：${error instanceof Error ? error.message : 'unknown error'}`,
      progressSummary: `尝试在本轮启动前补齐 ${candidate.displayName} 失败，先按现有能力继续执行。`
    };
  }
}

export async function resolveSkillInstallApproval(input: {
  centersService: Pick<RuntimeCentersService, 'approveSkillInstall'>;
  getSkillSourcesContext: () => RuntimeSkillSourcesContextWithList;
  task: { goal: string; usedInstalledSkills?: string[] };
  pending: { receiptId?: string; usedInstalledSkills?: string[]; skillDisplayName?: string };
  actor?: string;
}) {
  if (!input.pending.receiptId) return undefined;
  const receipt = await input.centersService.approveSkillInstall(input.pending.receiptId, {
    actor: input.actor ?? 'agent-chat-user',
    reason: 'approved_from_chat_thread'
  });
  if (receipt.status !== 'installed') {
    return {
      traceSummary: `已批准 ${input.pending.skillDisplayName ?? '远程 skill'} 安装，但当前状态仍为 ${receipt.status}。`,
      progressSummary: `已批准 ${input.pending.skillDisplayName ?? '远程 skill'} 安装，等待安装完成后继续。`
    };
  }
  const installedWorkerId = `installed-skill:${receipt.skillId}`;
  const refreshedSkillSearch = await resolveTaskSkillSearch(input.getSkillSourcesContext(), input.task.goal, {
    usedInstalledSkills: [
      ...(input.task.usedInstalledSkills ?? []),
      ...(input.pending.usedInstalledSkills ?? []),
      installedWorkerId
    ]
  });
  return {
    skillSearch: refreshedSkillSearch,
    usedInstalledSkills: [installedWorkerId],
    traceSummary: `已批准并完成 ${input.pending.skillDisplayName ?? '远程 skill'} 安装，当前轮将继续带着新 skill 执行。`,
    progressSummary: `${input.pending.skillDisplayName ?? '远程 skill'} 已安装完成，当前轮继续执行。`
  };
}

export async function resolveRuntimeSkillIntervention(input: {
  settings: RuntimeHost['settings'];
  centersService: Pick<RuntimeCentersService, 'installRemoteSkill' | 'approveSkillInstall'>;
  getSkillSourcesContext: () => RuntimeSkillSourcesContextWithList;
  goal: string;
  currentStep: 'direct_reply' | 'research';
  skillSearch?: RuntimeSkillSearchPayload;
  usedInstalledSkills?: string[];
}) {
  const resolved = await resolvePreExecutionSkillIntervention(input);
  if (!resolved) return undefined;
  const stageLabel = input.currentStep === 'direct_reply' ? '直答阶段' : '研究阶段';
  return {
    ...resolved,
    traceSummary: resolved.traceSummary
      ? `${stageLabel}发现当前能力链需要补强。${resolved.traceSummary}`
      : `${stageLabel}发现当前能力链需要补强，已触发 skill 介入。`,
    progressSummary: resolved.progressSummary
      ? `${stageLabel}触发 skill 介入：${resolved.progressSummary}`
      : `${stageLabel}检测到需要补齐 skill，当前轮已切入技能安装流程。`
  };
}

export async function syncInstalledSkillWorkers(input: {
  skillRegistry: RuntimeHost['skillRegistry'];
  registerSkillWorker: (skill: SkillCard) => void;
}) {
  const skills = await input.skillRegistry.list();
  skills
    .filter(skill => Boolean(skill.installReceiptId || skill.sourceId))
    .forEach(skill => input.registerSkillWorker(skill));
}

export async function completeSkillInstall(input: {
  getSkillInstallContext: () => RuntimeSkillInstallContext;
  manifest: SkillManifestRecord;
  source: SkillSourceRecord;
  receipt: SkillInstallReceipt;
}) {
  await finalizeSkillInstall(input.getSkillInstallContext(), input.manifest, input.source, input.receipt);
}

export async function completeRemoteSkillInstall(input: {
  getSkillInstallContext: () => RuntimeSkillInstallContext;
  receipt: SkillInstallReceipt;
}) {
  await finalizeRemoteSkillInstall(input.getSkillInstallContext(), input.receipt);
}

export async function persistSkillInstallReceipt(input: {
  getSkillInstallContext: () => RuntimeSkillInstallContext;
  receipt: SkillInstallReceipt;
}) {
  await writeSkillInstallReceipt(input.getSkillInstallContext(), input.receipt);
}
