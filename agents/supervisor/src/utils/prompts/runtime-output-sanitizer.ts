const OPERATIONAL_BOILERPLATE_PATTERNS = [
  /^首辅已(?:在本地技能库中命中|识别出能力缺口|优先命中).+$/gm,
  /^收到你的任务，首辅正在拆解目标并准备调度六部。?$/gm,
  /^本轮已切换到.+流程。?$/gm,
  /^首辅先从历史经验中命中了.+$/gm,
  /^当前由.+主导，并发征询.+$/gm,
  /^首辅已完成规划，接下来会按.+推进。?$/gm,
  /^已分派给 .+$/gm,
  /^户部已开始检索资料与上下文。?$/gm,
  /^户部战报：.+$/gm,
  /^兵部已接到任务，正在执行方案。?$/gm,
  /^礼部开始审查并整理交付。?$/gm,
  /^检测到能力缺口，已在本地技能库中找到.+$/gm,
  /^本地技能库已命中.+$/gm,
  /^首辅(?:视角|思考中|规划|已经汇总完毕).+$/gm,
  /^礼部(?:视角|正在整理交付说明与最终文档).+$/gm,
  /^当前仍由首辅统一协调全局。?$/gm,
  /^原始记录：.+$/gm,
  /^\{\s*"runId":\s*".+"\s*\}$/gm
];

const INLINE_OPERATIONAL_PREFIXES = [
  /(?:^|\n)\s*已分派给 (?:research|executor|reviewer)[^：:]*[：:]\s*(?:\/[a-z-]+\s*)?/g,
  /(?:^|\n)\s*户部战报：[^\n]*/g,
  /(?:^|\n)\s*(?:户部已开始检索资料与上下文|兵部已接到任务，正在执行方案)。?/g
];

/**
 * Removes supervisor/runtime narration before content is reused as model context.
 * This is prompt hygiene, not a Markdown or security sanitizer.
 */
export function stripOperationalBoilerplate(content: string): string {
  const normalized = OPERATIONAL_BOILERPLATE_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, ''),
    content.replace(/\r\n/g, '\n')
  );

  return INLINE_OPERATIONAL_PREFIXES.reduce((current, pattern) => current.replace(pattern, '\n'), normalized)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function stripThinkBlocks(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
    .replace(/<think\b[^>]*>[\s\S]*$/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function sanitizeTaskContextForModel(content?: string): string {
  if (!content?.trim()) {
    return '';
  }

  return stripOperationalBoilerplate(content)
    .replace(/(?:^|\n)\s*\/(?:browse|review|qa|ship)\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
