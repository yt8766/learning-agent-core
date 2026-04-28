import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface PluginDraft {
  id: string;
  name: string;
  description: string;
  manifest: Record<string, unknown>;
  code?: string;
  status: 'draft' | 'lab' | 'disabled';
  createdAt: string;
  updatedAt: string;
}

export async function publishPluginDraft(root: string, draft: PluginDraft): Promise<PluginDraft> {
  const filePath = join(root, 'plugins-lab', `${draft.id}.json`);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(draft, null, 2));
  return draft;
}
