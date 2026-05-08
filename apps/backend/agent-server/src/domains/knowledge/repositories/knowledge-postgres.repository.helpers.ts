export function requiredRow(row: Record<string, unknown> | undefined, name: string): Record<string, unknown> {
  if (!row) {
    throw new Error(`Missing ${name} row`);
  }
  return row;
}

export function stringifyJsonParam(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

export async function ensureChatConversationForUser(
  client: { query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }> },
  conversationId: string,
  userId: string
): Promise<void> {
  const result = await client.query(
    `select id from knowledge_chat_conversations where id = $1 and user_id = $2 limit 1`,
    [conversationId, userId]
  );
  if (!result.rows[0]) {
    throw new Error('knowledge_chat_conversation_not_found');
  }
}
