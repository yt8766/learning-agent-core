import type { ArchitectureDescriptor, ArchitectureDiagramScope } from '../types/architecture-records';

export interface ArchitectureDescriptorRegistryEntry {
  id: ArchitectureDiagramScope;
  sourceDescriptors: string[];
  build: () => ArchitectureDescriptor;
}
