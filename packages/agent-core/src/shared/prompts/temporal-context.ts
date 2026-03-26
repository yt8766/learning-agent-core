export function buildTemporalContextBlock(referenceDate = new Date()) {
  const iso = referenceDate.toISOString();
  const absoluteDate = iso.slice(0, 10);
  return [
    `当前绝对日期：${absoluteDate}`,
    `当前绝对时间（ISO）：${iso}`,
    '如果用户提到“最近 / 最新 / 今天 / 昨天 / 明天 / 本周 / 本月 / 今年”，必须以这个绝对日期为基准理解。',
    '如果问题依赖时效性，不要沿用过去年份或模糊相对时间。必要时在答案中显式写出绝对日期。'
  ].join('\n');
}

export function isFreshnessSensitiveGoal(goal: string) {
  const normalized = goal.trim().toLowerCase();
  return [
    'latest',
    'recent',
    'today',
    'yesterday',
    'tomorrow',
    'this week',
    'this month',
    'this year',
    '最新',
    '最近',
    '今天',
    '昨日',
    '昨天',
    '明天',
    '本周',
    '本月',
    '今年',
    '近期',
    '现在'
  ].some(pattern => normalized.includes(pattern));
}

export function buildFreshnessAnswerInstruction(goal: string, referenceDate = new Date()) {
  if (!isFreshnessSensitiveGoal(goal)) {
    return '';
  }
  const iso = referenceDate.toISOString();
  const absoluteDate = iso.slice(0, 10);
  return [
    `本题属于时效性问题。`,
    `最终答复中必须明确写出“信息基准日期：${absoluteDate}”或“信息检索基准时间：${iso}”。`,
    '如果答案里提到“最近 / 最新 / 今天”，要同时给出对应的绝对日期。'
  ].join('\n');
}
