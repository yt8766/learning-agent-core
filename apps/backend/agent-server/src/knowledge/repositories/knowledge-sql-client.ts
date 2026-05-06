export interface KnowledgeSqlQueryResult<T> {
  rows: T[];
}

export interface KnowledgeSqlClient {
  query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<KnowledgeSqlQueryResult<T>>;
  close?: () => Promise<void>;
}
