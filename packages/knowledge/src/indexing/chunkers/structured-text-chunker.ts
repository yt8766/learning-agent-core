import type { Chunk, Chunker, Document, JsonObject, JsonValue } from '../../contracts/indexing';

export interface StructuredTextChunkerOptions {
  chunkSize?: number;
  chunkOverlap?: number;
}

type StructuredBlockContentType = 'paragraph' | 'list' | 'code';

interface HeadingState {
  level: number;
  title: string;
  id: string;
}

interface StructuredBlock {
  content: string;
  contentType: StructuredBlockContentType;
  headings: HeadingState[];
}

interface ChunkDraft {
  content: string;
  contentType: StructuredBlockContentType;
  headings: HeadingState[];
}

const DEFAULT_STRUCTURED_CHUNK_SIZE = 800;
const DEFAULT_STRUCTURED_CHUNK_OVERLAP = 120;

export class StructuredTextChunker implements Chunker {
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;

  constructor(options: StructuredTextChunkerOptions = {}) {
    this.chunkSize = Math.max(1, options.chunkSize ?? DEFAULT_STRUCTURED_CHUNK_SIZE);
    this.chunkOverlap = Math.max(
      0,
      Math.min(options.chunkOverlap ?? DEFAULT_STRUCTURED_CHUNK_OVERLAP, this.chunkSize - 1)
    );
  }

  async chunk(document: Document): Promise<Chunk[]> {
    const blocks = parseStructuredBlocks(document);
    const drafts = blocks.flatMap(block => this.toDrafts(block));

    return drafts.map((draft, index) => {
      const chunkId = `${document.id}#chunk-${index}`;
      return {
        id: chunkId,
        content: draft.content,
        sourceDocumentId: document.id,
        chunkIndex: index,
        metadata: {
          ...document.metadata,
          ...createStructuredMetadata(document.id, draft, chunkId, drafts[index - 1], drafts[index + 1], index)
        }
      };
    });
  }

  private toDrafts(block: StructuredBlock): ChunkDraft[] {
    if (block.content.length <= this.chunkSize) {
      return [
        {
          content: block.content,
          contentType: block.contentType,
          headings: block.headings
        }
      ];
    }

    const drafts: ChunkDraft[] = [];
    const step = Math.max(1, this.chunkSize - this.chunkOverlap);

    for (let start = 0; start < block.content.length; start += step) {
      const content = block.content.slice(start, start + this.chunkSize).trim();
      if (content) {
        drafts.push({
          content,
          contentType: block.contentType,
          headings: block.headings
        });
      }
      if (start + this.chunkSize >= block.content.length) break;
    }

    return drafts;
  }
}

function parseStructuredBlocks(document: Document): StructuredBlock[] {
  const blocks: StructuredBlock[] = [];
  const headings: HeadingState[] = [];
  const lines = document.content.split(/\r?\n/);
  const sectionSlugCounts = collectSectionSlugCounts(lines);
  let buffer: string[] = [];
  let bufferType: StructuredBlockContentType | undefined;
  let codeFence: string | undefined;

  const flush = (): void => {
    const content = buffer.join('\n').trim();
    if (content && bufferType) {
      blocks.push({ content, contentType: bufferType, headings: [...headings] });
    }
    buffer = [];
    bufferType = undefined;
  };

  for (const line of lines) {
    const fenceMarker = matchFenceMarker(line);
    if (codeFence) {
      buffer.push(line);
      if (fenceMarker === codeFence) {
        flush();
        codeFence = undefined;
      }
      continue;
    }

    if (fenceMarker) {
      flush();
      codeFence = fenceMarker;
      bufferType = 'code';
      buffer.push(line);
      continue;
    }

    const heading = matchHeading(line);
    if (heading) {
      flush();
      updateHeadingStack(headings, document.id, heading.level, heading.title, sectionSlugCounts);
      continue;
    }

    if (!line.trim()) {
      flush();
      continue;
    }

    const lineType = matchListItem(line) ? 'list' : 'paragraph';
    if (bufferType && bufferType !== lineType) {
      flush();
    }
    bufferType = lineType;
    buffer.push(line);
  }

  flush();
  return blocks;
}

function createStructuredMetadata(
  documentId: string,
  draft: ChunkDraft,
  chunkId: string,
  previousDraft: ChunkDraft | undefined,
  nextDraft: ChunkDraft | undefined,
  ordinal: number
): JsonObject {
  const section = draft.headings.at(-1);
  const sectionPath = draft.headings.map(heading => heading.title);
  const sectionId = section?.id ?? `${documentId}#section-root`;
  const sectionTitle = section?.title ?? 'Root';
  const metadata: JsonObject = {
    parentId: sectionId,
    sectionId,
    sectionTitle,
    heading: sectionTitle,
    sectionPath: sectionPath as JsonValue,
    contentType: draft.contentType,
    ordinal,
    chunkHash: createChunkHash(chunkId, draft.content)
  };

  if (previousDraft) {
    metadata.prevChunkId = `${documentId}#chunk-${ordinal - 1}`;
  }
  if (nextDraft) {
    metadata.nextChunkId = `${documentId}#chunk-${ordinal + 1}`;
  }

  return metadata;
}

function collectSectionSlugCounts(lines: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const line of lines) {
    const heading = matchHeading(line);
    if (!heading) continue;
    const slug = slugifyHeadingSegment(heading.title);
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  return counts;
}

function updateHeadingStack(
  headings: HeadingState[],
  documentId: string,
  level: number,
  title: string,
  sectionSlugCounts: Map<string, number>
): void {
  while (headings.length > 0 && headings[headings.length - 1]!.level >= level) {
    headings.pop();
  }
  const sectionPath = [...headings.map(heading => heading.title), title];
  const sectionSlug = createSectionSlug(sectionPath, sectionSlugCounts);
  headings.push({ level, title, id: `${documentId}#section-${sectionSlug}` });
}

function matchHeading(line: string): { level: number; title: string } | undefined {
  const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
  if (!match) return undefined;
  return { level: match[1]!.length, title: match[2]!.replace(/\s+#+$/, '').trim() };
}

function matchFenceMarker(line: string): string | undefined {
  const match = /^(\s*)(`{3,}|~{3,})/.exec(line);
  return match?.[2]?.slice(0, 3);
}

function matchListItem(line: string): boolean {
  return /^\s*(?:[-*+]|\d+[.)])\s+/.test(line);
}

function createSectionSlug(sectionPath: string[], sectionSlugCounts: Map<string, number>): string {
  const titleSlug = slugifyHeadingSegment(sectionPath[sectionPath.length - 1] ?? '');
  if ((sectionSlugCounts.get(titleSlug) ?? 0) <= 1) {
    return titleSlug;
  }
  return sectionPath.map(slugifyHeadingSegment).join('--');
}

function slugifyHeadingSegment(value: string): string {
  const normalized = value.normalize('NFKC');
  const slug = normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug) return slug;

  const unicodeSlug = Array.from(normalized)
    .filter(character => /[\p{Letter}\p{Number}]/u.test(character))
    .map(character => character.codePointAt(0)?.toString(16))
    .filter((codePoint): codePoint is string => Boolean(codePoint))
    .join('-');

  return unicodeSlug ? `u-${unicodeSlug}` : `x-${createStableHash(normalized)}`;
}

function createChunkHash(chunkId: string, content: string): string {
  return createStableHash(`${chunkId}\n${content}`);
}

function createStableHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
