export function scoreKnowledgeChunk(query: string, content: string): number {
  const normalizedQuery = tokenize(query);
  const normalizedContent = tokenize(content);
  if (normalizedQuery.length === 0 || normalizedContent.length === 0) {
    return 0;
  }

  const matchedTerms = normalizedQuery.filter(term => normalizedContent.includes(term));
  return matchedTerms.length / normalizedQuery.length;
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/i)
    .map(part => part.trim())
    .filter(Boolean);
}
