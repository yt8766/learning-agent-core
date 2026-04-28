import type { Chunk, Document } from '../schemas/index';

export interface Loader {
  load(): Promise<Document[]>;
}

export interface Chunker {
  chunk(document: Document): Promise<Chunk[]>;
}
