export function firstKnowledgeRow<T>(rows: readonly T[]): T {
  const row = rows[0];
  if (!row) {
    throw new Error('Knowledge postgres query returned no rows');
  }
  return row;
}

export function jsonParam(value: unknown): string {
  return JSON.stringify(value);
}

export function vectorParam(value: readonly number[] | undefined): string | null {
  if (!value) return null;
  if (value.length !== 1024) {
    throw new Error('Knowledge chunk embedding must contain 1024 dimensions for pgvector storage');
  }
  return `[${value.join(',')}]`;
}
