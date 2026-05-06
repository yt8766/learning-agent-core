export function createKnowledgeAccessToken(userId: string, version = 1) {
  return `knowledge-access:${userId}:${version}`;
}

export function createKnowledgeRefreshToken(userId: string, version = 1) {
  return `knowledge-refresh:${userId}:${version}`;
}

export function parseKnowledgeRefreshToken(token: string) {
  const [prefix, kind, userId, version] = token.split(':');
  if (prefix !== 'knowledge-refresh' && `${prefix}:${kind}` !== 'knowledge-refresh') {
    return undefined;
  }
  if (prefix === 'knowledge-refresh') {
    return { userId: kind, version: Number(userId) || 1 };
  }
  return { userId, version: Number(version) || 1 };
}
