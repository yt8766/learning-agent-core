import type { IntelSourcesConfig } from '../schemas/intel-config.schema';
import { PatrolGraphStateSchema, type PatrolGraphState, type PatrolTopic } from '../schemas/patrol-graph-state.schema';

interface LoadSourceConfigNodeInput extends Partial<PatrolGraphState> {
  mode: PatrolGraphState['mode'];
  jobId: string;
  startedAt: string;
  sources: IntelSourcesConfig;
}

export function loadSourceConfigNode(input: LoadSourceConfigNodeInput): PatrolGraphState {
  const topics: PatrolTopic[] = input.sources.topics
    .filter(topic => topic.enabled && topic.mode === input.mode)
    .map(topic => ({
      key: topic.key,
      priorityDefault: topic.priorityDefault,
      queries: [...topic.queries],
      recencyHours: input.sources.defaults.recencyHours
    }));

  return PatrolGraphStateSchema.parse({
    ...input,
    topics
  });
}
