import { dirname } from 'node:path';

import fs from 'fs-extra';
import { z } from 'zod';

import type { KnowledgeCliSnapshot } from './types';

const SnapshotSchema = z.object({
  version: z.literal(1),
  createdAt: z.string().min(1),
  documents: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      uri: z.string().min(1),
      contentLength: z.number().int().nonnegative()
    })
  ),
  sources: z.array(z.record(z.string(), z.unknown())),
  chunks: z.array(z.record(z.string(), z.unknown()))
});

export async function writeKnowledgeSnapshot(path: string, snapshot: KnowledgeCliSnapshot): Promise<void> {
  await fs.ensureDir(dirname(path));
  await fs.writeJson(path, snapshot, { spaces: 2 });
}

export async function readKnowledgeSnapshot(path: string): Promise<KnowledgeCliSnapshot> {
  const raw = await fs.readJson(path);
  const parsed = SnapshotSchema.parse(raw);
  return parsed as KnowledgeCliSnapshot;
}
