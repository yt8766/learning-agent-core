import type { z } from 'zod';
import type {
  ContextBundleSchema,
  ContextManifestSchema,
  ContextPageSchema,
  MissingContextSignalSchema
} from '../schemas/agent-runtime-context';

export type ContextPage = z.infer<typeof ContextPageSchema>;
export type ContextBundle = z.infer<typeof ContextBundleSchema>;
export type ContextManifest = z.infer<typeof ContextManifestSchema>;
export type MissingContextSignal = z.infer<typeof MissingContextSignalSchema>;
