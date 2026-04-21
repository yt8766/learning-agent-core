import { AdapterError } from '../errors/adapter-error';

export function validateVectorDimensions(vectors: { id: string; values: number[] }[], adapterName: string): void {
  if (vectors.length === 0) return;
  const first = vectors[0];
  if (!first) return;
  const expectedDim = first.values.length;
  for (const vec of vectors) {
    if (vec.values.length !== expectedDim) {
      throw new AdapterError(
        adapterName,
        `Vector dimension mismatch: expected ${expectedDim}, got ${vec.values.length} for vector "${vec.id}"`
      );
    }
    if (!vec.values.every(v => typeof v === 'number' && isFinite(v))) {
      throw new AdapterError(adapterName, `Vector "${vec.id}" contains non-finite or non-number values`);
    }
  }
}
