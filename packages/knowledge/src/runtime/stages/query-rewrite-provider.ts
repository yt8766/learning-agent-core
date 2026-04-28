export interface QueryRewriteProvider {
  rewrite(query: string): Promise<string>;
}
