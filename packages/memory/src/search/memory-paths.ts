import { dirname, join } from 'node:path';

export function deriveMemorySiblingPath(memoryFilePath: string, filename: string) {
  return join(dirname(memoryFilePath), filename);
}
