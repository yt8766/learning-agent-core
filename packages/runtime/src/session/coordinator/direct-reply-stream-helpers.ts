/** Plain `<think>` blocks (see agent-chat `parseAssistantThinkingContent`). */
const PLAIN_THINK_BLOCK = /<think>([\s\S]*?)<\/think>/gi;

/**
 * Pulls visible model "thinking" fragments from the raw stream buffer (complete blocks + open tail).
 * Supports `<think …>…</think>` (runtime sanitizer) and `<think>…</think>` (adapter strip path).
 */
export function extractThinkContentFromDirectReplyBuffer(buffer: string): string {
  if (!buffer.trim()) {
    return '';
  }

  const parts: string[] = [];
  const attributeBlockRe = /<think\b[^>]*>([\s\S]*?)<\/think>/gi;
  let match: RegExpExecArray | null;
  while ((match = attributeBlockRe.exec(buffer)) !== null) {
    const inner = match[1]?.trim();
    if (inner) {
      parts.push(inner);
    }
  }

  const plainCopy = buffer;
  while ((match = PLAIN_THINK_BLOCK.exec(plainCopy)) !== null) {
    const inner = match[1]?.trim();
    if (inner) {
      parts.push(inner);
    }
  }

  const lastAttrOpen = buffer.search(/<think\b[^>]*>/);
  const lastPlainOpen = buffer.lastIndexOf('<think>');
  const lastClose = buffer.lastIndexOf('</think>');
  const lastOpenIdx = Math.max(lastAttrOpen, lastPlainOpen);
  if (lastOpenIdx !== -1 && lastOpenIdx > lastClose) {
    const slice = buffer.slice(lastOpenIdx);
    const gt = slice.indexOf('>');
    if (gt !== -1) {
      const partialInner = slice.slice(gt + 1).trim();
      if (partialInner) {
        parts.push(partialInner);
      }
    }
  }

  return parts.filter(Boolean).join('\n\n').trim();
}

/** Strips reasoning tags from streamed assistant text before persistence/display. */
export function sanitizeDirectReplyVisibleContent(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
    .replace(/<think\b[^>]*>[\s\S]*$/gi, '')
    .replace(/<think>([\s\S]*?)<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim();
}
