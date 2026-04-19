import type { RuntimeHost } from '../../core/runtime.host';
import type { RuntimeTaskContext } from '../../services/runtime-task.service';

export interface RuntimeTaskContextInput {
  orchestrator: () => RuntimeHost['orchestrator'];
  runtimeStateRepository: () => RuntimeHost['runtimeStateRepository'];
  resolveTaskSkillSuggestions: RuntimeTaskContext['resolveTaskSkillSuggestions'];
}

export function createTaskContext(input: RuntimeTaskContextInput): RuntimeTaskContext {
  return {
    orchestrator: input.orchestrator(),
    runtimeStateRepository: input.runtimeStateRepository(),
    resolveTaskSkillSuggestions: input.resolveTaskSkillSuggestions
  };
}
