import { z } from 'zod';

export const ArchitectureDiagramScopeSchema = z.enum(['project', 'agent', 'agentChat', 'agentAdmin']);
export const ArchitectureDiagramDirectionSchema = z.enum(['TD', 'LR']);

export const ArchitectureNodeDescriptorSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z
    .enum([
      'entry',
      'runtime',
      'strategy',
      'ministry',
      'fallback',
      'frontend',
      'backend',
      'worker',
      'data',
      'registry',
      'governance',
      'view',
      'connector'
    ])
    .optional(),
  subgraphId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const ArchitectureEdgeDescriptorSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
  style: z.enum(['solid', 'dashed']).optional()
});

export const ArchitectureSubgraphDescriptorSchema = z.object({
  id: z.string(),
  title: z.string()
});

export const ArchitectureDescriptorSchema = z.object({
  id: z.string(),
  title: z.string(),
  scope: ArchitectureDiagramScopeSchema,
  direction: ArchitectureDiagramDirectionSchema,
  sourceDescriptors: z.array(z.string()),
  subgraphs: z.array(ArchitectureSubgraphDescriptorSchema),
  nodes: z.array(ArchitectureNodeDescriptorSchema),
  edges: z.array(ArchitectureEdgeDescriptorSchema)
});

export const ArchitectureDiagramRecordSchema = z.object({
  id: ArchitectureDiagramScopeSchema,
  title: z.string(),
  generatedAt: z.string(),
  version: z.string(),
  sourceDescriptors: z.array(z.string()),
  descriptor: ArchitectureDescriptorSchema,
  mermaid: z.string()
});

export const RuntimeArchitectureRecordSchema = z.object({
  project: ArchitectureDiagramRecordSchema,
  agent: ArchitectureDiagramRecordSchema,
  agentChat: ArchitectureDiagramRecordSchema,
  agentAdmin: ArchitectureDiagramRecordSchema
});
