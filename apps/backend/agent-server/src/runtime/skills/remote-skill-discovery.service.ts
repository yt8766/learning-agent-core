import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type {
  LocalSkillSuggestionRecord,
  RequestedExecutionHints,
  SkillCard,
  SkillManifestRecord,
  SkillSourceRecord,
  SkillTriggerReason,
  SpecialistDomain
} from '@agent/core';
import type { RuntimeProfile } from '@agent/config';

import { buildLocalSkillSuggestions } from './local-skill-search';
import { buildSkillsAddArgs, buildSkillsAddCommand } from './runtime-skill-cli';

const execFileAsync = promisify(execFile);
const DEFAULT_REMOTE_SOURCE = 'skills.sh';
const DEFAULT_FIND_SKILLS_REPO = 'vercel-labs/skills';
const DEFAULT_FIND_SKILLS_NAME = 'find-skills';

interface DiscoveryInput {
  goal: string;
  installedSkills: SkillCard[];
  manifests: SkillManifestRecord[];
  sources: SkillSourceRecord[];
  profile: RuntimeProfile;
  usedInstalledSkills?: string[];
  requestedHints?: RequestedExecutionHints;
  specialistDomain?: SpecialistDomain | string;
  limit?: number;
}

interface RemoteSearchResult {
  query: string;
  discoverySource: string;
  executedAt: string;
  results: LocalSkillSuggestionRecord[];
}

