import type {
  ArchitectureDescriptor,
  ArchitectureDiagramScope
} from '../../architecture/types/architecture-records.types';

export interface ArchitectureDescriptorRegistryEntry {
  id: ArchitectureDiagramScope;
  sourceDescriptors: string[];
  build: () => ArchitectureDescriptor;
}
