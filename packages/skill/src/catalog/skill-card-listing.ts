import type { SkillCard } from '@agent/core';

export function sanitizeListedSkills(skills: SkillCard[]) {
  const filtered = skills.filter(skill => !isAccidentalSkillCard(skill));
  const deduped = new Map<string, SkillCard>();
  for (const skill of filtered) {
    const key = buildSkillDedupKey(skill);
    const existing = deduped.get(key);
    if (!existing || compareSkillPriority(skill, existing) < 0) {
      deduped.set(key, skill);
    }
  }
  return Array.from(deduped.values());
}

function buildSkillDedupKey(skill: SkillCard) {
  return [
    (typeof skill.name === 'string' ? skill.name : '').trim().toLowerCase(),
    (skill.description ?? '').trim().toLowerCase(),
    skill.ownership?.ownerType ?? '',
    skill.source ?? ''
  ].join('::');
}

function compareSkillPriority(candidate: SkillCard, current: SkillCard) {
  return scoreSkillPriority(candidate) - scoreSkillPriority(current);
}

function scoreSkillPriority(skill: SkillCard) {
  const statusScore = skill.status === 'stable' ? 0 : skill.status === 'lab' ? 1 : 2;
  const createdScore = skill.createdAt ? -Date.parse(skill.createdAt) || 0 : 0;
  return statusScore * 1_000_000_000_000 + createdScore;
}

function isAccidentalSkillCard(skill: SkillCard) {
  const corpus = [
    skill.name,
    skill.description,
    ...(skill.applicableGoals ?? []),
    ...(skill.steps ?? []).map(step => step.instruction)
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();

  if (skill.name === '多 Agent 执行模式' && skill.status === 'lab' && skill.ownership?.ownerType !== 'shared') {
    return true;
  }

  return isLikelyAccidentalSkillPrompt(corpus);
}

function isLikelyAccidentalSkillPrompt(prompt: string) {
  const normalized = prompt.trim().toLowerCase();
  const weeklyReportPatterns = [
    /周报/,
    /日报/,
    /月报/,
    /年报/,
    /工作总结/,
    /生成.*周报/,
    /写.*周报/,
    /整理.*周报/,
    /参考上面的.*生成/,
    /参考上面的.*周报/,
    /这个草稿会先做上下文理解/,
    /润色/,
    /文案/,
    /邮件/,
    /翻译/
  ];
  return weeklyReportPatterns.some(pattern => pattern.test(normalized));
}