type CommandRunner = (command: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;

export class RemoteSkillDiscoveryService {
  constructor(private readonly runCommand: CommandRunner = defaultCommandRunner) {}

  async discover(input: DiscoveryInput) {
    const local = buildLocalSkillSuggestions({
      goal: input.goal,
      installedSkills: input.installedSkills,
      manifests: input.manifests,
      sources: input.sources,
      profile: input.profile,
      usedInstalledSkills: input.usedInstalledSkills,
      limit: input.limit
    });
    const weightedLocal = weightSuggestions(local.suggestions, {
      goal: input.goal,
      requestedHints: input.requestedHints,
      specialistDomain: input.specialistDomain
    });

    const triggerReason = determineSkillTriggerReason(input.goal, local.capabilityGapDetected);
    const shouldSearchRemote =
      triggerReason === 'user_requested' ||
      triggerReason === 'domain_specialization_needed' ||
      (triggerReason === 'capability_gap_detected' && !hasReadySuggestion(weightedLocal));

    if (!shouldSearchRemote) {
      return {
        capabilityGapDetected: local.capabilityGapDetected,
        suggestions: weightedLocal,
        triggerReason
      };
    }

    const remoteSearch = await this.searchRemoteCandidates(input.goal, triggerReason, input.limit ?? 5);
    return {
      capabilityGapDetected: local.capabilityGapDetected,
      suggestions: dedupeSuggestions(
        weightSuggestions([...weightedLocal, ...remoteSearch.results], {
          goal: input.goal,
          requestedHints: input.requestedHints,
          specialistDomain: input.specialistDomain
        }),
        input.limit ?? 5
      ),
      triggerReason,
      remoteSearch
    };
  }

  async searchRemoteCandidates(
    query: string,
    triggerReason: SkillTriggerReason,
    limit = 5
  ): Promise<RemoteSearchResult> {
    const executedAt = new Date().toISOString();
    try {
      const { stdout, stderr } = await this.runCommand('npx', ['-y', 'skills', 'find', query]);
      const results = parseRemoteSkillCandidates(`${stdout}\n${stderr}`, query, triggerReason, limit);
      return {
        query,
        discoverySource: DEFAULT_REMOTE_SOURCE,
        executedAt,
        results: results.length ? results : [buildFindSkillsFallback(query, triggerReason)]
      };
    } catch (error) {
      const failureDetail = error instanceof Error ? error.message : 'remote_skill_search_failed';
      return {
        query,
        discoverySource: DEFAULT_REMOTE_SOURCE,
        executedAt,
        results: [
          {
            ...buildFindSkillsFallback(query, triggerReason),
            reason: `本地候选不足，已建议先安装 ${DEFAULT_FIND_SKILLS_NAME}。远程检索当前未完成：${failureDetail}`
          }
        ]
      };
    }
  }

  async installRemoteSkill(input: { repo: string; skillName?: string }) {
    return this.runCommand('npx', buildSkillsAddArgs({ repo: input.repo, skillName: input.skillName }));
  }

  async checkInstalledSkills() {
    return this.runCommand('npx', ['skills', 'check']);
  }

  async updateInstalledSkills() {
    return this.runCommand('npx', ['skills', 'update']);
  }
}

function weightSuggestions(
  suggestions: LocalSkillSuggestionRecord[],
  context: {
    goal: string;
    requestedHints?: RequestedExecutionHints;
    specialistDomain?: SpecialistDomain | string;
  }
) {
  const requestedSkill = context.requestedHints?.requestedSkill?.toLowerCase();
  const requestedConnector = context.requestedHints?.requestedConnectorTemplate;
  const specialistDomain = context.specialistDomain?.toLowerCase();
  const goal = context.goal.toLowerCase();

  return suggestions
    .map(suggestion => {
      let score = suggestion.score;
      if (requestedSkill) {
        const haystack = `${suggestion.displayName} ${suggestion.id} ${suggestion.skillName ?? ''}`.toLowerCase();
        if (haystack.includes(requestedSkill)) {
          score += 0.18;
        }
      }
      if (specialistDomain) {
        const domains = [...(suggestion.domains ?? []), ...(suggestion.specialistAffinity ?? [])].map(item =>
          item.toLowerCase()
        );
        if (domains.includes(specialistDomain)) {
          score += 0.12;
        }
      }
      if (
        requestedConnector &&
        suggestion.preferredConnectors?.some(connector => connector.toLowerCase().includes(requestedConnector))
      ) {
        score += 0.08;
      }
      if (
        specialistDomain === 'technical-architecture' &&
        /(架构|architecture|code|repo|重构)/.test(goal) &&
        /(architecture|code|repo|review)/i.test(`${suggestion.displayName} ${suggestion.summary}`)
      ) {
        score += 0.06;
      }
      return {
        ...suggestion,
        score
      };
    })
    .sort((left, right) => right.score - left.score);
}

async function defaultCommandRunner(command: string, args: string[]) {
  return execFileAsync(command, args, {
    env: process.env,
    timeout: 30_000,
    maxBuffer: 1024 * 1024
  });
}

function hasReadySuggestion(suggestions: LocalSkillSuggestionRecord[]) {
  return suggestions.some(item => item.kind === 'installed' && item.availability === 'ready');
}

function dedupeSuggestions(suggestions: LocalSkillSuggestionRecord[], limit: number) {
  return suggestions
    .filter(
      (item, index, list) =>
        list.findIndex(candidate => candidate.kind === item.kind && candidate.id === item.id) === index
    )
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

export function determineSkillTriggerReason(goal: string, capabilityGapDetected: boolean): SkillTriggerReason {
  const normalized = goal.toLowerCase();
  if (
    /(skills?\.sh|find-skill|find skills|install skill|安装.*skill|搜索.*skill|找.*skill|技能|skill\b)/.test(normalized)
  ) {
    return 'user_requested';
  }

  if (
    /(code review|审查|compliance|risk|发布|release|架构|architecture|payment|支付|专题|专业|openclaw|治理|安全)/.test(
      normalized
    )
  ) {
    return 'domain_specialization_needed';
  }

  return capabilityGapDetected ? 'capability_gap_detected' : 'capability_gap_detected';
}

function parseRemoteSkillCandidates(
  output: string,
  query: string,
  triggerReason: SkillTriggerReason,
  limit: number
): LocalSkillSuggestionRecord[] {
  const lines = output
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const candidates: LocalSkillSuggestionRecord[] = [];

  for (const line of lines) {
    const githubMatch = line.match(/github\.com\/([\w.-]+\/[\w.-]+)(?:[^\s]*?--skill\s+([\w.-]+))?/i);
    const skillsShMatch = line.match(/skills\.sh\/([\w.-]+)\/([\w.-]+)\/([\w.-]+)/i);
    const repoMatch = line.match(/\b([\w.-]+\/[\w.-]+)\b/);
    const skillName = skillsShMatch?.[3] ?? githubMatch?.[2] ?? inferSkillNameFromLine(line);
    const repo = skillsShMatch ? `${skillsShMatch[1]}/${skillsShMatch[2]}` : (githubMatch?.[1] ?? repoMatch?.[1]);
    if (!repo || !skillName || isPlaceholderRemoteSkill(repo, skillName, line)) {
      continue;
    }

    const detailsUrl = skillsShMatch
      ? `https://skills.sh/${skillsShMatch[1]}/${skillsShMatch[2]}/${skillsShMatch[3]}`
      : `https://skills.sh/${repo}/${skillName}`;
    const installCommand = buildSkillsAddCommand({ repo, skillName });
    candidates.push({
      id: `remote:${repo}:${skillName}`,
      kind: 'remote-skill',
      displayName: skillName,
      summary: line,
      score: computeRemoteSkillScore(query, line, triggerReason),
      availability: 'installable-remote',
      reason: buildTriggerReasonCopy(triggerReason),
      requiredCapabilities: [],
      version: 'remote',
      sourceId: 'skills-sh-directory',
      sourceLabel: 'skills.sh',
      sourceTrustClass: 'curated',
      installationMode: 'marketplace-managed',
      repo,
      skillName,
      detailsUrl,
      installCommand,
      discoverySource: DEFAULT_REMOTE_SOURCE,
      triggerReason
    });
  }

  if (!candidates.length) {
    candidates.push(buildFindSkillsFallback(query, triggerReason));
  }

  return candidates.sort((left, right) => right.score - left.score).slice(0, limit);
}

function inferSkillNameFromLine(line: string) {
  const quoted = line.match(/["'`]?([\w.-]+)["'`]?\s+skill/i);
  if (quoted?.[1]) {
    return quoted[1];
  }
  const dashed = line.match(/\b([\w.-]+)\b/);
  return dashed?.[1];
}

function isPlaceholderRemoteSkill(repo: string, skillName: string, line: string) {
  const normalizedRepo = repo.toLowerCase();
  const normalizedSkill = skillName.toLowerCase();
  const normalizedLine = line.toLowerCase();

  if (normalizedRepo === 'owner/repo') {
    return true;
  }

  if (normalizedSkill === 'npx' || normalizedSkill === 'skills') {
    return true;
  }

  if (normalizedLine.includes('<owner/repo') || normalizedLine.includes('owner/repo@skill')) {
    return true;
  }

  return false;
}

function computeRemoteSkillScore(query: string, line: string, triggerReason: SkillTriggerReason) {
  const normalizedQuery = query.toLowerCase();
  const normalizedLine = line.toLowerCase();
  let score = 0.62;
  if (normalizedLine.includes(normalizedQuery)) {
    score += 0.18;
  }
  if (triggerReason === 'user_requested') {
    score += 0.08;
  }
  if (triggerReason === 'domain_specialization_needed') {
    score += 0.05;
  }
  return score;
}

function buildFindSkillsFallback(query: string, triggerReason: SkillTriggerReason): LocalSkillSuggestionRecord {
  return {
    id: `remote:${DEFAULT_FIND_SKILLS_REPO}:${DEFAULT_FIND_SKILLS_NAME}`,
    kind: 'remote-skill',
    displayName: DEFAULT_FIND_SKILLS_NAME,
    summary: `先安装 ${DEFAULT_FIND_SKILLS_NAME}，再继续从 skills.sh 目录检索 “${query}” 相关技能。`,
    sourceId: 'skills-sh-directory',
    score: 0.74,
    availability: 'installable-remote',
    reason: buildTriggerReasonCopy(triggerReason),
    requiredCapabilities: [],
    version: 'remote',
    sourceLabel: 'skills.sh',
    sourceTrustClass: 'curated',
    installationMode: 'marketplace-managed',
    repo: DEFAULT_FIND_SKILLS_REPO,
    skillName: DEFAULT_FIND_SKILLS_NAME,
    detailsUrl: `https://skills.sh/${DEFAULT_FIND_SKILLS_REPO}/${DEFAULT_FIND_SKILLS_NAME}`,
    installCommand: buildSkillsAddCommand({ repo: DEFAULT_FIND_SKILLS_REPO, skillName: DEFAULT_FIND_SKILLS_NAME }),
    discoverySource: DEFAULT_REMOTE_SOURCE,
    triggerReason
  };
}

function buildTriggerReasonCopy(triggerReason: SkillTriggerReason) {
  switch (triggerReason) {
    case 'user_requested':
      return '这是一次显式找 skill / 装 skill 请求，已切到远程技能目录检索。';
    case 'domain_specialization_needed':
      return '当前问题进入专业领域，建议引入更专业的 skill 再继续回答。';
    default:
      return '当前能力链路存在缺口，已建议从 skills.sh 补充远程 skill。';
  }
}
