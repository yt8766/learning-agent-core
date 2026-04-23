export function normalizeModelBaseUrl(url: string) {
  return url.endsWith('/chat/completions') ? url.replace(/\/chat\/completions$/, '') : url;
}

export function normalizeEmbeddingBaseUrl(url: string) {
  return url.endsWith('/embeddings') ? url.replace(/\/embeddings$/, '') : url;
}
