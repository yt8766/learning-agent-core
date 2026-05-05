export interface ReasoningParts {
  reasoning?: string;
  visibleContent: string;
}

export function splitReasoning(rawContent: string): ReasoningParts {
  const openTag = '<think>';
  const closeTag = '</think>';
  const openIndex = rawContent.indexOf(openTag);

  if (openIndex < 0) {
    return { visibleContent: rawContent };
  }

  const closeIndex = rawContent.indexOf(closeTag, openIndex + openTag.length);

  if (closeIndex < 0) {
    return {
      reasoning: rawContent.slice(openIndex + openTag.length).trim(),
      visibleContent: rawContent.slice(0, openIndex).trim()
    };
  }

  return {
    reasoning: rawContent.slice(openIndex + openTag.length, closeIndex).trim(),
    visibleContent: `${rawContent.slice(0, openIndex)}${rawContent.slice(closeIndex + closeTag.length)}`.trim()
  };
}
