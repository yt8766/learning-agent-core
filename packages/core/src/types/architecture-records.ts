import { z } from 'zod';

import {
  ArchitectureDescriptorSchema,
  ArchitectureDiagramDirectionSchema,
  ArchitectureDiagramRecordSchema,
  ArchitectureDiagramScopeSchema,
  ArchitectureEdgeDescriptorSchema,
  ArchitectureNodeDescriptorSchema,
  ArchitectureSubgraphDescriptorSchema,
  RuntimeArchitectureRecordSchema
} from '../spec/architecture-records';
export type { ArchitectureDescriptorRegistryEntry } from '../contracts/architecture-records';

export type ArchitectureDiagramScope = z.infer<typeof ArchitectureDiagramScopeSchema>;
export type ArchitectureDiagramDirection = z.infer<typeof ArchitectureDiagramDirectionSchema>;
export type ArchitectureNodeDescriptor = z.infer<typeof ArchitectureNodeDescriptorSchema>;
export type ArchitectureEdgeDescriptor = z.infer<typeof ArchitectureEdgeDescriptorSchema>;
export type ArchitectureSubgraphDescriptor = z.infer<typeof ArchitectureSubgraphDescriptorSchema>;
export type ArchitectureDescriptor = z.infer<typeof ArchitectureDescriptorSchema>;
export type ArchitectureDiagramRecord = z.infer<typeof ArchitectureDiagramRecordSchema>;
export type RuntimeArchitectureRecord = z.infer<typeof RuntimeArchitectureRecordSchema>;
