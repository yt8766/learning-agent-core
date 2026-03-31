import { buildKnowledgeDescriptor } from '../knowledge/runtime-knowledge-store';

export function createKnowledgeArchitectureRegistry(input: {
  knowledgeDescriptor: ReturnType<typeof buildKnowledgeDescriptor>;
}) {
  return {
    sourceDescriptors: [...input.knowledgeDescriptor.sourceDescriptors]
  };
}
