import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export async function listFiles(root: string, predicate: (path: string) => boolean): Promise<string[]> {
  const found: string[] = [];
  const entries = (await readdir(root, { withFileTypes: true })).sort((left, right) =>
    left.name.localeCompare(right.name)
  );

  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await listFiles(path, predicate)));
    } else if (predicate(path)) {
      found.push(path);
    }
  }

  return found;
}
