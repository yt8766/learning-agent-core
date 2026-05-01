import type { RuntimeHost } from '../../core/runtime.host';
import type { RuntimeKnowledgeContext } from '../../services/runtime-knowledge.service';
import type { RuntimeWenyuanFacade } from './runtime-wenyuan-facade';

export interface RuntimeKnowledgeContextInput {
  wenyuanFacade: () => RuntimeWenyuanFacade;
  ruleRepository: () => RuntimeHost['ruleRepository'];
  orchestrator: () => RuntimeHost['orchestrator'];
  runtimeStateRepository: () => RuntimeHost['runtimeStateRepository'];
  settings?: () => RuntimeHost['settings'];
  vectorIndexRepository?: () => RuntimeHost['runtime']['vectorIndexRepository'];
}

export function createKnowledgeContext(input: RuntimeKnowledgeContextInput): RuntimeKnowledgeContext {
  return {
    wenyuanFacade: input.wenyuanFacade(),
    ruleRepository: input.ruleRepository(),
    orchestrator: input.orchestrator(),
    runtimeStateRepository: input.runtimeStateRepository(),
    settings: input.settings?.(),
    vectorIndexRepository: input.vectorIndexRepository?.()
  };
}
